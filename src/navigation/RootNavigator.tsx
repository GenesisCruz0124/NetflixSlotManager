import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type {
  AccountsStackParamList,
  CustomersStackParamList,
  RootTabParamList,
  SalesStackParamList,
} from './types';
import { colors } from '../utils/theme';

import DashboardScreen from '../screens/DashboardScreen';
import CustomersListScreen from '../screens/CustomersListScreen';
import CustomerFormScreen from '../screens/CustomerFormScreen';
import CustomerDetailScreen from '../screens/CustomerDetailScreen';
import PaymentsListScreen from '../screens/PaymentsListScreen';
import PaymentFormScreen from '../screens/PaymentFormScreen';
import AccountsListScreen from '../screens/AccountsListScreen';
import AccountFormScreen from '../screens/AccountFormScreen';
import AccountDetailScreen from '../screens/AccountDetailScreen';
import AutomationRunnerScreen from '../screens/AutomationRunnerScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();
const CustomersStack = createNativeStackNavigator<CustomersStackParamList>();
const SalesStack = createNativeStackNavigator<SalesStackParamList>();
const AccountsStack = createNativeStackNavigator<AccountsStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.text },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
};

function CustomersNavigator() {
  return (
    <CustomersStack.Navigator screenOptions={screenOptions}>
      <CustomersStack.Screen name="CustomersList" component={CustomersListScreen} options={{ title: 'Members' }} />
      <CustomersStack.Screen name="CustomerForm" component={CustomerFormScreen} />
      <CustomersStack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
    </CustomersStack.Navigator>
  );
}

function SalesNavigator() {
  return (
    <SalesStack.Navigator screenOptions={screenOptions}>
      <SalesStack.Screen name="PaymentsList" component={PaymentsListScreen} options={{ title: 'Sales' }} />
      <SalesStack.Screen name="PaymentForm" component={PaymentFormScreen} options={{ title: 'Log payment' }} />
    </SalesStack.Navigator>
  );
}

function AccountsNavigator() {
  return (
    <AccountsStack.Navigator screenOptions={screenOptions}>
      <AccountsStack.Screen name="AccountsList" component={AccountsListScreen} options={{ title: 'Accounts' }} />
      <AccountsStack.Screen name="AccountForm" component={AccountFormScreen} />
      <AccountsStack.Screen name="AccountDetail" component={AccountDetailScreen} />
      <AccountsStack.Screen name="AutomationRunner" component={AutomationRunnerScreen} />
    </AccountsStack.Navigator>
  );
}

const TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  Customers: 'people',
  Sales: 'cash',
  Accounts: 'tv',
};

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS[route.name as keyof RootTabParamList]} color={color} size={size} />
          ),
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Customers" component={CustomersNavigator} options={{ title: 'Members' }} />
        <Tab.Screen name="Sales" component={SalesNavigator} />
        <Tab.Screen name="Accounts" component={AccountsNavigator} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
