import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { exportBackup, restoreBackup } from '../db/backup';
import { colors } from '../utils/theme';

const DEVELOPER_EMAIL = 'genesiscruz.dev@gmail.com';

type BusyState = 'export' | 'restore' | null;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const appName = Constants.expoConfig?.name ?? 'NetflixSlotManager';
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const [busy, setBusy] = useState<BusyState>(null);

  const handleExport = async () => {
    setBusy('export');
    try {
      const file = await exportBackup();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Save NetflixSlotManager backup',
        });
      } else {
        Alert.alert('Backup created', `Saved to ${file.uri}`);
      }
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const runRestore = async (uri: string) => {
    setBusy('restore');
    try {
      const json = await new File(uri).text();
      const summary = await restoreBackup(json);
      Alert.alert(
        'Restore complete',
        `Restored ${summary.accounts} account(s), ${summary.customers} member(s), and ${summary.payments} payment(s). Switch tabs to see the restored data.`
      );
    } catch (err) {
      Alert.alert('Restore failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];

    Alert.alert(
      'Restore backup',
      'This replaces all accounts, members, payments, and history currently on this device with the contents of this backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: () => runRestore(asset.uri) },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.headerTitle}>Settings</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>App name</Text>
          <Text style={styles.value}>{appName}</Text>
        </View>
        <View style={[styles.row, styles.rowBorder]}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>{version}</Text>
        </View>
        <Pressable style={[styles.row, styles.rowBorder]} onPress={() => Linking.openURL(`mailto:${DEVELOPER_EMAIL}`)}>
          <Text style={styles.label}>Developer</Text>
          <Text style={[styles.value, styles.link]}>{DEVELOPER_EMAIL}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Backup & restore</Text>
      <Text style={styles.sectionHint}>
        Export everything — accounts, members, payments, history, passwords and PINs — to a single file, or restore
        from one.
      </Text>
      <View style={styles.card}>
        <Pressable
          style={styles.row}
          onPress={handleExport}
          disabled={busy !== null}
        >
          <Text style={[styles.value, styles.actionText]}>Export backup</Text>
          {busy === 'export' ? <ActivityIndicator color={colors.primary} /> : null}
        </Pressable>
        <Pressable
          style={[styles.row, styles.rowBorder]}
          onPress={handleRestore}
          disabled={busy !== null}
        >
          <Text style={[styles.value, styles.actionText, styles.dangerText]}>Restore from backup…</Text>
          {busy === 'restore' ? <ActivityIndicator color={colors.danger} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  headerTitle: { color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  label: { color: colors.textMuted, fontSize: 14 },
  value: { color: colors.text, fontSize: 14, fontWeight: '600' },
  link: { color: colors.primary },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  sectionHint: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  actionText: { color: colors.primary },
  dangerText: { color: colors.danger },
});
