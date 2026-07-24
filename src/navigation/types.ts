import type { NavigatorScreenParams } from '@react-navigation/native';

export type CustomersStackParamList = {
  CustomersList: undefined;
  CustomerForm: { customerId?: number } | undefined;
  CustomerDetail: { customerId: number };
};

export type SalesStackParamList = {
  PaymentsList: undefined;
  PaymentForm: { customerId?: number; paymentId?: number; periodFrom?: string; periodTo?: string } | undefined;
};

export type AccountsStackParamList = {
  AccountsList: undefined;
  AccountForm: { accountId?: number } | undefined;
  AccountDetail: { accountId: number };
  AutomationRunner: { accountId: number; mode: 'password' | 'profile_name'; profileSlot?: number };
};

export type RootTabParamList = {
  Dashboard: undefined;
  Customers: undefined;
  Sales: NavigatorScreenParams<SalesStackParamList> | undefined;
  Accounts: undefined;
  Settings: undefined;
};
