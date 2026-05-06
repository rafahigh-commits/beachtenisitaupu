import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "admin" | "member";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role | null;
  mustChangePassword: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshMustChangePassword: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  role: null,
  mustChangePassword: false,
  loading: true,
  signOut: async () => {},
  refreshMustChangePassword: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          fetchRole(s.user.id);
          fetchMustChange(s.user.id);
        }, 0);
      } else {
        setRole(null);
        setMustChangePassword(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchRole(s.user.id);
        fetchMustChange(s.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchRole(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!data || data.length === 0) {
      setRole("member");
      return;
    }
    const isAdmin = data.some((r: { role: Role }) => r.role === "admin");
    setRole(isAdmin ? "admin" : "member");
  }

  async function fetchMustChange(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", userId)
      .maybeSingle();
    setMustChangePassword(!!data?.must_change_password);
  }

  async function refreshMustChangePassword() {
    if (user) await fetchMustChange(user.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRole(null);
    setMustChangePassword(false);
  }

  return (
    <Ctx.Provider value={{ user, session, role, mustChangePassword, loading, signOut, refreshMustChangePassword }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
