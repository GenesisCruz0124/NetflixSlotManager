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

export const BACKUP_FORMAT = 'netflix-slot-manager-backup';
export const BACKUP_VERSION = 1;

const PROOF_DIR_NAME = 'payment_proofs';
const PROFILE_SLOTS = [0, 1, 2, 3, 4];

type CellValue = string | number | null;
type Row = Record<string, CellValue>;

const ACCOUNTS_COLUMNS = ['id', 'label', 'netflix_email', 'profile_names', 'monthly_subscription_cost'];
const CUSTOMERS_COLUMNS = [
  'id',
  'account_id',
  'name',
  'contact_info',
  'profile_slot',
  'monthly_price',
  'billing_day',
  'joined_date',
  'status',
];
const PAYMENTS_COLUMNS = [
  'id',
  'customer_id',
  'amount',
  'date_paid',
  'period_covered',
  'period_from',
  'period_to',
  'method',
  'notes',
  'proof_image',
];
const CHANGE_LOG_COLUMNS = ['id', 'account_id', 'type', 'profile_slot', 'old_value', 'new_value', 'timestamp', 'result'];

export interface BackupPayload {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: {
    accounts: Row[];
    customers: Row[];
    payments: Row[];
    changeLog: Row[];
  };
  secrets: {
    passwords: Record<string, string>;
    pins: Record<string, string>;
  };
  proofImages: Record<string, string>;
}

export interface RestoreSummary {
  accounts: number;
  customers: number;
  payments: number;
  changeLog: number;
}

function proofImageKey(paymentId: number, sourceUri: string): string {
  const match = /\.(\w+)$/.exec(sourceUri);
  const extension = match ? match[1] : 'jpg';
  return `payment_${paymentId}.${extension}`;
}

export async function buildBackup(): Promise<BackupPayload> {
  const db = await getDb();
  const [accounts, customers, payments, changeLog] = await Promise.all([
    db.getAllAsync<Row>('SELECT * FROM accounts ORDER BY id'),
    db.getAllAsync<Row>('SELECT * FROM customers ORDER BY id'),
    db.getAllAsync<Row>('SELECT * FROM payments ORDER BY id'),
    db.getAllAsync<Row>('SELECT * FROM change_log ORDER BY id'),
  ]);

  const passwords: Record<string, string> = {};
  const pins: Record<string, string> = {};
  for (const account of accounts) {
    const accountId = Number(account.id);
    const password = await getStoredPassword(accountId);
    if (password) passwords[String(accountId)] = password;
    for (const slot of PROFILE_SLOTS) {
      const pin = await getProfilePin(accountId, slot);
      if (pin) pins[`${accountId}:${slot}`] = pin;
    }
  }

  const proofImages: Record<string, string> = {};
  for (const payment of payments) {
    const uri = payment.proof_image;
    if (typeof uri !== 'string' || !uri) continue;
    try {
      const file = new File(uri);
      if (file.exists) {
        proofImages[proofImageKey(Number(payment.id), uri)] = await file.base64();
      }
    } catch {
      // Skip proof images that can no longer be read.
    }
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: { accounts, customers, payments, changeLog },
    secrets: { passwords, pins },
    proofImages,
  };
}

export async function exportBackup(): Promise<File> {
  const backup = await buildBackup();
  const stamp = backup.exportedAt.replace(/[:.]/g, '-');
  const file = new File(Paths.cache, `netflix-slot-manager-backup-${stamp}.json`);
  if (file.exists) file.delete();
  file.write(JSON.stringify(backup));
  return file;
}

function isRowArray(value: unknown): value is Row[] {
  return Array.isArray(value) && value.every((row) => row !== null && typeof row === 'object');
}

function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.format !== BACKUP_FORMAT || typeof v.version !== 'number') return false;

  const tables = v.tables as Record<string, unknown> | undefined;
  if (!tables) return false;
  if (!isRowArray(tables.accounts) || !isRowArray(tables.customers) || !isRowArray(tables.payments) || !isRowArray(tables.changeLog)) {
    return false;
  }

  const secrets = v.secrets as Record<string, unknown> | undefined;
  if (!secrets || typeof secrets.passwords !== 'object' || typeof secrets.pins !== 'object') return false;
  if (!v.proofImages || typeof v.proofImages !== 'object') return false;

  return true;
}

async function insertRows(
  db: Awaited<ReturnType<typeof getDb>>,
  table: string,
  columns: string[],
  rows: Row[]
): Promise<void> {
  const placeholders = columns.map(() => '?').join(', ');
  for (const row of rows) {
    const values = columns.map((column) => row[column] ?? null);
    await db.runAsync(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
  }
}

async function syncAutoIncrement(db: Awaited<ReturnType<typeof getDb>>, table: string): Promise<void> {
  const row = await db.getFirstAsync<{ maxId: number | null }>(`SELECT MAX(id) as maxId FROM ${table}`);
  const maxId = row?.maxId ?? 0;
  await db.runAsync('UPDATE sqlite_sequence SET seq = ? WHERE name = ?', maxId, table);
  await db.runAsync('INSERT OR IGNORE INTO sqlite_sequence (name, seq) VALUES (?, ?)', table, maxId);
}

export async function restoreBackup(json: string): Promise<RestoreSummary> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isBackupPayload(parsed)) {
    throw new Error('That file is not a NetflixSlotManager backup.');
  }
  if (parsed.version > BACKUP_VERSION) {
    throw new Error('This backup was created by a newer version of the app.');
  }

  const db = await getDb();
  const previousAccountIds = (await db.getAllAsync<{ id: number }>('SELECT id FROM accounts')).map((r) => r.id);

  const proofDir = new Directory(Paths.document, PROOF_DIR_NAME);
  const payments = parsed.tables.payments.map((payment) => {
    const key = Object.keys(parsed.proofImages).find((name) => name.startsWith(`payment_${Number(payment.id)}.`));
    return { ...payment, proof_image: key ? new File(proofDir, key).uri : null };
  });

  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM accounts');
    await insertRows(db, 'accounts', ACCOUNTS_COLUMNS, parsed.tables.accounts);
    await insertRows(db, 'customers', CUSTOMERS_COLUMNS, parsed.tables.customers);
    await insertRows(db, 'payments', PAYMENTS_COLUMNS, payments);
    await insertRows(db, 'change_log', CHANGE_LOG_COLUMNS, parsed.tables.changeLog);
    await syncAutoIncrement(db, 'accounts');
    await syncAutoIncrement(db, 'customers');
    await syncAutoIncrement(db, 'payments');
    await syncAutoIncrement(db, 'change_log');
  });

  // Only touch the filesystem once the DB transaction has committed, so a
  // failed restore leaves the existing proof images matching the existing rows.
  if (proofDir.exists) {
    for (const entry of proofDir.list()) {
      if (entry instanceof File) entry.delete();
    }
  } else {
    proofDir.create({ intermediates: true, idempotent: true });
  }
  for (const [name, base64] of Object.entries(parsed.proofImages)) {
    new File(proofDir, name).write(base64, { encoding: 'base64' });
  }

  for (const accountId of previousAccountIds) {
    await clearStoredPassword(accountId);
    for (const slot of PROFILE_SLOTS) await clearProfilePin(accountId, slot);
  }
  for (const [accountId, password] of Object.entries(parsed.secrets.passwords)) {
    const id = Number(accountId);
    if (Number.isFinite(id)) await setStoredPassword(id, password);
  }
  for (const [key, pin] of Object.entries(parsed.secrets.pins)) {
    const [accountId, slot] = key.split(':').map(Number);
    if (Number.isFinite(accountId) && Number.isFinite(slot)) await setProfilePin(accountId, slot, pin);
  }

  return {
    accounts: parsed.tables.accounts.length,
    customers: parsed.tables.customers.length,
    payments: parsed.tables.payments.length,
    changeLog: parsed.tables.changeLog.length,
  };
}
