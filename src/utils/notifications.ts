import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Customer } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function notificationIdFor(customerId: number): string {
  return `due-reminder-${customerId}`;
}

/**
 * Schedules a repeating monthly reminder a day before the customer's billing day.
 * Cancels any existing reminder for the customer first so this stays idempotent.
 */
export async function scheduleDueReminder(customer: Customer): Promise<void> {
  await cancelDueReminder(customer.id);
  if (customer.status !== 'active') return;

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const reminderDay = customer.billingDay > 1 ? customer.billingDay - 1 : 1;

  await Notifications.scheduleNotificationAsync({
    identifier: notificationIdFor(customer.id),
    content: {
      title: 'Payment due soon',
      body: `${customer.name}'s slot payment (₱${customer.monthlyPrice.toFixed(2)}) is due around the ${customer.billingDay}${ordinal(customer.billingDay)}.`,
    },
    trigger: Platform.select({
      default: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: reminderDay,
        hour: 9,
        minute: 0,
      },
    }),
  });
}

export async function cancelDueReminder(customerId: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationIdFor(customerId)).catch(() => {});
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
