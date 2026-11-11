import React, { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuth } from './src/store/useAuth';
import { startAutoSync } from './src/lib/sync';
import { useStore } from './src/store/useStore';
import HomeScreen from './src/screens/HomeScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import ExercisesScreen from './src/screens/ExercisesScreen';
import ExerciseDetailScreen from './src/screens/ExerciseDetailScreen';
import RankingsScreen from './src/screens/RankingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import RecordsScreen from './src/screens/RecordsScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, border: colors.border, primary: colors.accent, text: colors.text },
};

const icon = (glyph: string) => ({ color }: { color: string }) => <Text style={{ fontSize: 18, color }}>{glyph}</Text>;

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: icon('🏠') }} />
      <Tab.Screen name="Workout" component={WorkoutScreen} options={{ tabBarIcon: icon('🏋️') }} />
      <Tab.Screen name="Exercises" component={ExercisesScreen} options={{ tabBarIcon: icon('📖') }} />
      <Tab.Screen name="Rankings" component={RankingsScreen} options={{ tabBarIcon: icon('🏆') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: icon('👤') }} />
    </Tab.Navigator>
  );
}

const headerOpts = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  headerBackTitle: 'Back',
};

export default function App() {
  const onboarded = useStore((s) => s.profile.onboarded);
  const [hydrated, setHydrated] = React.useState(useStore.persist.hasHydrated());

  useEffect(() => {
    const off = useStore.persist.onFinishHydration(() => setHydrated(true));
    useAuth.getState().init().then(() => startAutoSync());
    return off;
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 520 : undefined }}>
          <NavigationContainer theme={theme}>
            <StatusBar style="light" />
            {!hydrated ? null : !onboarded ? (
              <OnboardingScreen />
            ) : (
              <Stack.Navigator screenOptions={headerOpts}>
                <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
                <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} options={{ title: '' }} />
                <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
                <Stack.Screen name="Records" component={RecordsScreen} options={{ title: 'Personal records' }} />
                <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Analytics' }} />
                <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
                <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit profile' }} />
              </Stack.Navigator>
            )}
          </NavigationContainer>
        </View>
      </View>
    </SafeAreaProvider>
  );
}
