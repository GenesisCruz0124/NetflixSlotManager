import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import * as Clipboard from 'expo-clipboard';
import type { CustomersStackParamList, RootTabParamList } from '../navigation/types';
import type { Account, Customer, Payment } from '../types';
import { deleteCustomer, getCustomer } from '../db/customers';
import { getAccount, getProfilePin, getStoredPassword } from '../db/accounts';
import { listPaymentsForCustomer } from '../db/payments';
import { cancelDueReminder } from '../utils/notifications';
import { colors } from '../utils/theme';
import { addMonthsIso, formatCurrency, formatDate, todayIso } from '../utils/format';

type Props = CompositeScreenProps<
  NativeStackScreenProps<CustomersStackParamList, 'CustomerDetail'>,
  BottomTabScreenProps<RootTabParamList>
>;

export default function CustomerDetailScreen({ navigation, route }: Props) {
  const { customerId } = route.params;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [accountPassword, setAccountPassword] = useState<string | null>(null);
  const [profilePin, setProfilePin] = useState<string | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getCustomer(customerId).then(async (customerRow) => {
        if (cancelled) return;
        setCustomer(customerRow);
        navigation.setOptions({ title: customerRow?.name ?? 'Member' });
        const [accountRow, paymentRows] = await Promise.all([
          customerRow ? getAccount(customerRow.accountId) : Promise.resolve(null),
          listPaymentsForCustomer(customerId),
        ]);
        if (cancelled) return;
        setAccount(accountRow);
        setPayments(paymentRows);

        if (accountRow && customerRow) {
          const [storedPassword, storedPin] = await Promise.all([
            getStoredPassword(accountRow.id),
            getProfilePin(accountRow.id, customerRow.profileSlot - 1),
          ]);
          if (cancelled) return;
          setAccountPassword(storedPassword);
          setProfilePin(storedPin);
        } else {
          setAccountPassword(null);
          setProfilePin(null);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [customerId, navigation])
  );

  const copyToClipboard = async (label: string, value: string | null) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField((current) => (current === label ? null : current)), 1500);
  };

  const copyAllToClipboard = async () => {
    if (!account || !customer) return;
    const profileName = account.profileNames[customer.profileSlot - 1] || `Profile ${customer.profileSlot}`;
    const lines = [
      `Email: ${account.netflixEmail || 'Not set'}`,
      `Password: ${accountPassword || 'Not set'}`,
      `Profile name: ${profileName}`,
      `Profile PIN: ${profilePin || 'Not set'}`,
    ];
    await Clipboard.setStringAsync(lines.join('\n'));
    setCopiedField('all');
    setTimeout(() => setCopiedField((current) => (current === 'all' ? null : current)), 1500);
  };

  const handleDelete = () => {
    if (!customer) return;
    Alert.alert(
      'Remove member',
      `Remove ${customer.name} and their payment history? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await cancelDueReminder(customer.id);
            await deleteCustomer(customer.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleRenew = () => {
    if (!customer) return;
    const lastPeriodTo = payments.reduce((latest, p) => (p.periodTo > latest ? p.periodTo : latest), '');
    const periodFrom = lastPeriodTo || todayIso();
    const periodTo = addMonthsIso(periodFrom, 1);
    navigation.navigate('Sales', {
      screen: 'PaymentForm',
      params: { customerId: customer.id, periodFrom, periodTo },
    });
  };

  if (!customer) return null;

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Netflix account</Text>
          <Text style={styles.summaryValue}>{account?.label ?? 'Unknown account'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Profile slot</Text>
          <Text style={styles.summaryValue}>
            {customer.profileSlot}
            {account ? ` (${account.profileNames[customer.profileSlot - 1] || `Profile ${customer.profileSlot}`})` : ''}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Monthly price</Text>
          <Text style={styles.summaryValue}>{formatCurrency(customer.monthlyPrice)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Bills on day</Text>
          <Text style={styles.summaryValue}>{customer.billingDay}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Status</Text>
          <Text style={[styles.summaryValue, styles.statusText]}>{customer.status}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total received</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalPaid)}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, styles.actionPrimary]}
          onPress={() => navigation.navigate('CustomerForm', { customerId: customer.id })}
        >
          <Text style={styles.actionPrimaryText}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.actionRenew]} onPress={handleRenew}>
          <Text style={styles.actionRenewText}>Renew</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.actionDanger]} onPress={handleDelete}>
          <Text style={styles.actionDangerText}>Remove</Text>
        </Pressable>
      </View>

      {account ? (
        <Pressable style={styles.detailsToggle} onPress={() => setDetailsVisible((v) => !v)}>
          <Text style={styles.detailsToggleText}>
            {detailsVisible ? 'Hide Netflix account details' : 'View Netflix account details'}
          </Text>
        </Pressable>
      ) : null}

      {account && detailsVisible ? (
        <View style={styles.detailsCard}>
          <View style={styles.detailsCardHeader}>
            <Text style={styles.detailsCardTitle}>Account credentials</Text>
            <Pressable style={styles.copyAllButton} onPress={copyAllToClipboard}>
              <Text style={styles.copyAllButtonText}>{copiedField === 'all' ? 'Copied' : 'Copy all'}</Text>
            </Pressable>
          </View>
          <DetailRow
            label="Sign-in email"
            value={account.netflixEmail || null}
            display={account.netflixEmail || 'Not set'}
            copied={copiedField === 'email'}
            onCopy={() => copyToClipboard('email', account.netflixEmail || null)}
          />
          <DetailRow
            label="Password"
            value={accountPassword}
            display={accountPassword ? (passwordVisible ? accountPassword : '••••••••') : 'Not set'}
            copied={copiedField === 'password'}
            onCopy={() => copyToClipboard('password', accountPassword)}
            revealable
            visible={passwordVisible}
            onToggleVisible={() => setPasswordVisible((v) => !v)}
          />
          <DetailRow
            label="Profile name"
            value={account.profileNames[customer.profileSlot - 1] || null}
            display={account.profileNames[customer.profileSlot - 1] || `Profile ${customer.profileSlot}`}
            copied={copiedField === 'profile_name'}
            onCopy={() => copyToClipboard('profile_name', account.profileNames[customer.profileSlot - 1] || null)}
          />
          <DetailRow
            label="Profile PIN"
            value={profilePin}
            display={profilePin ? (pinVisible ? profilePin : '••••') : 'Not set'}
            copied={copiedField === 'pin'}
            onCopy={() => copyToClipboard('pin', profilePin)}
            revealable
            visible={pinVisible}
            onToggleVisible={() => setPinVisible((v) => !v)}
          />
        </View>
      ) : null}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Payment history</Text>
        <Pressable
          style={styles.addPaymentButton}
          onPress={() => navigation.navigate('Sales', { screen: 'PaymentForm', params: { customerId: customer.id } })}
        >
          <Text style={styles.addPaymentButtonText}>+ Add payment</Text>
        </Pressable>
      </View>
      <FlatList
        data={payments}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No payments recorded yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.paymentRow}>
            <View>
              <Text style={styles.paymentAmount}>{formatCurrency(item.amount)}</Text>
              <Text style={styles.paymentMeta}>
                {formatDate(item.datePaid)} · {formatDate(item.periodFrom)}–{formatDate(item.periodTo)}
                {item.method ? ` · ${item.method}` : ''}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

interface DetailRowProps {
  label: string;
  value: string | null;
  display: string;
  copied: boolean;
  onCopy: () => void;
  revealable?: boolean;
  visible?: boolean;
  onToggleVisible?: () => void;
}

function DetailRow({ label, value, display, copied, onCopy, revealable, visible, onToggleVisible }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueRow}>
        <Text style={styles.detailValue} numberOfLines={1}>{display}</Text>
        {revealable && value ? (
          <Pressable onPress={onToggleVisible}>
            <Text style={styles.revealLink}>{visible ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
        {value ? (
          <Pressable style={styles.copyButton} onPress={onCopy}>
            <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  summaryCard: { backgroundColor: colors.surface, borderRadius: 12, margin: 16, padding: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { color: colors.textMuted, fontSize: 14 },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  statusText: { textTransform: 'capitalize' },
  actionsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 8 },
  actionButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { color: colors.text, fontWeight: '700' },
  actionRenew: { backgroundColor: colors.success },
  actionRenewText: { color: colors.text, fontWeight: '700' },
  actionDanger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger },
  actionDangerText: { color: colors.danger, fontWeight: '700' },
  detailsToggle: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  detailsToggleText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
  },
  detailsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailsCardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  copyAllButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.primary },
  copyAllButtonText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  detailRow: { paddingVertical: 8 },
  detailLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  revealLink: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  copyButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  copyButtonText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginHorizontal: 16,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  addPaymentButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.primary },
  addPaymentButtonText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  listContent: { padding: 16, paddingBottom: 60 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  paymentRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  paymentAmount: { color: colors.text, fontSize: 16, fontWeight: '700' },
  paymentMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
