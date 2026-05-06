import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = "Recuperar senha | Beach.Club";
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value.includes("@")) {
      toast.error("Informe seu email cadastrado");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(value, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Se o email existir, enviaremos um link de recuperação.");
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
            Esqueci minha senha
          </h1>
          <p className="text-muted-foreground">
            Informe seu email para receber o link de recuperação.
          </p>
        </div>

        <div className="glass rounded-3xl p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-sm">
                Se houver uma conta com esse email, um link de recuperação foi enviado.
                Verifique sua caixa de entrada e spam.
              </p>
              <p className="text-xs text-muted-foreground">
                Se você cadastrou apenas com telefone, peça ao admin para redefinir sua senha.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email cadastrado</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Cadastrado apenas com telefone? Fale com o admin do grupo.
                </p>
              </div>
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Enviar link"}
              </Button>
            </form>
          )}

          <Link
            to="/auth"
            className="mt-6 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Voltar para login
          </Link>
        </div>
      </main>
    </div>
  );
}
