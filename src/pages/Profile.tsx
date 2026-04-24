import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [athleteId, setAthleteId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");

  useEffect(() => {
    document.title = "Meu perfil | Itaipu Beach Tennis";
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("athletes")
        .select("id, full_name, phone, email, birth_date")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setAthleteId(data.id);
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
        setEmail(data.email ?? user.email ?? "");
        setBirthDate(data.birth_date ?? "");
      } else {
        setEmail(user.email ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!athleteId) return;
    setSaving(true);
    const { error } = await supabase
      .from("athletes")
      .update({
        full_name: fullName,
        phone: phone || null,
        email: email || null,
        birth_date: birthDate || null,
      })
      .eq("id", athleteId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Perfil atualizado!");
  }

  if (loading) {
    return <div className="min-h-dvh grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-dvh pb-12">
      <div className="blur-orb size-[400px] bg-primary/20 -top-32 -right-32" />
      <AppHeader />

      <main className="relative z-10 max-w-2xl mx-auto px-4 md:px-8 mt-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="size-4" /> Voltar
        </Link>

        <div className="glass rounded-[40px] p-8 md:p-10">
          <h1 className="font-heading text-3xl font-extrabold text-ocean-deep mb-2">Meu perfil</h1>
          <p className="text-muted-foreground mb-8">Mantenha suas informações sempre atualizadas.</p>

          {!athleteId ? (
            <div className="bg-warning/10 rounded-2xl p-5 flex gap-3">
              <AlertCircle className="size-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ocean-deep">Conta não vinculada a um atleta</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sua conta de login ({user?.email}) ainda não está vinculada a um atleta cadastrado.
                  Avise o administrador para fazer a vinculação.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="phone">WhatsApp</Label>
                <Input id="phone" placeholder="(21) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="email">Email de contato</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="birth">Data de aniversário</Label>
                <Input id="birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Plano e pagamentos são gerenciados pelo administrador do grupo.
              </p>
              <Button type="submit" disabled={saving} size="lg" className="w-full">
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Salvar alterações"}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
