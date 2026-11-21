"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { nowISO } from "@/lib/dates";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import {
  changePassword,
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  resetPassword,
  updateUserProfile,
} from "@/services/auth";
import { refreshOverdueStatuses } from "@/services/activities";
import { runNotificationEngine } from "@/services/notifications";
import type { RegisterInput } from "@/schemas/auth";
import type { Session, User, UserPreferences } from "@/types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<"signed_in" | "confirm_email">;
  logout: () => void;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: { name?: string; preferences?: Partial<UserPreferences> }) => Promise<void>;
  updatePassword: (current: string, next: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) {
      setUser(null);
      setSessionState(null);
      setLoading(false);
      return;
    }

    const { data } = await getSupabase().auth.getSession();
    const authUser = data.session?.user;
    if (!authUser) {
      setUser(null);
      setSessionState(null);
      setLoading(false);
      return;
    }

    const full = await getCurrentUser();
    setUser(full);
    setSessionState(
      full
        ? {
            userId: full.id,
            email: full.email,
            name: full.name,
            loggedAt: nowISO(),
          }
        : null
    );
    if (full) {
      await refreshOverdueStatuses(full.id);
      await runNotificationEngine(full.id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    if (!supabaseConfigured) return;
    const { data } = getSupabase().auth.onAuthStateChange(() => {
      setTimeout(() => void refresh(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      refresh,
      async login(email, password) {
        await loginUser(email, password);
        await refresh();
      },
      async register(input) {
        const result = await registerUser(input);
        if (result.status === "signed_in") await refresh();
        return result.status;
      },
      logout() {
        void logoutUser();
        setUser(null);
        setSessionState(null);
      },
      async resetPassword(email) {
        await resetPassword(email);
      },
      async updateProfile(data) {
        if (!user) return;
        await updateUserProfile(user.id, data);
        await refresh();
      },
      async updatePassword(current, next) {
        if (!user) return;
        await changePassword(user.id, current, next);
      },
    }),
    [user, session, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function usePreferences(): UserPreferences | null {
  const { user } = useAuth();
  return user?.preferences ?? null;
}
