import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { File } from 'expo-file-system';
import type { SalesStackParamList } from '../navigation/types';
import type { Customer, Payment } from '../types';
import { listCustomers } from '../db/customers';
import { deletePayment, listPayments } from '../db/payments';
import { colors } from '../utils/theme';
import { formatCurrency, formatDate } from '../utils/format';

function deleteProofImage(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best-effort cleanup — a missing/locked file shouldn't block the user.
  }
}

type Props = NativeStackScreenProps<SalesStackParamList, 'PaymentsList'>;

export default function PaymentsListScreen({ navigation }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const load = useCallback(async () => {
    const [paymentRows, customerRows] = await Promise.all([listPayments(), listCustomers()]);
    setPayments(paymentRows);
    setCustomers(customerRows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load().then(() => {
        if (cancelled) return;
      });
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const customerById = useMemo(() => {
    const map = new Map<number, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  const handleDelete = (payment: Payment) => {
    const customer = customerById.get(payment.customerId);
    Alert.alert(
      'Remove payment',
      `Remove the ${formatCurrency(payment.amount)} payment from ${customer ? customer.name : 'this member'}? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deletePayment(payment.id);
            deleteProofImage(payment.proofImage);
            load();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sales</Text>
        <Text style={styles.headerSubtitle}>
          {payments.length} payments · {formatCurrency(total)} total received
        </Text>
      </View>

      <FlatList
        data={payments}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No payments recorded yet. Log one when a member pays.</Text>
        }
        renderItem={({ item }) => {
          const customer = customerById.get(item.customerId);
          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('PaymentForm', { paymentId: item.id })}
            >
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{customer ? customer.name : 'Unknown member'}</Text>
                <Text style={styles.cardSubtitle}>
                  {formatDate(item.datePaid)} · for {item.periodCovered}
                  {item.method ? ` · ${item.method}` : ''}
                  {item.proofImage ? ' · 📎 proof attached' : ''}
                </Text>
              </View>
              <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
              <Pressable
                style={styles.deleteIconButton}
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDelete(item);
                }}
              >
                <Text style={styles.deleteIconButtonText}>✕</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('PaymentForm', undefined)}>
        <Text style={styles.fabText}>+ Log payment</Text>
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
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardBody: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cardSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  cardAmount: { color: colors.success, fontSize: 16, fontWeight: '700', marginRight: 4 },
  deleteIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    marginLeft: 10,
  },
  deleteIconButtonText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
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
