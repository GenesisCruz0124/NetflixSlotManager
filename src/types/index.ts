export interface Account {
  id: number;
  label: string;
  netflixEmail: string;
  profileNames: string[];
  monthlySubscriptionCost: number;
}

export type NewAccount = Omit<Account, 'id'>;

export type CustomerStatus = 'active' | 'paused' | 'cancelled';

export interface Customer {
  id: number;
  accountId: number;
  name: string;
  contactInfo: string | null;
  profileSlot: number;
  monthlyPrice: number;
  billingDay: number;
  joinedDate: string;
  status: CustomerStatus;
}

export type NewCustomer = Omit<Customer, 'id'>;

export interface Payment {
  id: number;
  customerId: number;
  amount: number;
  datePaid: string;
  periodCovered: string;
  method: string | null;
  notes: string | null;
  proofImage: string | null;
}

export type NewPayment = Omit<Payment, 'id'>;

export type ChangeLogType = 'password' | 'profile_name';
export type ChangeLogResult = 'success' | 'manual-completed' | 'failed';

export interface ChangeLogEntry {
  id: number;
  accountId: number;
  type: ChangeLogType;
  profileSlot: number | null;
  oldValue: string | null;
  newValue: string | null;
  timestamp: string;
  result: ChangeLogResult;
}

export type NewChangeLogEntry = Omit<ChangeLogEntry, 'id'>;
