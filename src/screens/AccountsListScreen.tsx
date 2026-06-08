import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountsStackParamList } from '../navigation/types';
import type { Account, Customer } from '../types';
import { listAccounts } from '../db/accounts';
import { listCustomers } from '../db/customers';
import { colors } from '../utils/theme';
import { formatCurrency } from '../utils/format';

type Props = NativeStackScreenProps<AccountsStackParamList, 'AccountsList'>;

export default function AccountsListScreen({ navigation }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listAccounts(), listCustomers()]).then(([accountRows, customerRows]) => {
        if (cancelled) return;
        setAccounts(accountRows);
        setCustomers(customerRows);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const slotsFilledFor = (accountId: number) =>
    customers.filter((c) => c.accountId === accountId && c.status !== 'cancelled').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Netflix accounts</Text>
        <Text style={styles.headerSubtitle}>{accounts.length} account{accounts.length === 1 ? '' : 's'} managed</Text>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No accounts yet. Add the Netflix account(s) you manage to start assigning members to slots.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('AccountDetail', { accountId: item.id })}>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardSubtitle}>{item.netflixEmail || 'No email set'}</Text>
              <Text style={styles.cardMeta}>
                {slotsFilledFor(item.id)} / 5 slots · {formatCurrency(item.monthlySubscriptionCost)}/mo cost
              </Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AccountForm', undefined)}>
        <Text style={styles.fabText}>+ Add account</Text>
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
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 10 },
  cardBody: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cardSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  cardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
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
