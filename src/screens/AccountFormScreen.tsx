import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountsStackParamList } from '../navigation/types';
import type { NewAccount } from '../types';
import { createAccount, getAccount, getStoredPassword, setStoredPassword, updateAccount } from '../db/accounts';
import { colors } from '../utils/theme';

type Props = NativeStackScreenProps<AccountsStackParamList, 'AccountForm'>;

export default function AccountFormScreen({ navigation, route }: Props) {
  const accountId = route.params?.accountId;
  const isEditing = accountId != null;

  const [label, setLabel] = useState('');
  const [netflixEmail, setNetflixEmail] = useState('');
  const [password, setPassword] = useState('');
  const [monthlyCost, setMonthlyCost] = useState('');
  const [loaded, setLoaded] = useState(!isEditing);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit account' : 'Add account' });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    Promise.all([getAccount(accountId), getStoredPassword(accountId)]).then(([account, storedPassword]) => {
      if (cancelled || !account) return;
      setLabel(account.label);
      setNetflixEmail(account.netflixEmail);
      setMonthlyCost(String(account.monthlySubscriptionCost));
      setPassword(storedPassword ?? '');
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, isEditing]);

  const handleSave = async () => {
    const trimmedLabel = label.trim();
    const cost = parseFloat(monthlyCost) || 0;

    if (!trimmedLabel) {
      Alert.alert('Missing name', 'Give this account a label, e.g. "Family plan" or "Account A".');
      return;
    }

    let id = accountId;
    if (isEditing && accountId != null) {
      const existing = await getAccount(accountId);
      const payload: NewAccount = {
        label: trimmedLabel,
        netflixEmail: netflixEmail.trim(),
        profileNames: existing?.profileNames ?? ['', '', '', '', ''],
        monthlySubscriptionCost: cost,
      };
      await updateAccount(accountId, payload);
    } else {
      const payload: NewAccount = {
        label: trimmedLabel,
        netflixEmail: netflixEmail.trim(),
        profileNames: ['', '', '', '', ''],
        monthlySubscriptionCost: cost,
      };
      id = await createAccount(payload);
    }

    if (id != null && password) {
      await setStoredPassword(id, password);
    }

    navigation.goBack();
  };

  if (!loaded) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Account label</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder='e.g. "Family plan" or "Account A"'
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Netflix sign-in email</Text>
      <TextInput
        style={styles.input}
        value={netflixEmail}
        onChangeText={setNetflixEmail}
        placeholder="account@example.com"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Password (stored encrypted on this device)</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Current password"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        secureTextEntry
      />

      <Text style={styles.label}>Your monthly Netflix subscription cost</Text>
      <TextInput
        style={styles.input}
        value={monthlyCost}
        onChangeText={setMonthlyCost}
        placeholder="e.g. 15.49"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
      />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save changes' : 'Add account'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
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
  saveButton: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
