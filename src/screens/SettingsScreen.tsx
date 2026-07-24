import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { createBackup, restoreBackup } from '../db/backup';
import { colors } from '../utils/theme';
import { todayIso } from '../utils/format';

const DEVELOPER_EMAIL = 'genesiscruz.dev@gmail.com';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const appName = Constants.expoConfig?.name ?? 'NetflixSlotManager';
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);

  const handleExport = async () => {
    if (busy) return;
    setBusy('export');
    try {
      const payload = await createBackup();
      const cacheDir = new Directory(Paths.cache, 'backups');
      if (!cacheDir.exists) cacheDir.create({ intermediates: true, idempotent: true });
      const file = new File(cacheDir, `netflixslotmanager-backup-${todayIso()}.json`);
      if (file.exists) file.delete();
      file.write(JSON.stringify(payload));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save backup' });
      } else {
        Alert.alert('Backup created', `Saved to ${file.uri}`);
      }
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (picked.canceled || picked.assets.length === 0) return;

    Alert.alert(
      'Restore backup',
      "This replaces all members, accounts, and payment history currently on this device with the backup file's contents. This can't be undone. Continue?",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setBusy('restore');
            try {
              const text = await new File(picked.assets[0].uri).text();
              await restoreBackup(JSON.parse(text));
              Alert.alert('Restore complete', 'Your data has been restored.');
            } catch (err) {
              Alert.alert(
                'Restore failed',
                err instanceof Error ? err.message : 'The selected file is not a valid backup.'
              );
            } finally {
              setBusy(null);
            }
          },
        },
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

      <Text style={styles.sectionTitle}>Data</Text>
      <View style={styles.card}>
        <Text style={styles.dataHint}>
          Back up all members, accounts, payment history, and saved credentials to a file, or restore from one.
        </Text>
        <Pressable
          style={[styles.dataButton, busy && styles.dataButtonDisabled]}
          onPress={handleExport}
          disabled={busy != null}
        >
          <Text style={styles.dataButtonText}>{busy === 'export' ? 'Exporting…' : 'Export backup'}</Text>
        </Pressable>
        <Pressable
          style={[styles.dataButton, styles.dataButtonOutline, busy && styles.dataButtonDisabled]}
          onPress={handleRestore}
          disabled={busy != null}
        >
          <Text style={styles.dataButtonOutlineText}>{busy === 'restore' ? 'Restoring…' : 'Restore backup'}</Text>
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
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  dataHint: { color: colors.textMuted, fontSize: 13, padding: 14, paddingBottom: 6, lineHeight: 18 },
  dataButton: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  dataButtonText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  dataButtonOutline: {
    marginBottom: 14,
    backgroundColor: colors.surfaceAlt,
  },
  dataButtonOutlineText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  dataButtonDisabled: { opacity: 0.6 },
});
