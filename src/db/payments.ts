import { getDb } from './database';
import type { NewPayment, Payment } from '../types';

interface PaymentRow {
  id: number;
  customer_id: number;
  amount: number;
  date_paid: string;
  period_from: string;
  period_to: string;
  method: string | null;
  notes: string | null;
  proof_image: string | null;
}

function fromRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    customerId: row.customer_id,
    amount: row.amount,
    datePaid: row.date_paid,
    periodFrom: row.period_from,
    periodTo: row.period_to,
    method: row.method,
    notes: row.notes,
    proofImage: row.proof_image,
  };
}

export async function listPayments(): Promise<Payment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PaymentRow>(
    'SELECT * FROM payments ORDER BY date_paid DESC, id DESC'
  );
  return rows.map(fromRow);
}

export async function listPaymentsForCustomer(customerId: number): Promise<Payment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PaymentRow>(
    'SELECT * FROM payments WHERE customer_id = ? ORDER BY date_paid DESC, id DESC',
    customerId
  );
  return rows.map(fromRow);
}

export async function getPayment(id: number): Promise<Payment | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PaymentRow>('SELECT * FROM payments WHERE id = ?', id);
  return row ? fromRow(row) : null;
}

export async function createPayment(input: NewPayment): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO payments (customer_id, amount, date_paid, period_from, period_to, method, notes, proof_image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.customerId,
    input.amount,
    input.datePaid,
    input.periodFrom,
    input.periodTo,
    input.method,
    input.notes,
    input.proofImage
  );
  return result.lastInsertRowId;
}

export async function updatePayment(id: number, input: NewPayment): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE payments SET customer_id = ?, amount = ?, date_paid = ?, period_from = ?, period_to = ?, method = ?, notes = ?, proof_image = ?
     WHERE id = ?`,
    input.customerId,
    input.amount,
    input.datePaid,
    input.periodFrom,
    input.periodTo,
    input.method,
    input.notes,
    input.proofImage,
    id
  );
}

export async function deletePayment(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM payments WHERE id = ?', id);
}
