import { getDb } from './database';
import type { Customer, CustomerStatus, NewCustomer } from '../types';

interface CustomerRow {
  id: number;
  account_id: number;
  name: string;
  contact_info: string | null;
  profile_slot: number;
  monthly_price: number;
  billing_day: number;
  joined_date: string;
  status: CustomerStatus;
}

function fromRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    contactInfo: row.contact_info,
    profileSlot: row.profile_slot,
    monthlyPrice: row.monthly_price,
    billingDay: row.billing_day,
    joinedDate: row.joined_date,
    status: row.status,
  };
}

export async function listCustomers(): Promise<Customer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CustomerRow>(
    'SELECT * FROM customers ORDER BY account_id ASC, profile_slot ASC'
  );
  return rows.map(fromRow);
}

export async function listCustomersForAccount(accountId: number): Promise<Customer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CustomerRow>(
    'SELECT * FROM customers WHERE account_id = ? ORDER BY profile_slot ASC',
    accountId
  );
  return rows.map(fromRow);
}

export async function getCustomer(id: number): Promise<Customer | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CustomerRow>(
    'SELECT * FROM customers WHERE id = ?',
    id
  );
  return row ? fromRow(row) : null;
}

export async function createCustomer(input: NewCustomer): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO customers (account_id, name, contact_info, profile_slot, monthly_price, billing_day, joined_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.accountId,
    input.name,
    input.contactInfo,
    input.profileSlot,
    input.monthlyPrice,
    input.billingDay,
    input.joinedDate,
    input.status
  );
  return result.lastInsertRowId;
}

export async function updateCustomer(id: number, input: NewCustomer): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE customers
     SET account_id = ?, name = ?, contact_info = ?, profile_slot = ?, monthly_price = ?, billing_day = ?, joined_date = ?, status = ?
     WHERE id = ?`,
    input.accountId,
    input.name,
    input.contactInfo,
    input.profileSlot,
    input.monthlyPrice,
    input.billingDay,
    input.joinedDate,
    input.status,
    id
  );
}

export async function deleteCustomer(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM customers WHERE id = ?', id);
}
