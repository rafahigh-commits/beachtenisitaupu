import { Logo } from "./Logo";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const initials =
    user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <header className="sticky top-4 z-40 mx-4 md:mx-8">
      <nav className="glass max-w-7xl mx-auto flex items-center justify-between rounded-3xl px-5 md:px-8 py-3">
        <Logo />

        <div className="flex items-center gap-2 md:gap-6">
          {role === "admin" && (
            <Link
              to="/admin"
              className="hidden sm:flex items-center gap-2 text-sm font-semibold text-ocean-deep/70 hover:text-primary transition-colors"
            >
              <Shield className="size-4" />
              Painel Admin
            </Link>
          )}

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
