import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors } from '../utils/theme';
import { formatDate } from '../utils/format';

interface Props {
  value: string;
  onChange: (isoDate: string) => void;
}

function isoFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromIso(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default function DateField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
    }
    if (event.type === 'set' && selected) {
      onChange(isoFromDate(selected));
    }
  };

  return (
    <View>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={styles.value}>{value ? formatDate(value) : 'Select a date'}</Text>
      </Pressable>

      {open ? (
        <View style={Platform.OS === 'ios' ? styles.iosPickerWrapper : undefined}>
          <DateTimePicker
            value={dateFromIso(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
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
