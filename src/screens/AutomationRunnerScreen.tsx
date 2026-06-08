import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountsStackParamList } from '../navigation/types';
import type { ChangeLogResult } from '../types';
import {
  addChangeLogEntry,
  getAccount,
  getStoredPassword,
  setStoredPassword,
  updateProfileName,
} from '../db/accounts';
import { colors } from '../utils/theme';

type Props = NativeStackScreenProps<AccountsStackParamList, 'AutomationRunner'>;

const NETFLIX_LOGIN_URL = 'https://www.netflix.com/login';
const NETFLIX_ACCOUNT_URL = 'https://www.netflix.com/account';

/**
 * Best-effort autofill only — Netflix's markup changes over time and the site can
 * block scripted logins with CAPTCHA / device-verification, so this is a head start
 * for the login step, not a guarantee. Everything past sign-in is done by hand.
 */
const AUTOFILL_SCRIPT = (email: string, password: string) => `
(function () {
  function fill(selector, value) {
    var el = document.querySelector(selector);
    if (el && value) {
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }
  fill('input[name="userLoginId"]', ${JSON.stringify(email)});
  fill('input[type="email"]', ${JSON.stringify(email)});
  fill('input[name="password"]', ${JSON.stringify(password)});
  fill('input[type="password"]', ${JSON.stringify(password)});
  true;
})();
`;

const STEPS_BY_MODE: Record<Props['route']['params']['mode'], string[]> = {
  password: [
    'We try to pre-fill your stored email & password on the Netflix sign-in page.',
    'Sign in (solve any CAPTCHA / verification Netflix shows — we cannot do this part for you).',
    'Go to Account → Sign-in & Security → Change password, and set the new one.',
    'Come back here and record the new password so your local copy stays in sync.',
  ],
  profile_name: [
    'We try to pre-fill your stored email & password on the Netflix sign-in page.',
    'Sign in (solve any CAPTCHA / verification Netflix shows — we cannot do this part for you).',
    'Go to Manage Profiles → select the profile → edit its name → save.',
    'Come back here and record the new name so your local copy stays in sync.',
  ],
};

export default function AutomationRunnerScreen({ navigation, route }: Props) {
  const { accountId, mode, profileSlot } = route.params;
  const webviewRef = useRef<WebView>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    navigation.setOptions({
      title: mode === 'password' ? 'Change password' : `Change profile ${profileSlot} name`,
    });
  }, [navigation, mode, profileSlot]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAccount(accountId), getStoredPassword(accountId)]).then(([account, password]) => {
      if (cancelled) return;
      setCredentials({ email: account?.netflixEmail ?? '', password: password ?? '' });
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const steps = STEPS_BY_MODE[mode];

  const handleRecord = async (result: ChangeLogResult) => {
    const trimmed = newValue.trim();
    if (result !== 'failed' && !trimmed) {
      Alert.alert('Enter the new value', 'Type the new password / profile name to save it locally.');
      return;
    }

    const timestamp = new Date().toISOString();

    if (mode === 'password') {
      await addChangeLogEntry({
        accountId,
        type: 'password',
        profileSlot: null,
        oldValue: credentials?.password ?? null,
        newValue: result === 'failed' ? null : trimmed,
        timestamp,
        result,
      });
      if (result !== 'failed') {
        await setStoredPassword(accountId, trimmed);
      }
    } else {
      const account = await getAccount(accountId);
      const slotIndex = (profileSlot ?? 1) - 1;
      const previousName = account?.profileNames[slotIndex] ?? null;
      await addChangeLogEntry({
        accountId,
        type: 'profile_name',
        profileSlot: profileSlot ?? null,
        oldValue: previousName,
        newValue: result === 'failed' ? null : trimmed,
        timestamp,
        result,
      });
      if (result !== 'failed') {
        await updateProfileName(accountId, slotIndex, trimmed);
      }
    }

    Alert.alert('Logged', 'The change has been recorded in your local history.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Guided, not automatic</Text>
        <Text style={styles.bannerText}>
          Netflix has no API for this and blocks bots, so this opens a real browser, tries to fill in
          your sign-in details, and lets you finish the rest by hand. Nothing changes on Netflix until
          you do it yourself in the browser below.
        </Text>
      </View>

      <View style={styles.steps}>
        {steps.map((step, i) => (
          <Text key={i} style={styles.stepText}>
            {i + 1}. {step}
          </Text>
        ))}
      </View>

      <View style={styles.webviewWrapper}>
        {credentials ? (
          <WebView
            ref={webviewRef}
            source={{ uri: mode === 'password' ? NETFLIX_LOGIN_URL : NETFLIX_LOGIN_URL }}
            injectedJavaScript={AUTOFILL_SCRIPT(credentials.email, credentials.password)}
            onLoadEnd={() => {
              webviewRef.current?.injectJavaScript(AUTOFILL_SCRIPT(credentials.email, credentials.password));
            }}
            style={styles.webview}
          />
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => webviewRef.current?.injectJavaScript('window.location.href = ' + JSON.stringify(NETFLIX_ACCOUNT_URL) + '; true;')}
        >
          <Text style={styles.secondaryButtonText}>Go to Account page</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={() => setShowRecordForm((v) => !v)}>
          <Text style={styles.primaryButtonText}>I finished the change</Text>
        </Pressable>
      </View>

      {showRecordForm ? (
        <View style={styles.recordPanel}>
          <Text style={styles.label}>
            New {mode === 'password' ? 'password' : 'profile name'}
          </Text>
          <TextInput
            style={styles.input}
            value={newValue}
            onChangeText={setNewValue}
            placeholder={mode === 'password' ? 'New password' : 'New profile name'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            secureTextEntry={mode === 'password'}
          />
          <View style={styles.recordActionsRow}>
            <Pressable style={[styles.smallButton, styles.smallButtonSuccess]} onPress={() => handleRecord('manual-completed')}>
              <Text style={styles.smallButtonText}>Save & log as done</Text>
            </Pressable>
            <Pressable style={[styles.smallButton, styles.smallButtonDanger]} onPress={() => handleRecord('failed')}>
              <Text style={styles.smallButtonText}>Log as failed</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  banner: { padding: 16, backgroundColor: colors.surface, margin: 12, borderRadius: 12 },
  bannerTitle: { color: colors.warning, fontWeight: '700', marginBottom: 4 },
  bannerText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  steps: { paddingHorizontal: 16, marginBottom: 8 },
  stepText: { color: colors.text, fontSize: 13, marginBottom: 4, lineHeight: 18 },
  webviewWrapper: { flex: 1, marginHorizontal: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  webview: { flex: 1 },
  actionsRow: { flexDirection: 'row', gap: 12, padding: 12 },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: colors.text, fontWeight: '700' },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.text, fontWeight: '700' },
  recordPanel: { padding: 16, backgroundColor: colors.surface, margin: 12, marginTop: 0, borderRadius: 12 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordActionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  smallButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  smallButtonSuccess: { backgroundColor: colors.success },
  smallButtonDanger: { backgroundColor: colors.danger },
  smallButtonText: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
