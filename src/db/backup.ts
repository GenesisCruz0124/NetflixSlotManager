import { Directory, File, Paths } from 'expo-file-system';
import { getDb } from './database';
import {
  clearProfilePin,
  clearStoredPassword,
  getProfilePin,
  getStoredPassword,
  setProfilePin,
  setStoredPassword,
} from './accounts';

const PROOF_DIR_NAME = 'payment_proofs';
const BACKUP_VERSION = 1;

interface BackupAccount {
  id: number;
  label: string;
  netflix_email: string;
  profile_names: string;
  monthly_subscription_cost: number;
  password: string | null;
  pins: (string | null)[];
}

interface BackupCustomer {
  id: number;
  account_id: number;
  name: string;
  contact_info: string | null;
  profile_slot: number;
  monthly_price: number;
  billing_day: number;
  joined_date: string;
  status: string;
}

interface BackupPayment {
  id: number;
  customer_id: number;
  amount: number;
  date_paid: string;
  period_from: string;
  period_to: string;
  method: string | null;
  notes: string | null;
  proof_image_base64: string | null;
  proof_image_ext: string | null;
}

interface BackupChangeLogEntry {
  id: number;
  account_id: number;
  type: string;
  profile_slot: number | null;
  old_value: string | null;
  new_value: string | null;
  timestamp: string;
  result: string;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  accounts: BackupAccount[];
  customers: BackupCustomer[];
  payments: BackupPayment[];
  changeLog: BackupChangeLogEntry[];
}

export async function createBackup(): Promise<BackupPayload> {
  const db = await getDb();

  const accountRows = await db.getAllAsync<Omit<BackupAccount, 'password' | 'pins'>>(
    'SELECT * FROM accounts ORDER BY id ASC'
  );
  const accounts: BackupAccount[] = await Promise.all(
    accountRows.map(async (row) => ({
      ...row,
      password: await getStoredPassword(row.id),
      pins: await Promise.all([0, 1, 2, 3, 4].map((slotIndex) => getProfilePin(row.id, slotIndex))),
    }))
  );

  const customers = await db.getAllAsync<BackupCustomer>('SELECT * FROM customers ORDER BY id ASC');

  const paymentRows = await db.getAllAsync<{
    id: number;
    customer_id: number;
    amount: number;
    date_paid: string;
    period_from: string;
    period_to: string;
    method: string | null;
    notes: string | null;
    proof_image: string | null;
  }>('SELECT * FROM payments ORDER BY id ASC');

  const payments: BackupPayment[] = await Promise.all(
    paymentRows.map(async (row) => {
      let proofImageBase64: string | null = null;
      let proofImageExt: string | null = null;
      if (row.proof_image) {
        try {
          const file = new File(row.proof_image);
          if (file.exists) {
            proofImageBase64 = await file.base64();
            const extensionMatch = /\.(\w+)$/.exec(row.proof_image);
            proofImageExt = extensionMatch ? extensionMatch[1] : 'jpg';
          }
        } catch {
          // A missing or unreadable proof image shouldn't block the whole backup.
        }
      }
      return {
        id: row.id,
        customer_id: row.customer_id,
        amount: row.amount,
        date_paid: row.date_paid,
        period_from: row.period_from,
        period_to: row.period_to,
        method: row.method,
        notes: row.notes,
        proof_image_base64: proofImageBase64,
        proof_image_ext: proofImageExt,
      };
    })
  );

  const changeLog = await db.getAllAsync<BackupChangeLogEntry>('SELECT * FROM change_log ORDER BY id ASC');

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    accounts,
    customers,
    payments,
    changeLog,
  };
}

export function isSupportedBackup(payload: unknown): payload is BackupPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as BackupPayload).version === BACKUP_VERSION &&
    Array.isArray((payload as BackupPayload).accounts) &&
    Array.isArray((payload as BackupPayload).customers) &&
    Array.isArray((payload as BackupPayload).payments) &&
    Array.isArray((payload as BackupPayload).changeLog)
  );
}

/** Wipes all local data and replaces it with the contents of `payload`, preserving original IDs. */
export async function restoreBackup(payload: BackupPayload): Promise<void> {
  if (!isSupportedBackup(payload)) {
    throw new Error('Unsupported or corrupted backup file.');
  }

  const db = await getDb();

  const existingAccountIds = (await db.getAllAsync<{ id: number }>('SELECT id FROM accounts')).map((r) => r.id);
  for (const accountId of existingAccountIds) {
    await clearStoredPassword(accountId);
    await Promise.all([0, 1, 2, 3, 4].map((slotIndex) => clearProfilePin(accountId, slotIndex)));
  }

  const proofDir = new Directory(Paths.document, PROOF_DIR_NAME);
  if (proofDir.exists) proofDir.delete();

  await db.execAsync(`
    DELETE FROM payments;
    DELETE FROM change_log;
    DELETE FROM customers;
    DELETE FROM accounts;
  `);

  for (const account of payload.accounts) {
    await db.runAsync(
      `INSERT INTO accounts (id, label, netflix_email, profile_names, monthly_subscription_cost) VALUES (?, ?, ?, ?, ?)`,
      account.id,
      account.label,
      account.netflix_email,
      account.profile_names,
      account.monthly_subscription_cost
    );
    if (account.password) await setStoredPassword(account.id, account.password);
    await Promise.all(
      account.pins.map((pin, slotIndex) => (pin ? setProfilePin(account.id, slotIndex, pin) : Promise.resolve()))
    );
  }

  for (const customer of payload.customers) {
    await db.runAsync(
      `INSERT INTO customers (id, account_id, name, contact_info, profile_slot, monthly_price, billing_day, joined_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      customer.id,
      customer.account_id,
      customer.name,
      customer.contact_info,
      customer.profile_slot,
      customer.monthly_price,
      customer.billing_day,
      customer.joined_date,
      customer.status
    );
  }

  const hasProofImages = payload.payments.some((p) => p.proof_image_base64);
  if (hasProofImages) proofDir.create({ intermediates: true, idempotent: true });

  for (const payment of payload.payments) {
    let proofImageUri: string | null = null;
    if (payment.proof_image_base64) {
      const extension = payment.proof_image_ext || 'jpg';
      const file = new File(proofDir, `proof_${payment.id}.${extension}`);
      file.write(payment.proof_image_base64, { encoding: 'base64' });
      proofImageUri = file.uri;
    }
    await db.runAsync(
      `INSERT INTO payments (id, customer_id, amount, date_paid, period_from, period_to, method, notes, proof_image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      payment.id,
      payment.customer_id,
      payment.amount,
      payment.date_paid,
      payment.period_from,
      payment.period_to,
      payment.method,
      payment.notes,
      proofImageUri
    );
  }

  for (const entry of payload.changeLog) {
    await db.runAsync(
      `INSERT INTO change_log (id, account_id, type, profile_slot, old_value, new_value, timestamp, result)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.id,
      entry.account_id,
      entry.type,
      entry.profile_slot,
      entry.old_value,
      entry.new_value,
      entry.timestamp,
      entry.result
    );
  }
}
