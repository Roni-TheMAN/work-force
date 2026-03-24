import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { currentUserQueryKeyBase } from "@/lib/query-keys";
import {
  getSupabaseSession,
  signInWithPassword,
  signOut as signOutFromSupabase,
  signUpWithPassword,
  subscribeToAuthChanges,
} from "@/lib/supabase";

type AuthContextValue = {
  isAuthReady: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<Session | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void getSupabaseSession()
      .then((nextSession) => {
        if (!isMounted) {
          return;
        }

        setSession(nextSession);
        setIsAuthReady(true);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setSession(null);
        setIsAuthReady(true);
      });

    const { data } = subscribeToAuthChanges((_event, nextSession) => {
      setSession(nextSession);
      queryClient.removeQueries({ queryKey: currentUserQueryKeyBase });
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value: AuthContextValue = {
    isAuthReady,
    session,
    async signIn(email, password) {
      await signInWithPassword(email, password);
    },
    async signOut() {
      await signOutFromSupabase();
      await queryClient.cancelQueries({ queryKey: currentUserQueryKeyBase });
      queryClient.removeQueries({ queryKey: currentUserQueryKeyBase });
    },
    async signUp(email, password, fullName, phone) {
      const result = await signUpWithPassword(email, password, fullName, phone);
      return result.session;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
