import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { getDb } from './src/db/database';
import { colors } from './src/utils/theme';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(() => setReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <SafeAreaProvider>
      {error ? (
        <View style={styles.loading}>
          <Text style={styles.errorText}>Couldn't open the local database:</Text>
          <Text style={styles.errorDetail}>{error}</Text>
        </View>
      ) : !ready ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <View style={styles.container}>
          <StatusBar style="light" />
          <RootNavigator />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  errorText: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  errorDetail: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});
