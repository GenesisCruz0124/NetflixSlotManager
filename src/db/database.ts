import * as SQLite from 'expo-sqlite';

const DB_NAME = 'netflix_slot_manager.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndInit();
  }
  return dbPromise;
}

async function openAndInit(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  // Tables created by earlier single-account builds of this app may already exist
  // without `account_id`. Detect that *before* the `CREATE TABLE IF NOT EXISTS`
  // calls below (which are no-ops on existing tables) so we know whether to migrate.
  const customersNeedsMigration = await tableExists(db, 'customers') && !(await columnExists(db, 'customers', 'account_id'));
  const changeLogNeedsMigration = await tableExists(db, 'change_log') && !(await columnExists(db, 'change_log', 'account_id'));
  const paymentsNeedsProofImage = await tableExists(db, 'payments') && !(await columnExists(db, 'payments', 'proof_image'));

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      netflix_email TEXT NOT NULL DEFAULT '',
      profile_names TEXT NOT NULL DEFAULT '["","","","",""]',
      monthly_subscription_cost REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      contact_info TEXT,
      profile_slot INTEGER NOT NULL,
      monthly_price REAL NOT NULL,
      billing_day INTEGER NOT NULL,
      joined_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      date_paid TEXT NOT NULL,
      period_covered TEXT NOT NULL,
      method TEXT,
      notes TEXT,
      proof_image TEXT
    );

    CREATE TABLE IF NOT EXISTS change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      profile_slot INTEGER,
      old_value TEXT,
      new_value TEXT,
      timestamp TEXT NOT NULL,
      result TEXT NOT NULL
    );
  `);

  if (customersNeedsMigration || changeLogNeedsMigration) {
    await migrateSingleAccountToMultiAccount(db, { customersNeedsMigration, changeLogNeedsMigration });
  }

  if (paymentsNeedsProofImage) {
    await db.execAsync('ALTER TABLE payments ADD COLUMN proof_image TEXT');
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_customers_account ON customers(account_id);
    CREATE INDEX IF NOT EXISTS idx_change_log_account ON change_log(account_id);
  `);

  return db;
}

async function tableExists(db: SQLite.SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    name
  );
  return row != null;
}

async function columnExists(db: SQLite.SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return columns.some((c) => c.name === column);
}

interface LegacyAccountInfoRow {
  netflix_email: string;
  profile_names: string;
  monthly_subscription_cost: number | null;
}

/**
 * Earlier builds tracked a single Netflix account in a singleton `account_info`
 * row, with `customers`/`change_log` implicitly belonging to it. Multi-account
 * support requires every row to carry an `account_id`, so on first launch after
 * upgrading we fold that legacy account into a real `accounts` row and attach
 * existing customers/history to it instead of discarding them.
 */
async function migrateSingleAccountToMultiAccount(
  db: SQLite.SQLiteDatabase,
  flags: { customersNeedsMigration: boolean; changeLogNeedsMigration: boolean }
): Promise<void> {
  const legacy = (await tableExists(db, 'account_info'))
    ? await db.getFirstAsync<LegacyAccountInfoRow>('SELECT * FROM account_info WHERE id = 1')
    : null;

  const result = await db.runAsync(
    `INSERT INTO accounts (label, netflix_email, profile_names, monthly_subscription_cost) VALUES (?, ?, ?, ?)`,
    'My Netflix account',
    legacy?.netflix_email ?? '',
    legacy?.profile_names ?? '["","","","",""]',
    legacy?.monthly_subscription_cost ?? 0
  );
  const defaultAccountId = result.lastInsertRowId;

  if (flags.customersNeedsMigration) {
    await db.execAsync('ALTER TABLE customers ADD COLUMN account_id INTEGER NOT NULL DEFAULT 0');
    await db.runAsync('UPDATE customers SET account_id = ?', defaultAccountId);
  }
  if (flags.changeLogNeedsMigration) {
    await db.execAsync('ALTER TABLE change_log ADD COLUMN account_id INTEGER NOT NULL DEFAULT 0');
    await db.runAsync('UPDATE change_log SET account_id = ?', defaultAccountId);
  }

  await db.execAsync('DROP TABLE IF EXISTS account_info');
}
