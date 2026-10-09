import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getDemoSession, clearDemoSession, type DemoUser, type DemoSession } from "@/lib/demoAuth";

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
  session: DemoSession | null;
  user: DemoUser | null;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
  elevated: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function demoUserToProfile(user: DemoUser): Profile {
  return {
    id: user.email,
    full_name: user.fullName,
    reg_number: user.regNumber ?? null,
    email: user.email,
    title: user.role === "lecturer" ? "Lecturer" : user.role === "dean" ? "Dean" : null,
    department: "School of Law",
    bio: null,
    photo_url: null,
    office_location: null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const demoSession = getDemoSession();
    if (demoSession) {
      setSession(demoSession);
      setRole(demoSession.user.role);
      setProfile(demoUserToProfile(demoSession.user));
    } else {
      setSession(null);
      setRole(null);
      setProfile(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function signOut() {
    clearDemoSession();
    setSession(null);
    setRole(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        profile,
        loading,
        elevated: false,
        refresh: load,
        signOut,
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