import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when the keys were provided (see .env.example). The app works offline without them. */
export const cloudConfigured = Boolean(url && anonKey && !url.includes('YOUR-PROJECT'));

/** Social sign-in buttons only appear when you have enabled the provider in Supabase and set these flags in .env. */
export const authProviders = {
  google: process.env.EXPO_PUBLIC_AUTH_GOOGLE === 'true',
  apple: process.env.EXPO_PUBLIC_AUTH_APPLE === 'true',
};

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;
