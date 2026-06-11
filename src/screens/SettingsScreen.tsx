import { Linking, StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors } from '../utils/theme';

const DEVELOPER_EMAIL = 'genesiscruz.dev@gmail.com';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const appName = Constants.expoConfig?.name ?? 'NetflixSlotManager';
  const version = Constants.expoConfig?.version ?? '1.0.0';

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
});
