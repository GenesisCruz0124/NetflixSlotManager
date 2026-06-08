import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../navigation/types';
import type { Account, Customer, Payment } from '../types';
import { listCustomers } from '../db/customers';
import { listPayments } from '../db/payments';
import { listAccounts } from '../db/accounts';
import { colors } from '../utils/theme';
import { currentPeriod, daysUntilNextBilling, formatCurrency } from '../utils/format';

type Props = BottomTabScreenProps<RootTabParamList, 'Dashboard'>;

export default function DashboardScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listCustomers(), listPayments(), listAccounts()]).then(
        ([customerRows, paymentRows, accountRows]) => {
          if (cancelled) return;
          setCustomers(customerRows);
          setPayments(paymentRows);
          setAccounts(accountRows);
        }
      );
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const stats = useMemo(() => {
    const period = currentPeriod();
    const activeCustomers = customers.filter((c) => c.status === 'active');

    const revenueThisPeriod = payments
      .filter((p) => p.periodCovered === period)
      .reduce((sum, p) => sum + p.amount, 0);

    const paidCustomerIds = new Set(
      payments.filter((p) => p.periodCovered === period).map((p) => p.customerId)
    );
    const outstanding = activeCustomers.filter((c) => !paidCustomerIds.has(c.id));

    const upcoming = activeCustomers
      .map((c) => ({ customer: c, days: daysUntilNextBilling(c.billingDay) }))
      .filter(({ days }) => days <= 7)
      .sort((a, b) => a.days - b.days);

    const expectedRevenue = activeCustomers.reduce((sum, c) => sum + c.monthlyPrice, 0);
    const subscriptionCost = accounts.reduce((sum, a) => sum + a.monthlySubscriptionCost, 0);
    const netProfit = expectedRevenue - subscriptionCost;
    const totalSlots = accounts.length * 5;

    return {
      activeCustomers,
      revenueThisPeriod,
      outstanding,
      upcoming,
      expectedRevenue,
      subscriptionCost,
      netProfit,
      totalSlots,
    };
  }, [customers, payments, accounts]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.headerTitle}>Dashboard</Text>
      <Text style={styles.headerSubtitle}>{currentPeriod()} overview</Text>

      <View style={styles.statsRow}>
        <StatCard label="Slots filled" value={`${stats.activeCustomers.length} / ${stats.totalSlots}`} />
        <StatCard label="Collected this month" value={formatCurrency(stats.revenueThisPeriod)} accent={colors.success} />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Expected monthly revenue" value={formatCurrency(stats.expectedRevenue)} />
        <StatCard
          label="Est. net profit / mo"
          value={formatCurrency(stats.netProfit)}
          accent={stats.netProfit >= 0 ? colors.success : colors.danger}
        />
      </View>

      <Section title={`Outstanding for ${currentPeriod()} (${stats.outstanding.length})`}>
        {stats.outstanding.length === 0 ? (
          <Text style={styles.emptyText}>Everyone active has paid for this period. Nice.</Text>
        ) : (
          stats.outstanding.map((c) => (
            <Row key={c.id} left={c.name} right={formatCurrency(c.monthlyPrice)} accent={colors.warning} />
          ))
        )}
      </Section>

      <Section title="Renewals due within 7 days">
        {stats.upcoming.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming renewals in the next week.</Text>
        ) : (
          stats.upcoming.map(({ customer, days }) => (
            <Row
              key={customer.id}
              left={customer.name}
              right={days === 0 ? 'Due today' : `in ${days} day${days === 1 ? '' : 's'}`}
              accent={days <= 1 ? colors.danger : colors.warning}
            />
          ))
        )}
      </Section>

      <Section title={`Netflix accounts (${accounts.length})`}>
        {accounts.length === 0 ? (
          <Text style={styles.emptyText}>No Netflix accounts yet. Add one from the Accounts tab.</Text>
        ) : (
          <>
            <Row left="Combined monthly cost" right={formatCurrency(stats.subscriptionCost)} />
            {accounts.map((a) => (
              <Row key={a.id} left={a.label} right={formatCurrency(a.monthlySubscriptionCost)} />
            ))}
          </>
        )}
      </Section>
    </ScrollView>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ left, right, accent }: { left: string; right: string; accent?: string }) {
  return (
    <View style={styles.itemRow}>
      <Text style={styles.itemLeft}>{left}</Text>
      <Text style={[styles.itemRight, accent ? { color: accent } : null]}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  headerTitle: { color: colors.text, fontSize: 28, fontWeight: '700' },
  headerSubtitle: { color: colors.textMuted, fontSize: 14, marginTop: 2, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 6 },
  section: { marginTop: 20 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sectionBody: { backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
  emptyText: { color: colors.textMuted, padding: 14 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemLeft: { color: colors.text, fontSize: 14 },
  itemRight: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
