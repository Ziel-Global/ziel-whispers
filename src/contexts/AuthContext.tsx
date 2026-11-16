import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { applyTenantTheme, TenantBranding, TenantInfo } from "@/lib/tenantTheme";

const ACTIVITY_KEY = "ziel_last_activity";
const SESSION_ID_KEY = "ziel_session_id";
const SESSION_START_KEY = "ziel_session_start";
const STATUS_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000; // 12 hours — absolute max
const SESSION_AGE_CHECK_INTERVAL = 60000; // check every 60 seconds

export type PlatformRole = "Master_SSA" | "Provisioning_SSA" | "Support_SSA" | null;

export type UserProfile = {
  id: string;
  tenant_id: string | null;
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
  working_days: number;
  overtime_enabled: boolean;
  remote_access: boolean;
  remote_access_from: string | null;
  remote_access_to: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  tenant: TenantInfo | null;
  branding: TenantBranding | null;
  platformRole: PlatformRole;
  isSSA: boolean;
  isSuspended: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshTenantBranding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  tenant: null,
  branding: null,
  platformRole: null,
  isSSA: false,
  isSuspended: false,
  loading: true,
  signOut: async () => {},
  refreshTenantBranding: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function getSessionTimeoutMs(): Promise<number> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "session_timeout_hours")
    .maybeSingle();
  const hours = Number(data?.value);
  if (!hours || Number.isNaN(hours) || hours <= 0) return 12 * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [platformRole, setPlatformRole] = useState<PlatformRole>(null);
  const [isSuspended, setIsSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  const sessionIdRef = useRef<string | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionAgeCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTimeoutMsRef = useRef<number>(12 * 60 * 60 * 1000);
  const queryClient = useQueryClient();

  const fetchTenantData = useCallback(async (tenantId: string) => {
    try {
      // 1. Fetch Tenant Status
      const { data: tenantData } = await (supabase as any)
        .from("tenants")
        .select("id, name, slug, status")
        .eq("id", tenantId)
        .maybeSingle();

      if (tenantData) {
        setTenant(tenantData as TenantInfo);
        if (tenantData.status === "suspended") {
          setIsSuspended(true);
        } else {
          setIsSuspended(false);
        }
      }

      // 2. Fetch Tenant Branding
      const { data: brandData } = await (supabase as any)
        .from("tenant_branding")
        .select("app_name, logo_url, favicon_url, primary_color, secondary_color")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (brandData) {
        const mappedBranding: TenantBranding = {
          appName: brandData.app_name || "Ziel Whispers",
          logoUrl: brandData.logo_url,
          faviconUrl: brandData.favicon_url,
          primaryColor: brandData.primary_color || "17 84% 52%",
          secondaryColor: brandData.secondary_color || "40 8% 96%",
        };
        setBranding(mappedBranding);
        applyTenantTheme(mappedBranding);
      }
    } catch (err) {
      console.error("Failed to load tenant metadata:", err);
    }
  }, []);

  const refreshTenantBranding = useCallback(async () => {
    if (profile?.tenant_id) {
      await fetchTenantData(profile.tenant_id);
    }
  }, [profile?.tenant_id, fetchTenantData]);

  const fetchProfile = async (userId: string) => {
    // 1. Check Platform Roles (SSA)
    try {
      const { data: ssaData } = await (supabase as any)
        .from("platform_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (ssaData?.role) {
        setPlatformRole(ssaData.role as PlatformRole);
      } else {
        setPlatformRole(null);
      }
    } catch {
      setPlatformRole(null);
    }

    // 2. Fetch User Profile
    const { data, error } = await supabase
      .from("users")
      .select("id, tenant_id, full_name, email, role, department, designation, avatar_url, status, must_change_password, join_date, created_at, working_days, overtime_enabled, remote_access, remote_access_from, remote_access_to")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch user profile", error);
      setProfile(null);
      return null;
    }

    const nextProfile = data as unknown as UserProfile | null;
    if (nextProfile && nextProfile.status === "inactive") {
      toast.error("Your account has been deactivated. Please contact your administrator.");
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      return null;
    }

    setProfile(nextProfile);

    // 3. Load Tenant Context & Branding
    if (nextProfile?.tenant_id) {
      await fetchTenantData(nextProfile.tenant_id);
    }

    return nextProfile;
  };

  const startStatusCheck = useCallback((userId: string, tenantId?: string | null) => {
    if (statusCheckRef.current) clearInterval(statusCheckRef.current);
    statusCheckRef.current = setInterval(async () => {
      // Check user status
      const { data: userData } = await supabase
        .from("users")
        .select("status")
        .eq("id", userId)
        .maybeSingle();

      if (userData?.status === "inactive") {
        toast.error("Your account has been deactivated. Please contact your administrator.");
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        return;
      }

      // Check tenant status
      if (tenantId) {
        const { data: tData } = await (supabase as any)
          .from("tenants")
          .select("status")
          .eq("id", tenantId)
          .maybeSingle();

        if (tData?.status === "suspended") {
          setIsSuspended(true);
        } else if (tData?.status === "active") {
          setIsSuspended(false);
        }
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

  // Check absolute max session lifetime
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
        setTenant(null);
        setBranding(null);
        setPlatformRole(null);
        setIsSuspended(false);
        setLoading(false);
        if (statusCheckRef.current) clearInterval(statusCheckRef.current);
        // Reset to default theme on logout
        applyTenantTheme({
          primaryColor: "17 84% 52%",
          secondaryColor: "40 8% 96%",
          appName: "Ziel Whispers",
        });
        return;
      }

      const newSid = nextSession.access_token.slice(-16);
      sessionIdRef.current = newSid;
      localStorage.setItem(SESSION_ID_KEY, newSid);

      if (!localStorage.getItem(SESSION_START_KEY)) {
        localStorage.setItem(SESSION_START_KEY, Date.now().toString());
      }

      const maxExpired = await checkMaxSessionLifetime();
      if (maxExpired) { setLoading(false); return; }

      sessionTimeoutMsRef.current = await getSessionTimeoutMs();

      const expired = await checkInactivityExpiry();
      if (expired) { setLoading(false); return; }

      try {
        const prof = await fetchProfile(nextSession.user.id);
        if (prof) {
          startStatusCheck(nextSession.user.id, prof.tenant_id);
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
          setTenant(null);
          setBranding(null);
          setPlatformRole(null);
          setIsSuspended(false);
          setLoading(false);
          localStorage.removeItem(SESSION_ID_KEY);
          localStorage.removeItem(ACTIVITY_KEY);
          localStorage.removeItem(SESSION_START_KEY);
          if (statusCheckRef.current) clearInterval(statusCheckRef.current);
          if (sessionAgeCheckRef.current) clearInterval(sessionAgeCheckRef.current);
          applyTenantTheme({
            primaryColor: "17 84% 52%",
            secondaryColor: "40 8% 96%",
            appName: "Ziel Whispers",
          });
          return;
        }
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
    applyTenantTheme({
      primaryColor: "17 84% 52%",
      secondaryColor: "40 8% 96%",
      appName: "Ziel Whispers",
    });
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setTenant(null);
    setBranding(null);
    setPlatformRole(null);
    setIsSuspended(false);
  };

  const isSSA = platformRole !== null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        tenant,
        branding,
        platformRole,
        isSSA,
        isSuspended,
        loading,
        signOut,
        refreshTenantBranding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
