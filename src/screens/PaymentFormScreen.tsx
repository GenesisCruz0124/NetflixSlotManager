import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SalesStackParamList } from '../navigation/types';
import type { Customer } from '../types';
import { listCustomers } from '../db/customers';
import { createPayment, deletePayment, getPayment, listPaymentsForCustomer, updatePayment } from '../db/payments';
import DateField from '../components/DateField';
import MonthField from '../components/MonthField';
import { currentPeriod, formatCurrency, formatDate, todayIso } from '../utils/format';
import { colors } from '../utils/theme';

type Props = NativeStackScreenProps<SalesStackParamList, 'PaymentForm'>;

const PROOF_DIR_NAME = 'payment_proofs';

async function persistProofImage(pickedUri: string): Promise<string> {
  const dir = new Directory(Paths.document, PROOF_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const extensionMatch = /\.(\w+)$/.exec(pickedUri);
  const extension = extensionMatch ? extensionMatch[1] : 'jpg';
  const dest = new File(dir, `proof_${Date.now()}.${extension}`);
  new File(pickedUri).copy(dest);
  return dest.uri;
}

function deleteProofImage(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best-effort cleanup — a missing/locked file shouldn't block the user.
  }
}

export default function PaymentFormScreen({ navigation, route }: Props) {
  const paymentId = route.params?.paymentId;
  const isEditing = paymentId != null;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(route.params?.customerId ?? null);
  const [amount, setAmount] = useState('');
  const [datePaid, setDatePaid] = useState(todayIso());
  const [periodCovered, setPeriodCovered] = useState(currentPeriod());
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [originalProofImage, setOriginalProofImage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!isEditing);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit payment' : 'Log payment' });
  }, [navigation, isEditing]);

  useEffect(() => {
    listCustomers().then((rows) => {
      setCustomers(rows);
      if (customerId == null && !isEditing && rows.length > 0) {
        setCustomerId(rows[0].id);
        setAmount(String(rows[0].monthlyPrice));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    getPayment(paymentId).then((payment) => {
      if (cancelled || !payment) return;
      setCustomerId(payment.customerId);
      setAmount(String(payment.amount));
      setDatePaid(payment.datePaid);
      setPeriodCovered(payment.periodCovered);
      setMethod(payment.method ?? '');
      setNotes(payment.notes ?? '');
      setProofImage(payment.proofImage);
      setOriginalProofImage(payment.proofImage);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isEditing, paymentId]);

  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    if (!amount) setAmount(String(customer.monthlyPrice));
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(memberQuery.trim().toLowerCase())
  );
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach a payment proof image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
    });
    if (result.canceled || result.assets.length === 0) return;

    const persistedUri = await persistProofImage(result.assets[0].uri);
    if (proofImage && proofImage !== originalProofImage) {
      deleteProofImage(proofImage);
    }
    setProofImage(persistedUri);
  };

  const handleRemovePhoto = () => {
    if (!proofImage) return;
    if (proofImage !== originalProofImage) {
      deleteProofImage(proofImage);
    }
    setProofImage(null);
  };

  const handleDelete = () => {
    if (paymentId == null) return;
    Alert.alert('Remove payment', "Remove this payment record? This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deletePayment(paymentId);
          deleteProofImage(originalProofImage);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (customerId == null) {
      Alert.alert('Choose a member', 'Select who made this payment.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid payment amount.');
      return;
    }
    const trimmedPeriod = periodCovered.trim();
    if (!trimmedPeriod) {
      Alert.alert('Missing period', 'Enter which billing period this payment covers, e.g. 2026-06.');
      return;
    }

    const id = customerId;
    const submit = async () => {
      const payload = {
        customerId: id,
        amount: parsedAmount,
        datePaid,
        periodCovered: trimmedPeriod,
        method: method.trim() || null,
        notes: notes.trim() || null,
        proofImage,
      };

      if (isEditing && paymentId != null) {
        await updatePayment(paymentId, payload);
        if (originalProofImage && originalProofImage !== proofImage) {
          deleteProofImage(originalProofImage);
        }
      } else {
        await createPayment(payload);
      }
      navigation.goBack();
    };

    if (!isEditing) {
      const existingForPeriod = (await listPaymentsForCustomer(id)).filter(
        (p) => p.periodCovered === trimmedPeriod
      );

      if (existingForPeriod.length > 0) {
        const customerName = customers.find((c) => c.id === id)?.name ?? 'This member';
        const summary = existingForPeriod
          .map((p) => `${formatCurrency(p.amount)} on ${formatDate(p.datePaid)}`)
          .join(', ');
        Alert.alert(
          'Possible double payment',
          `${customerName} already has ${existingForPeriod.length === 1 ? 'a payment' : 'payments'} logged for ${trimmedPeriod}: ${summary}. Log this one too?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log anyway', style: 'destructive', onPress: () => { submit(); } },
          ]
        );
        return;
      }
    }

    await submit();
  };

  if (!loaded) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Member</Text>
      {customers.length === 0 ? (
        <Text style={styles.emptyText}>Add a member first before logging a payment.</Text>
      ) : (
        <View>
          {selectedCustomer ? (
            <View style={styles.selectedMemberBanner}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{selectedCustomer.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.memberBody}>
                <Text style={styles.memberName}>{selectedCustomer.name}</Text>
                <Text style={styles.memberMeta}>
                  Slot {selectedCustomer.profileSlot} · {formatCurrency(selectedCustomer.monthlyPrice)}/mo
                </Text>
              </View>
            </View>
          ) : null}

          <TextInput
            style={styles.searchInput}
            value={memberQuery}
            onChangeText={setMemberQuery}
            placeholder="Search members by name…"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.memberList}>
            {filteredCustomers.length === 0 ? (
              <Text style={styles.emptyText}>No members match “{memberQuery}”.</Text>
            ) : (
              filteredCustomers.map((c) => {
                const active = customerId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.memberCard, active && styles.memberCardActive]}
                    onPress={() => selectCustomer(c)}
                  >
                    <View style={[styles.memberAvatar, active && styles.memberAvatarActive]}>
                      <Text style={styles.memberAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.memberBody}>
                      <Text style={styles.memberName}>{c.name}</Text>
                      <Text style={styles.memberMeta}>
                        Slot {c.profileSlot} · {formatCurrency(c.monthlyPrice)}/mo
                      </Text>
                    </View>
                    {active ? <Text style={styles.memberCheck}>✓</Text> : null}
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      )}

      <Text style={styles.label}>Amount received</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="e.g. 4.50"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Date paid</Text>
      <DateField value={datePaid} onChange={setDatePaid} />

      <Text style={styles.label}>Billing period covered</Text>
      <MonthField value={periodCovered} onChange={setPeriodCovered} />

      <Text style={styles.label}>Method (optional)</Text>
      <TextInput
        style={styles.input}
        value={method}
        onChangeText={setMethod}
        placeholder="e.g. Cash, GCash, Bank transfer"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={styles.input}
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Proof of payment (optional)</Text>
      {proofImage ? (
        <View style={styles.proofPreviewWrap}>
          <Image source={{ uri: proofImage }} style={styles.proofPreview} resizeMode="cover" />
          <View style={styles.proofActionsRow}>
            <Pressable style={styles.proofActionButton} onPress={handlePickPhoto}>
              <Text style={styles.proofActionButtonText}>Replace photo</Text>
            </Pressable>
            <Pressable style={[styles.proofActionButton, styles.proofRemoveButton]} onPress={handleRemovePhoto}>
              <Text style={styles.proofRemoveButtonText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.attachButton} onPress={handlePickPhoto}>
          <Text style={styles.attachButtonText}>Attach photo from gallery…</Text>
        </Pressable>
      )}

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save changes' : 'Log payment'}</Text>
      </Pressable>

      {isEditing ? (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Remove payment</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  label: { color: colors.textMuted, fontSize: 13, marginTop: 16, marginBottom: 6 },
  emptyText: { color: colors.textMuted },
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
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  selectedMemberBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  memberList: { gap: 8 },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberCardActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarActive: { backgroundColor: colors.primary },
  memberAvatarText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  memberBody: { flex: 1 },
  memberName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  memberMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  memberCheck: { color: colors.primary, fontWeight: '700', fontSize: 18 },
  attachButton: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  attachButtonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  proofPreviewWrap: { gap: 10 },
  proofPreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  proofActionsRow: { flexDirection: 'row', gap: 10 },
  proofActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  proofActionButtonText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  proofRemoveButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger },
  proofRemoveButtonText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  saveButton: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  deleteButton: {
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteButtonText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
