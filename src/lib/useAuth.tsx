import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "lecturer" | "dean" | "administrator" | "it_support";

export type Profile = {
  id: string;
  full_name: string;
  reg_number: string | null;
  email: string | null;
  title: string | null;
  department: string | null;
  bio: string | null;
  photo_url: string | null;
  office_location: string | null;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
  /** true once a second step has been completed (Administrator / IT Support) */
  elevated: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [elevated, setElevated] = useState(false);

  async function load(current: Session | null) {
    if (!current) {
      setRole(null);
      setProfile(null);
      setElevated(false);
      setLoading(false);
      return;
    }
    const [roleRes, profileRes, aal] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", current.user.id).maybeSingle(),
      supabase.from("profiles").select("*").eq("id", current.user.id).maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setRole((roleRes.data?.role as AppRole | undefined) ?? null);
    setProfile((profileRes.data as Profile | null) ?? null);
    setElevated(aal.data?.currentLevel === "aal2");
    setLoading(false);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void load(next);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void load(data.session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        profile,
        loading,
        elevated,
        refresh: () => load(session),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
