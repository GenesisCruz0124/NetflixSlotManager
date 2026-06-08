import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CustomersStackParamList } from '../navigation/types';
import type { Account, Customer } from '../types';
import { listCustomers } from '../db/customers';
import { listAccounts } from '../db/accounts';
import { colors } from '../utils/theme';
import { formatCurrency } from '../utils/format';

type Props = NativeStackScreenProps<CustomersStackParamList, 'CustomersList'>;

const STATUS_COLORS: Record<Customer['status'], string> = {
  active: colors.success,
  paused: colors.warning,
  cancelled: colors.danger,
};

export default function CustomersListScreen({ navigation }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listCustomers(), listAccounts()]).then(([customerRows, accountRows]) => {
        if (cancelled) return;
        setCustomers(customerRows);
        setAccounts(accountRows);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const accountById = useMemo(() => {
    const map = new Map<number, Account>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const slotsTaken = customers.filter((c) => c.status !== 'cancelled').length;
  const totalSlots = accounts.length * 5;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Members</Text>
        <Text style={styles.headerSubtitle}>
          {slotsTaken} / {totalSlots} slots in use across {accounts.length} account{accounts.length === 1 ? '' : 's'}
        </Text>
      </View>

      <FlatList
        data={customers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No members yet. Add a Netflix account first, then add members and assign them to its slots.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
          >
            <View style={styles.slotBadge}>
              <Text style={styles.slotBadgeText}>{item.profileSlot}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSubtitle}>
                {accountById.get(item.accountId)?.label ?? 'Unknown account'} · {formatCurrency(item.monthlyPrice)} / mo · bills on day {item.billingDay}
              </Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('CustomerForm', undefined)}>
        <Text style={styles.fabText}>+ Add member</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { color: colors.text, fontSize: 28, fontWeight: '700' },
  headerSubtitle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  listContent: { padding: 16, paddingBottom: 100 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  slotBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  slotBadgeText: { color: colors.text, fontWeight: '700' },
  cardBody: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cardSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  fabText: { color: colors.text, fontWeight: '700', fontSize: 15 },
});
