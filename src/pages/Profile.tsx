import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, AlertCircle, Plus, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { PaymentDialog, type PaymentDialogPlan, type PaymentDialogTarget } from "@/components/PaymentDialog";
import { formatCurrency } from "@/lib/membership";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Submission {
  id: string;
  amount: number;
  reference_month: string;
  paid_at: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
}

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [athlete, setAthlete] = useState<PaymentDialogTarget | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [plans, setPlans] = useState<PaymentDialogPlan[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    document.title = "Meu perfil | Itaipu Beach Tennis";
  }, []);

  const loadAll = useCallback(async () => {
    if (!user) return;
    const [athRes, plansRes] = await Promise.all([
      supabase
        .from("athletes")
        .select("id, full_name, phone, email, birth_date, plan_id, plans(price, duration_months)")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("plans").select("id, name, price, duration_months").eq("active", true).order("duration_months").order("price"),
    ]);

    if (athRes.data) {
      setAthlete({
        id: athRes.data.id,
        full_name: athRes.data.full_name,
        plan_id: athRes.data.plan_id,
        plans: athRes.data.plans as { price: number; duration_months: number } | null,
      });
      setFullName(athRes.data.full_name ?? "");
      setPhone(athRes.data.phone ?? "");
      setEmail(athRes.data.email ?? user.email ?? "");
      setBirthDate(athRes.data.birth_date ?? "");

      const subRes = await supabase
        .from("payment_submissions")
        .select("id, amount, reference_month, paid_at, status, rejection_reason, created_at")
        .eq("athlete_id", athRes.data.id)
        .order("created_at", { ascending: false });
      setSubmissions((subRes.data ?? []) as Submission[]);
    } else {
      setEmail(user.email ?? "");
    }
    setPlans((plansRes.data ?? []) as PaymentDialogPlan[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!athlete) return;
    setSaving(true);
    const { error } = await supabase
      .from("athletes")
      .update({
        full_name: fullName,
        phone: phone || null,
        email: email || null,
        birth_date: birthDate || null,
      })
      .eq("id", athlete.id);
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

      <main className="relative z-10 max-w-2xl mx-auto px-4 md:px-8 mt-8 space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="size-4" /> Voltar
        </Link>

        <div className="glass rounded-[40px] p-8 md:p-10">
          <h1 className="font-heading text-3xl font-extrabold text-ocean-deep mb-2">Meu perfil</h1>
          <p className="text-muted-foreground mb-8">Mantenha suas informações sempre atualizadas.</p>

          {!athlete ? (
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
              <Button type="submit" disabled={saving} size="lg" className="w-full">
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Salvar alterações"}
              </Button>
            </form>
          )}
        </div>

        {athlete && (
          <div className="glass rounded-[40px] p-8 md:p-10">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="font-heading text-2xl font-extrabold text-ocean-deep">Meus pagamentos</h2>
                <p className="text-sm text-muted-foreground mt-1">Envie seu comprovante para aprovação do admin.</p>
              </div>
              <Button onClick={() => setPayOpen(true)}>
                <Plus className="size-4 mr-1" /> Enviar pagamento
              </Button>
            </div>

            {submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum pagamento enviado ainda.</p>
            ) : (
              <ul className="space-y-2">
                {submissions.map((s) => (
                  <li key={s.id} className="bg-white/60 rounded-2xl p-4 flex items-center gap-3">
                    <StatusIcon status={s.status} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ocean-deep">
                        {formatCurrency(Number(s.amount))} ·{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                          {format(new Date(s.reference_month + "T00:00:00"), "MMM/yy", { locale: ptBR })}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pago em {format(new Date(s.paid_at + "T00:00:00"), "dd/MM/yyyy")} · enviado{" "}
                        {format(new Date(s.created_at), "dd/MM HH:mm")}
                      </p>
                      {s.status === "rejected" && s.rejection_reason && (
                        <p className="text-xs text-destructive mt-1">Motivo: {s.rejection_reason}</p>
                      )}
                    </div>
                    <StatusLabel status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      {athlete && (
        <PaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          target={athlete}
          plans={plans}
          mode="submission"
          onSuccess={loadAll}
        />
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: Submission["status"] }) {
  if (status === "approved") return <CheckCircle2 className="size-5 text-success shrink-0" />;
  if (status === "rejected") return <XCircle className="size-5 text-destructive shrink-0" />;
  return <Clock className="size-5 text-warning shrink-0" />;
}

function StatusLabel({ status }: { status: Submission["status"] }) {
  const map = {
    pending: { text: "Em aprovação", cls: "bg-warning/15 text-warning" },
    approved: { text: "Aprovado", cls: "bg-success/15 text-success" },
    rejected: { text: "Rejeitado", cls: "bg-destructive/15 text-destructive" },
  } as const;
  const v = map[status];
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest rounded-full px-3 py-1 ${v.cls}`}>
      {v.text}
    </span>
  );
}
