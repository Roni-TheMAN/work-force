import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { env } from "./env";

export type AuthStateChangeHandler = (event: AuthChangeEvent, session: Session | null) => void;

export const supabase: SupabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export async function getSupabaseSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signUpWithPassword(email: string, password: string, fullName: string, phone: string) {
  const normalizedPhone = phone.trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: normalizedPhone || undefined,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data.session && Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
    throw new Error("User already registered");
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export function subscribeToAuthChanges(handler: AuthStateChangeHandler) {
  return supabase.auth.onAuthStateChange(handler);
}
