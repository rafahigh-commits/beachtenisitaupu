import { Logo } from "./Logo";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, User as UserIcon, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "./NotificationBell";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function computeInitials(name?: string | null, fallback?: string | null) {
  const source = (name ?? "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    const result = (first + last).toUpperCase();
    if (result) return result;
  }
  const email = (fallback ?? "").trim();
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

export function AppHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState<string | null>(null);
  usePushNotifications();

  useEffect(() => {
    if (!user) { setFullName(null); return; }
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setFullName(data?.full_name ?? null));
  }, [user]);

  const initials = computeInitials(fullName, user?.email);

  return (
    <header className="sticky top-4 z-40 mx-4 md:mx-8">
      <nav className="glass max-w-7xl mx-auto flex items-center justify-between rounded-3xl px-5 md:px-8 py-3">
        <Logo />

        <div className="flex items-center gap-2 md:gap-6">
          <Link
            to="/financeiro"
            className="hidden sm:flex items-center gap-2 text-sm font-semibold text-ocean-deep/70 hover:text-primary transition-colors"
          >
            <Wallet className="size-4" />
            Financeiro
          </Link>
          {role === "admin" && (
            <Link
              to="/admin"
              className="hidden sm:flex items-center gap-2 text-sm font-semibold text-ocean-deep/70 hover:text-primary transition-colors"
            >
              <Shield className="size-4" />
              Painel Admin
            </Link>
          )}

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="size-11 rounded-2xl bg-gradient-aqua text-primary-foreground font-bold grid place-items-center border-2 border-white shadow-glow hover:scale-105 transition-transform">
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-2">
                <p className="text-xs text-muted-foreground">Conectado como</p>
                <p className="text-sm font-semibold truncate">{user?.email}</p>
                {role === "admin" && (
                  <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/30 text-ocean-deep">
                    Admin
                  </span>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/perfil")}>
                <UserIcon className="size-4 mr-2" /> Meu perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/financeiro")}>
                <Wallet className="size-4 mr-2" /> Financeiro
              </DropdownMenuItem>
              {role === "admin" && (
                <DropdownMenuItem onClick={() => navigate("/admin")}>
                  <Shield className="size-4 mr-2" /> Painel admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate("/auth");
                }}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="size-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}
