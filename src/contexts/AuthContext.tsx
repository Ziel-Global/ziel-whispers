import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  designation: string;
  avatar_url: string | null;
  status: string;
  must_change_password: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, role, department, designation, avatar_url, status, must_change_password")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch user profile", error);
      setProfile(null);
      return null;
    }

    const nextProfile = data as UserProfile | null;
    setProfile(nextProfile);
    return nextProfile;
  };

  useEffect(() => {
    let isMounted = true;

    const syncSession = async (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        await fetchProfile(nextSession.user.id);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setLoading(true);
        void syncSession(nextSession);
      }
    );

    void supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      void syncSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const userId = session?.user?.id;
    if (userId) {
      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "session.logout",
        target_entity: "users",
        target_id: userId,
      });
    }
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
