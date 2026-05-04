import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const ACTIVITY_KEY = "ziel_last_activity";
const SESSION_ID_KEY = "ziel_session_id";
const SESSION_START_KEY = "ziel_session_start";
const STATUS_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours — absolute max, regardless of activity
const SESSION_AGE_CHECK_INTERVAL = 60000; // check every 60 seconds

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
  join_date: string | null;
  created_at: string;
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

async function getSessionTimeoutMs(): Promise<number> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "session_timeout_hours")
    .maybeSingle();
  const hours = Number(data?.value);
  // If setting is missing or invalid, fall back to 8h to avoid locking users out
  if (!hours || Number.isNaN(hours) || hours <= 0) return 8 * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionIdRef = useRef<string | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionAgeCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTimeoutMsRef = useRef<number>(8 * 60 * 60 * 1000);
  const queryClient = useQueryClient();

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, role, department, designation, avatar_url, status, must_change_password, join_date, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch user profile", error);
      setProfile(null);
      return null;
    }

    const nextProfile = data as UserProfile | null;
    if (nextProfile && nextProfile.status === "inactive") {
      toast.error("Your account has been deactivated. Please contact your administrator.");
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      return null;
    }

    setProfile(nextProfile);
    return nextProfile;
  };

  const startStatusCheck = useCallback((userId: string) => {
    if (statusCheckRef.current) clearInterval(statusCheckRef.current);
    statusCheckRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("users")
        .select("status")
        .eq("id", userId)
        .maybeSingle();
      if (data?.status === "inactive") {
        toast.error("Your account has been deactivated. Please contact your administrator.");
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
      }
    }, STATUS_CHECK_INTERVAL);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(async () => {
      toast.error("Your session has expired. Please log in again");
      await supabase.auth.signOut();
    }, sessionTimeoutMsRef.current);
  }, []);

  const checkInactivityExpiry = useCallback(async () => {
    const last = localStorage.getItem(ACTIVITY_KEY);
    if (last && Date.now() - Number(last) > sessionTimeoutMsRef.current) {
      toast.error("Your session has expired due to inactivity. Please log in again");
      await supabase.auth.signOut();
      return true;
    }
    return false;
  }, []);

  // Check if the absolute max session lifetime (24h) has been exceeded
  const checkMaxSessionLifetime = useCallback(async () => {
    const start = localStorage.getItem(SESSION_START_KEY);
    if (start && Date.now() - Number(start) > MAX_SESSION_LIFETIME_MS) {
      toast.error("Your session has expired. Please log in again.");
      localStorage.removeItem(SESSION_START_KEY);
      localStorage.removeItem(SESSION_ID_KEY);
      localStorage.removeItem(ACTIVITY_KEY);
      if (statusCheckRef.current) clearInterval(statusCheckRef.current);
      if (sessionAgeCheckRef.current) clearInterval(sessionAgeCheckRef.current);
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    const handleStorage = async (e: StorageEvent) => {
      if (e.key === SESSION_ID_KEY && e.newValue && e.newValue !== sessionIdRef.current) {
        toast.info("You have been logged out because a new session was started");
        setSession(null);
        setProfile(null);
      }
      if (e.key === SESSION_ID_KEY && !e.newValue) {
        setSession(null);
        setProfile(null);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!session) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    const handler = () => resetInactivityTimer();
    events.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));
    resetInactivityTimer();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handler));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [session, resetInactivityTimer]);

  // Periodic check for absolute max session lifetime (every 60s)
  useEffect(() => {
    if (!session) {
      if (sessionAgeCheckRef.current) clearInterval(sessionAgeCheckRef.current);
      return;
    }
    sessionAgeCheckRef.current = setInterval(() => {
      void checkMaxSessionLifetime();
    }, SESSION_AGE_CHECK_INTERVAL);
    return () => {
      if (sessionAgeCheckRef.current) clearInterval(sessionAgeCheckRef.current);
    };
  }, [session, checkMaxSessionLifetime]);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        if (statusCheckRef.current) clearInterval(statusCheckRef.current);
        return;
      }

      const newSid = nextSession.access_token.slice(-16);
      sessionIdRef.current = newSid;
      localStorage.setItem(SESSION_ID_KEY, newSid);

      // Record session start time if not already set (first login)
      if (!localStorage.getItem(SESSION_START_KEY)) {
        localStorage.setItem(SESSION_START_KEY, Date.now().toString());
      }

      // Check absolute max session lifetime (24h)
      const maxExpired = await checkMaxSessionLifetime();
      if (maxExpired) { setLoading(false); return; }

      // Refresh session timeout from settings on each session sync
      sessionTimeoutMsRef.current = await getSessionTimeoutMs();

      const expired = await checkInactivityExpiry();
      if (expired) { setLoading(false); return; }

      try {
        const prof = await fetchProfile(nextSession.user.id);
        if (prof) {
          startStatusCheck(nextSession.user.id);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (_event === "SIGNED_OUT") {
          setSession(null);
          setProfile(null);
          setLoading(false);
          localStorage.removeItem(SESSION_ID_KEY);
          localStorage.removeItem(ACTIVITY_KEY);
          localStorage.removeItem(SESSION_START_KEY);
          if (statusCheckRef.current) clearInterval(statusCheckRef.current);
          if (sessionAgeCheckRef.current) clearInterval(sessionAgeCheckRef.current);
          return;
        }
        // Never set loading = true here. The initial useState(true) handles
        // the first app bootstrap. All subsequent auth events (SIGNED_IN from
        // token refreshes on tab re-focus, TOKEN_REFRESHED, etc.) should sync
        // silently in the background so the UI isn't torn down and in-progress
        // user work (file imports, form edits, etc.) is preserved.
        void syncSession(nextSession);
      }
    );

    void supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      void syncSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (statusCheckRef.current) clearInterval(statusCheckRef.current);
      if (sessionAgeCheckRef.current) clearInterval(sessionAgeCheckRef.current);
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
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    localStorage.removeItem(SESSION_START_KEY);
    sessionStorage.clear();
    queryClient.clear();
    if (statusCheckRef.current) clearInterval(statusCheckRef.current);
    if (sessionAgeCheckRef.current) clearInterval(sessionAgeCheckRef.current);
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
