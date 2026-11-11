import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  ready: boolean;
  session: Session | null;
  busy: boolean;
  init: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
}

let initialised = false;

/** Turn raw errors into something a gym-goer can act on. */
const friendly = (msg: string) =>
  /failed to fetch|network request failed|networkerror/i.test(msg)
    ? "Couldn't reach the server. Check your internet connection and try again."
    : msg;

export const useAuth = create<AuthState>((set, get) => ({
  ready: false,
  session: null,
  busy: false,

  init: async () => {
    if (initialised) return;
    initialised = true;
    if (!supabase) {
      set({ ready: true });
      return;
    }
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, ready: true });
    supabase.auth.onAuthStateChange((_event, session) => set({ session }));
  },

  signUp: async (email, password) => {
    if (!supabase) return { error: 'Cloud sync is not configured.' };
    set({ busy: true });
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    set({ busy: false });
    if (error) return { error: friendly(error.message) };
    // If email confirmation is on in Supabase, there is no session until the link is clicked.
    return { needsConfirm: !data.session };
  },

  signIn: async (email, password) => {
    if (!supabase) return { error: 'Cloud sync is not configured.' };
    set({ busy: true });
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    set({ busy: false });
    return error ? { error: friendly(error.message) } : {};
  },

  signInWithOAuth: async (provider) => {
    if (!supabase) return { error: 'Cloud sync is not configured.' };
    const web = Platform.OS === 'web';
    const redirectTo = web ? window.location.origin : Linking.createURL('auth-callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: !web },
    });
    if (error) return { error: friendly(error.message) };
    if (web) return {}; // the browser is redirected to the provider and back; the session is picked up on return
    if (!data?.url) return { error: 'Could not start sign in.' };

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== 'success') return {}; // cancelled
    const url = new URL(res.url);
    const params = new URLSearchParams(url.hash ? url.hash.slice(1) : url.search);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const code = params.get('code');
    if (access_token && refresh_token) {
      const r = await supabase.auth.setSession({ access_token, refresh_token });
      if (r.error) return { error: friendly(r.error.message) };
    } else if (code) {
      const r = await supabase.auth.exchangeCodeForSession(code);
      if (r.error) return { error: friendly(r.error.message) };
    } else {
      return { error: params.get('error_description') ?? 'Sign in did not complete.' };
    }
    return {};
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ session: null });
  },

  resetPassword: async (email) => {
    if (!supabase) return { error: 'Cloud sync is not configured.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return error ? { error: friendly(error.message) } : {};
  },

  deleteAccount: async () => {
    if (!supabase || !get().session) return { error: 'Not signed in.' };
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return { error: friendly(error.message) };
    await supabase.auth.signOut();
    set({ session: null });
    return {};
  },
}));
