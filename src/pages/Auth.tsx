import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";

function digitsOnly(s: string) {
  return s.replace(/\D+/g, "");
}

function formatPhoneInput(s: string) {
  const d = digitsOnly(s).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function Auth() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    document.title = "Entrar | Beach.Club";
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const digits = digitsOnly(phone);
    if (digits.length < 10) {
      toast.error("Informe um telefone válido com DDD");
      return;
    }
    setLoading(true);
    const email = `${digits}@phone.beachclub`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Telefone ou senha incorretos"
          : error.message,
      );
      return;
    }
    toast.success("Bem-vindo!");
    navigate("/");
  }

  return (
    <div className="min-h-dvh relative overflow-hidden grid place-items-center px-4">
      <div className="blur-orb size-[400px] bg-primary/30 -top-40 -left-40" />
      <div className="blur-orb size-[400px] bg-accent/30 -bottom-40 -right-40" />

      <main className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="font-heading text-3xl font-extrabold text-ocean-deep mb-2">
            Seu point, seus jogos.
          </h1>
          <p className="text-muted-foreground">
            Entre com seu telefone cadastrado.
          </p>
        </div>

        <div className="glass rounded-3xl p-8">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="phone">Telefone (com DDD)</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="(21) 99999-9999"
                required
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Senha inicial: <span className="font-mono font-semibold">bc</span> seguido dos <strong>4 últimos dígitos</strong> do seu telefone.
              </p>
            </div>
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Entrar"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Não consegue entrar? Fale com o admin do grupo.
          </p>
        </div>
      </main>
    </div>
  );
}
