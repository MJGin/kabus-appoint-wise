/**
 * Demo authentication - hardcoded accounts for demo purposes
 * Bypasses Supabase entirely for reliable demo access
 */

export type DemoRole = "student" | "lecturer" | "dean" | "administrator" | "it_support";

export interface DemoUser {
  email: string;
  password: string;
  role: DemoRole;
  fullName: string;
  regNumber?: string;
  identifier: string; // What user types to log in (reg number or email)
}

export const DEMO_USERS: DemoUser[] = [
  // Admin
  {
    email: "lboli@kabarak.ac.ke",
    password: "KabusTest2026!",
    role: "administrator",
    fullName: "Lydia Boli",
    identifier: "lboli@kabarak.ac.ke",
  },
  // IT Support
  {
    email: "rwahome@kabarak.ac.ke",
    password: "KabusTest2026!",
    role: "it_support",
    fullName: "Robert Wahome",
    identifier: "rwahome@kabarak.ac.ke",
  },
  // Students (registration numbers)
  {
    email: "njugunal@kabarak.ac.ke",
    password: "KabusTest2026!",
    role: "student",
    fullName: "Lucy Njuguna",
    regNumber: "LAW/M/1178/05/26",
    identifier: "LAW/M/1178/05/26",
  },
  {
    email: "chepchumbab@kabarak.ac.ke",
    password: "KabusTest2026!",
    role: "student",
    fullName: "Brenda Chepchumba",
    regNumber: "LAW/M/1179/05/26",
    identifier: "LAW/M/1179/05/26",
  },
  {
    email: "ndung'u@kabarak.ac.ke",
    password: "KabusTest2026!",
    role: "student",
    fullName: "Grace Ndung'u",
    regNumber: "LAW/M/1180/05/26",
    identifier: "LAW/M/1180/05/26",
  },
  {
    email: "elikiprotich@kabarak.ac.ke",
    password: "KabusTest2026!",
    role: "student",
    fullName: "Eliki Protich",
    regNumber: "LAW/M/1181/05/26",
    identifier: "LAW/M/1181/05/26",
  },
  {
    email: "mmokeira@kabarak.ac.ke",
    password: "KabusTest2026!",
    role: "student",
    fullName: "Moses Mokeira",
    regNumber: "LAW/M/1182/05/26",
    identifier: "LAW/M/1182/05/26",
  },
  // Lecturers
  {
    email: "cgitonga@kabarak.ac.ke",
    password: "KabusTest2026!",
    role: "lecturer",
    fullName: "Dr. Christine Gitonga",
    identifier: "cgitonga@kabarak.ac.ke",
  },
  {
    email: "pojode@kabarak.ac.ke",
    password: "KabusTest2026!",
    role: "lecturer",
    fullName: "Prof. Peter Ojode",
    identifier: "pojode@kabarak.ac.ke",
  },
  {
    email: "chepchirchirtukai@kabarak.ac.ke",
    password: "KabusTest2026!",
    role: "lecturer",
    fullName: "Dr. Chepchirchir Tukai",
    identifier: "chepchirchirtukai@kabarak.ac.ke",
  },
  {
    email: "koechc@kabarak.ac.ke",
    password: "KabusTest2026!",
    role: "lecturer",
    fullName: "Dr. Caroline Koech",
    identifier: "koechc@kabarak.ac.ke",
  },
];

const DEMO_SESSION_KEY = "kabu-demo-session";

export interface DemoSession {
  user: DemoUser;
  token: string;
  expiresAt: number;
}

export function verifyDemoCredentials(identifier: string, password: string): DemoUser | null {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  for (const user of DEMO_USERS) {
    const userIdentifier = user.identifier.toLowerCase();
    const userEmail = user.email.toLowerCase();

    if ((normalizedIdentifier === userIdentifier || normalizedIdentifier === userEmail)
        && password === user.password) {
      return user;
    }
  }
  return null;
}

export function createDemoSession(user: DemoUser): DemoSession {
  const session: DemoSession = {
    user,
    token: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getDemoSession(): DemoSession | null {
  try {
    const stored = localStorage.getItem(DEMO_SESSION_KEY);
    if (!stored) return null;
    const session: DemoSession = JSON.parse(stored);
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearDemoSession(): void {
  localStorage.removeItem(DEMO_SESSION_KEY);
}

export function isDemoMode(): boolean {
  return true; // Always use demo mode
}

export const GENERIC_AUTH_ERROR = "Those sign-in details were not accepted. Check them and try again.";