import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors } from '../utils/theme';

interface Props {
  /** Billing period in `YYYY-MM` form. */
  value: string;
  onChange: (period: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PERIOD_PATTERN = /^(\d{4})-(\d{2})$/;

function periodFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateFromPeriod(value: string): Date {
  const match = PERIOD_PATTERN.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

function displayLabel(value: string): string {
  const match = PERIOD_PATTERN.exec(value);
  if (!match) return 'Select a month';
  return `${MONTH_NAMES[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/**
 * Picks a calendar month (stored as `YYYY-MM`) using the native date picker —
 * the day portion of the picked date is discarded since billing periods only
 * track month + year.
 */
export default function MonthField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
    }
    if (event.type === 'set' && selected) {
      onChange(periodFromDate(selected));
    }
  };

  return (
    <View>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={styles.value}>{displayLabel(value)}</Text>
      </Pressable>

      {open ? (
        <View style={Platform.OS === 'ios' ? styles.iosPickerWrapper : undefined}>
          <DateTimePicker
            value={dateFromPeriod(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            themeVariant="dark"
          />
          {Platform.OS === 'ios' ? (
            <Pressable style={styles.doneButton} onPress={() => setOpen(false)}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: { color: colors.text, fontSize: 15 },
  iosPickerWrapper: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    marginTop: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneButton: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  doneButtonText: { color: colors.text, fontWeight: '700' },
});
