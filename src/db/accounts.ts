import * as SecureStore from 'expo-secure-store';
import { getDb } from './database';
import type {
  Account,
  ChangeLogEntry,
  ChangeLogResult,
  ChangeLogType,
  NewAccount,
  NewChangeLogEntry,
} from '../types';

function passwordKeyFor(accountId: number): string {
  return `netflix_account_password_${accountId}`;
}

function profilePinKeyFor(accountId: number, slotIndex: number): string {
  return `netflix_profile_pin_${accountId}_${slotIndex}`;
}

interface AccountRow {
  id: number;
  label: string;
  netflix_email: string;
  profile_names: string;
  monthly_subscription_cost: number;
}

function fromRow(row: AccountRow): Account {
  let profileNames: string[];
  try {
    profileNames = JSON.parse(row.profile_names);
  } catch {
    profileNames = ['', '', '', '', ''];
  }
  return {
    id: row.id,
    label: row.label,
    netflixEmail: row.netflix_email,
    profileNames,
    monthlySubscriptionCost: row.monthly_subscription_cost,
  };
}

export async function listAccounts(): Promise<Account[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AccountRow>('SELECT * FROM accounts ORDER BY id ASC');
  return rows.map(fromRow);
}

export async function getAccount(id: number): Promise<Account | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', id);
  return row ? fromRow(row) : null;
}

export async function createAccount(input: NewAccount): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO accounts (label, netflix_email, profile_names, monthly_subscription_cost)
     VALUES (?, ?, ?, ?)`,
    input.label,
    input.netflixEmail,
    JSON.stringify(input.profileNames),
    input.monthlySubscriptionCost
  );
  return result.lastInsertRowId;
}

export async function updateAccount(id: number, input: NewAccount): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE accounts SET label = ?, netflix_email = ?, profile_names = ?, monthly_subscription_cost = ? WHERE id = ?`,
    input.label,
    input.netflixEmail,
    JSON.stringify(input.profileNames),
    input.monthlySubscriptionCost,
    id
  );
}

export async function updateProfileName(accountId: number, slotIndex: number, name: string): Promise<void> {
  const account = await getAccount(accountId);
  if (!account) return;
  const nextNames = [...account.profileNames];
  nextNames[slotIndex] = name;
  await updateAccount(accountId, { ...account, profileNames: nextNames });
}

export async function deleteAccount(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM accounts WHERE id = ?', id);
  await clearStoredPassword(id);
  await Promise.all([0, 1, 2, 3, 4].map((slotIndex) => clearProfilePin(id, slotIndex)));
}

export async function getStoredPassword(accountId: number): Promise<string | null> {
  return SecureStore.getItemAsync(passwordKeyFor(accountId));
}

export async function setStoredPassword(accountId: number, password: string): Promise<void> {
  await SecureStore.setItemAsync(passwordKeyFor(accountId), password);
}

export async function clearStoredPassword(accountId: number): Promise<void> {
  await SecureStore.deleteItemAsync(passwordKeyFor(accountId));
}

export async function getProfilePin(accountId: number, slotIndex: number): Promise<string | null> {
  return SecureStore.getItemAsync(profilePinKeyFor(accountId, slotIndex));
}

export async function setProfilePin(accountId: number, slotIndex: number, pin: string): Promise<void> {
  await SecureStore.setItemAsync(profilePinKeyFor(accountId, slotIndex), pin);
}

export async function clearProfilePin(accountId: number, slotIndex: number): Promise<void> {
  await SecureStore.deleteItemAsync(profilePinKeyFor(accountId, slotIndex));
}

export async function getProfilePins(accountId: number): Promise<(string | null)[]> {
  return Promise.all([0, 1, 2, 3, 4].map((slotIndex) => getProfilePin(accountId, slotIndex)));
}

interface ChangeLogRow {
  id: number;
  account_id: number;
  type: ChangeLogType;
  profile_slot: number | null;
  old_value: string | null;
  new_value: string | null;
  timestamp: string;
  result: ChangeLogResult;
}

function changeLogFromRow(row: ChangeLogRow): ChangeLogEntry {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    profileSlot: row.profile_slot,
    oldValue: row.old_value,
    newValue: row.new_value,
    timestamp: row.timestamp,
    result: row.result,
  };
}

export async function listChangeLog(accountId: number): Promise<ChangeLogEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ChangeLogRow>(
    'SELECT * FROM change_log WHERE account_id = ? ORDER BY timestamp DESC, id DESC',
    accountId
  );
  return rows.map(changeLogFromRow);
}

export async function addChangeLogEntry(entry: NewChangeLogEntry): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO change_log (account_id, type, profile_slot, old_value, new_value, timestamp, result)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    entry.accountId,
    entry.type,
    entry.profileSlot,
    entry.oldValue,
    entry.newValue,
    entry.timestamp,
    entry.result
  );
  return result.lastInsertRowId;
}
