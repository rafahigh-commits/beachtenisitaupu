import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = "Nova senha | Beach.Club";

    // Aguarda o Supabase processar o token de recuperação do hash
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Caso o evento já tenha disparado antes do listener
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    if (userData.user) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", userData.user.id);
    }
    setLoading(false);
    toast.success("Senha atualizada! Faça login novamente.");
    await supabase.auth.signOut();
    navigate("/auth");
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
            Defina sua nova senha
          </h1>
          <p className="text-muted-foreground">
            Escolha uma senha segura para acessar sua conta.
          </p>
        </div>

        <div className="glass rounded-3xl p-8">
          {!ready ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground mt-4">
                Validando link de recuperação...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Mínimo 6 caracteres</p>
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirmar senha</Label>
                <Input
                  id="confirm-password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
