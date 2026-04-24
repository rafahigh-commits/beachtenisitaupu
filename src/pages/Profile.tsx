import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Plan {
  id: string;
  name: string;
  price: number;
}

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [planId, setPlanId] = useState<string>("");

  useEffect(() => {
    document.title = "Meu perfil | Beach.Club";
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [profRes, plansRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone, birth_date, plan_id")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("plans").select("id, name, price").eq("active", true),
      ]);
      const p = profRes.data;
      if (p) {
        setFullName(p.full_name ?? "");
        setPhone(p.phone ?? "");
        setBirthDate(p.birth_date ?? "");
        setPlanId(p.plan_id ?? "");
      }
      setPlans((plansRes.data ?? []) as Plan[]);
      setLoading(false);
    })();
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone || null,
        birth_date: birthDate || null,
        plan_id: planId || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Perfil atualizado!");
  }

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-12">
      <div className="blur-orb size-[400px] bg-primary/20 -top-32 -right-32" />
      <AppHeader />

      <main className="relative z-10 max-w-2xl mx-auto px-4 md:px-8 mt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>

        <div className="glass rounded-[40px] p-8 md:p-10">
          <h1 className="font-heading text-3xl font-extrabold text-ocean-deep mb-2">
            Meu perfil
          </h1>
          <p className="text-muted-foreground mb-8">
            Mantenha suas informações sempre atualizadas.
          </p>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="phone">WhatsApp</Label>
              <Input
                id="phone"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="birth">Data de aniversário</Label>
              <Input
                id="birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Plano</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha seu plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — R$ {Number(p.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Apenas admin pode alterar pagamentos. Você escolhe seu plano.
              </p>
            </div>

            <Button type="submit" disabled={saving} size="lg" className="w-full">
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Salvar alterações"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
