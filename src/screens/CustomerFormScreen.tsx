import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CustomersStackParamList } from '../navigation/types';
import type { Account, Customer, CustomerStatus, NewCustomer } from '../types';
import { createCustomer, getCustomer, listCustomers, updateCustomer } from '../db/customers';
import { listAccounts } from '../db/accounts';
import DateField from '../components/DateField';
import { scheduleDueReminder, cancelDueReminder } from '../utils/notifications';
import { formatCurrency, todayIso } from '../utils/format';
import { colors } from '../utils/theme';

type Props = NativeStackScreenProps<CustomersStackParamList, 'CustomerForm'>;

const SLOTS = [1, 2, 3, 4, 5];
const STATUSES: CustomerStatus[] = ['active', 'paused', 'cancelled'];

export default function CustomerFormScreen({ navigation, route }: Props) {
  const customerId = route.params?.customerId;
  const isEditing = customerId != null;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [profileSlot, setProfileSlot] = useState(1);
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [billingDay, setBillingDay] = useState('1');
  const [joinedDate, setJoinedDate] = useState(todayIso());
  const [status, setStatus] = useState<CustomerStatus>('active');
  const [loaded, setLoaded] = useState(!isEditing);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit member' : 'Add member' });
  }, [navigation, isEditing]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAccounts(), listCustomers()]).then(([accountRows, customerRows]) => {
      if (cancelled) return;
      setAccounts(accountRows);
      setCustomers(customerRows);
      setAccountId((current) => current ?? (accountRows.length > 0 ? accountRows[0].id : null));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    getCustomer(customerId).then((customer) => {
      if (cancelled || !customer) return;
      setAccountId(customer.accountId);
      setName(customer.name);
      setContactInfo(customer.contactInfo ?? '');
      setProfileSlot(customer.profileSlot);
      setMonthlyPrice(String(customer.monthlyPrice));
      setBillingDay(String(customer.billingDay));
      setJoinedDate(customer.joinedDate);
      setStatus(customer.status);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId, isEditing]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const price = parseFloat(monthlyPrice);
    const day = parseInt(billingDay, 10);

    if (accountId == null) {
      Alert.alert('Choose an account', 'Add a Netflix account first, then assign members to its slots.');
      return;
    }
    if (!trimmedName) {
      Alert.alert('Missing name', 'Enter a name for this member.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Invalid price', 'Enter a valid monthly price.');
      return;
    }
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      Alert.alert('Invalid billing day', 'Enter a billing day between 1 and 31.');
      return;
    }

    const payload: NewCustomer = {
      accountId,
      name: trimmedName,
      contactInfo: contactInfo.trim() || null,
      profileSlot,
      monthlyPrice: price,
      billingDay: day,
      joinedDate,
      status,
    };

    let id = customerId;
    if (isEditing && customerId != null) {
      await updateCustomer(customerId, payload);
    } else {
      id = await createCustomer(payload);
    }

    if (id != null) {
      const saved: Customer = { id, ...payload };
      if (status === 'active') {
        await scheduleDueReminder(saved);
      } else {
        await cancelDueReminder(id);
      }
    }

    navigation.goBack();
  };

  const slotsFilledFor = (id: number) =>
    customers.filter((c) => c.accountId === id && c.status !== 'cancelled').length;

  if (!loaded) return null;

  if (accounts.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>
          Add a Netflix account first (Accounts tab), then come back here to assign a member to one of
          its slots.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Netflix account</Text>
      <View style={styles.accountList}>
        {accounts.map((acc) => {
          const isActive = accountId === acc.id;
          const filled = slotsFilledFor(acc.id);
          return (
            <Pressable
              key={acc.id}
              style={[styles.accountCard, isActive && styles.accountCardActive]}
              onPress={() => setAccountId(acc.id)}
            >
              <View style={styles.accountCardBody}>
                <Text style={styles.accountCardTitle}>{acc.label}</Text>
                <Text style={styles.accountCardSubtitle}>{acc.netflixEmail || 'No email set'}</Text>
                <Text style={styles.accountCardMeta}>
                  {filled} / 5 slots · {formatCurrency(acc.monthlySubscriptionCost)}/mo
                </Text>
              </View>
              <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                {isActive ? <View style={styles.radioInner} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Maria Santos"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Contact info (phone, email, etc.)</Text>
      <TextInput
        style={styles.input}
        value={contactInfo}
        onChangeText={setContactInfo}
        placeholder="Optional"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Profile slot (within the chosen account)</Text>
      <View style={styles.row}>
        {SLOTS.map((slot) => (
          <Pressable
            key={slot}
            style={[styles.chip, profileSlot === slot && styles.chipActive]}
            onPress={() => setProfileSlot(slot)}
          >
            <Text style={[styles.chipText, profileSlot === slot && styles.chipTextActive]}>{slot}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Monthly price</Text>
      <TextInput
        style={styles.input}
        value={monthlyPrice}
        onChangeText={setMonthlyPrice}
        placeholder="e.g. 4.50"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Billing day of month (1-31)</Text>
      <TextInput
        style={styles.input}
        value={billingDay}
        onChangeText={setBillingDay}
        placeholder="e.g. 15"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Joined date</Text>
      <DateField value={joinedDate} onChange={setJoinedDate} />

      <Text style={styles.label}>Status</Text>
      <View style={styles.row}>
        {STATUSES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, status === s && styles.chipActive]}
            onPress={() => setStatus(s)}
          >
            <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save changes' : 'Add member'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  emptyText: { color: colors.textMuted, padding: 20, lineHeight: 20 },
  label: { color: colors.textMuted, fontSize: 13, marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountList: { gap: 10 },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
  },
  accountCardActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  accountCardBody: { flex: 1, marginRight: 12 },
  accountCardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  accountCardSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  accountCardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: colors.text },
  saveButton: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
