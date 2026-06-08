import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountsStackParamList } from '../navigation/types';
import type { Account, ChangeLogEntry, Customer } from '../types';
import {
  clearProfilePin,
  deleteAccount,
  getAccount,
  getProfilePins,
  getStoredPassword,
  listChangeLog,
  setProfilePin,
} from '../db/accounts';
import { listCustomersForAccount } from '../db/customers';
import { colors } from '../utils/theme';
import { formatCurrency } from '../utils/format';

type Props = NativeStackScreenProps<AccountsStackParamList, 'AccountDetail'>;

export default function AccountDetailScreen({ navigation, route }: Props) {
  const { accountId } = route.params;
  const [account, setAccount] = useState<Account | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [members, setMembers] = useState<Customer[]>([]);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [pins, setPins] = useState<(string | null)[]>([null, null, null, null, null]);
  const [visiblePinSlots, setVisiblePinSlots] = useState<Set<number>>(new Set());
  const [editingPinSlot, setEditingPinSlot] = useState<number | null>(null);
  const [pinDraft, setPinDraft] = useState('');

  const load = useCallback(async () => {
    const [accountRow, storedPassword, memberRows, log, profilePins] = await Promise.all([
      getAccount(accountId),
      getStoredPassword(accountId),
      listCustomersForAccount(accountId),
      listChangeLog(accountId),
      getProfilePins(accountId),
    ]);
    setAccount(accountRow);
    setPassword(storedPassword);
    setMembers(memberRows);
    setChangeLog(log);
    setPins(profilePins);
    navigation.setOptions({ title: accountRow?.label ?? 'Account' });
  }, [accountId, navigation]);

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

  const handleDelete = () => {
    if (!account) return;
    Alert.alert(
      'Remove account',
      `Remove "${account.label}" along with its members and history? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteAccount(account.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const togglePinVisible = (slotIndex: number) => {
    setVisiblePinSlots((current) => {
      const next = new Set(current);
      if (next.has(slotIndex)) {
        next.delete(slotIndex);
      } else {
        next.add(slotIndex);
      }
      return next;
    });
  };

  const startEditPin = (slotIndex: number) => {
    setEditingPinSlot(slotIndex);
    setPinDraft(pins[slotIndex] ?? '');
  };

  const cancelEditPin = () => {
    setEditingPinSlot(null);
    setPinDraft('');
  };

  const saveEditPin = async () => {
    if (editingPinSlot == null || !account) return;
    const trimmed = pinDraft.trim();
    if (trimmed && !/^\d{4}$/.test(trimmed)) {
      Alert.alert('Invalid PIN', 'Profile PINs are 4 digits, e.g. 1234. Leave it blank to clear the PIN.');
      return;
    }

    const slotIndex = editingPinSlot;
    if (trimmed) {
      await setProfilePin(account.id, slotIndex, trimmed);
    } else {
      await clearProfilePin(account.id, slotIndex);
    }
    setPins((current) => {
      const next = [...current];
      next[slotIndex] = trimmed || null;
      return next;
    });
    cancelEditPin();
  };

  if (!account) return null;

  const memberBySlot = new Map(members.map((m) => [m.profileSlot, m]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sign-in email</Text>
          <Text style={styles.summaryValue}>{account.netflixEmail || 'Not set'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Password</Text>
          <View style={styles.passwordValueRow}>
            <Text style={styles.summaryValue}>
              {password ? (passwordVisible ? password : '••••••••') : 'Not set'}
            </Text>
            {password ? (
              <Pressable onPress={() => setPasswordVisible((v) => !v)}>
                <Text style={styles.revealLink}>{passwordVisible ? 'Hide' : 'Show'}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subscription cost</Text>
          <Text style={styles.summaryValue}>{formatCurrency(account.monthlySubscriptionCost)}/mo</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, styles.actionPrimary]}
          onPress={() => navigation.navigate('AccountForm', { accountId: account.id })}
        >
          <Text style={styles.actionPrimaryText}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.actionDanger]} onPress={handleDelete}>
          <Text style={styles.actionDangerText}>Remove</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.changePasswordButton}
        onPress={() => navigation.navigate('AutomationRunner', { accountId: account.id, mode: 'password' })}
      >
        <Text style={styles.changePasswordButtonText}>Change password on Netflix…</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Profiles & members</Text>
      {account.profileNames.map((name, i) => {
        const slot = i + 1;
        const member = memberBySlot.get(slot);
        const pin = pins[i];
        const pinVisible = visiblePinSlots.has(i);
        const isEditingPin = editingPinSlot === i;
        return (
          <View key={i} style={styles.profileRow}>
            <View style={styles.profileTopRow}>
              <View style={styles.profileSlotBadge}>
                <Text style={styles.profileSlotBadgeText}>{slot}</Text>
              </View>
              <View style={styles.profileBody}>
                <Text style={styles.profileName}>{name || `Profile ${slot}`}</Text>
                <Text style={styles.profileMeta}>{member ? `Assigned to ${member.name}` : 'No member assigned'}</Text>
              </View>
              <Pressable
                style={styles.smallActionButton}
                onPress={() => navigation.navigate('AutomationRunner', { accountId: account.id, mode: 'profile_name', profileSlot: slot })}
              >
                <Text style={styles.smallActionButtonText}>Rename</Text>
              </Pressable>
            </View>

            <View style={styles.pinRow}>
              <Text style={styles.pinLabel}>PIN</Text>
              {isEditingPin ? (
                <View style={styles.pinEditRow}>
                  <TextInput
                    style={styles.pinInput}
                    value={pinDraft}
                    onChangeText={setPinDraft}
                    placeholder="4-digit PIN"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    autoFocus
                  />
                  <Pressable style={styles.pinSaveButton} onPress={saveEditPin}>
                    <Text style={styles.pinSaveButtonText}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.pinCancelButton} onPress={cancelEditPin}>
                    <Text style={styles.pinCancelButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.pinValueRow}>
                  <Text style={styles.pinValue}>{pin ? (pinVisible ? pin : '••••') : 'Not set'}</Text>
                  {pin ? (
                    <Pressable onPress={() => togglePinVisible(i)}>
                      <Text style={styles.revealLink}>{pinVisible ? 'Hide' : 'Show'}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.smallActionButton} onPress={() => startEditPin(i)}>
                    <Text style={styles.smallActionButtonText}>{pin ? 'Edit PIN' : 'Set PIN'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Change history</Text>
      {changeLog.length === 0 ? (
        <Text style={styles.emptyText}>No changes logged yet.</Text>
      ) : (
        changeLog.map((entry) => (
          <View key={entry.id} style={styles.logRow}>
            <Text style={styles.logTitle}>
              {entry.type === 'password' ? 'Password changed' : `Profile ${entry.profileSlot} renamed`}
            </Text>
            <Text style={styles.logMeta}>
              {new Date(entry.timestamp).toLocaleString()} · {entry.result.replace('-', ' ')}
            </Text>
            {entry.newValue ? <Text style={styles.logValue}>New value: {entry.newValue}</Text> : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  summaryCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  summaryLabel: { color: colors.textMuted, fontSize: 14 },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  passwordValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  revealLink: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actionButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  actionPrimary: { backgroundColor: colors.surfaceAlt },
  actionPrimaryText: { color: colors.text, fontWeight: '700' },
  actionDanger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger },
  actionDangerText: { color: colors.danger, fontWeight: '700' },
  changePasswordButton: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  changePasswordButtonText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  profileRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  profileTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pinLabel: { color: colors.textMuted, fontSize: 13, width: 32 },
  pinValueRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinValue: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  pinEditRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinSaveButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.primary },
  pinSaveButtonText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  pinCancelButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  pinCancelButtonText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  profileSlotBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSlotBadgeText: { color: colors.text, fontWeight: '700' },
  profileBody: { flex: 1 },
  profileName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  profileMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  smallActionButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  smallActionButtonText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  emptyText: { color: colors.textMuted },
  logRow: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
  logTitle: { color: colors.text, fontWeight: '600', fontSize: 14 },
  logMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  logValue: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
