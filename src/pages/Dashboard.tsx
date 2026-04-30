import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Loader2, CalendarClock, Wallet, Trophy, ArrowDownRight, AlertCircle } from "lucide-react";
import {
  computeStatus, formatCurrency, formatDate, formatMonth,
  type StatusInfo, type ManualStatus,
} from "@/lib/membership";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

interface Athlete {
  id: string;
  full_name: string;
  joined_at: string | null;
  plan_id: string | null;
  manual_status: ManualStatus | null;
  plans: { name: string; price: number; duration_months: number } | null;
}

interface Payment {
  id: string;
  amount: number;
  reference_month: string;
  paid_at: string;
  due_date: string | null;
  method: string | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [unlinked, setUnlinked] = useState(false);

  useEffect(() => {
    document.title = "Dashboard | Itaipu Beach Tennis";
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const settingsRes = await supabase
        .from("group_settings")
        .select("charge_days, inactive_days")
        .eq("id", 1)
        .maybeSingle();
      const cd = settingsRes.data?.charge_days ?? 40;
      const id = settingsRes.data?.inactive_days ?? 120;

      // Buscar atleta vinculado a este user
      const athRes = await supabase
        .from("athletes")
        .select("id, full_name, joined_at, plan_id, manual_status, plans(name, price, duration_months)")
        .eq("user_id", user.id)
        .maybeSingle();

      const ath = athRes.data as Athlete | null;
      if (!ath) {
        setUnlinked(true);
        setLoading(false);
        return;
      }

      const paysRes = await supabase
        .from("payments")
        .select("id, amount, reference_month, paid_at, due_date, method")
        .eq("athlete_id", ath.id)
        .order("reference_month", { ascending: false });

      const pays = (paysRes.data ?? []) as Payment[];
      setAthlete(ath);
      setPayments(pays);
      setStatus(computeStatus(
        pays, cd, id,
        ath.manual_status,
        ath.plans ? { duration_months: ath.plans.duration_months } : undefined,
        ath.joined_at ?? undefined,
      ));
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return <div className="min-h-dvh grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  if (unlinked) {
    return (
      <div className="min-h-dvh pb-12">
        <AppHeader />
        <main className="max-w-2xl mx-auto px-4 mt-12">
          <div className="glass rounded-[32px] p-8 text-center">
            <AlertCircle className="size-12 text-warning mx-auto mb-4" />
            <h2 className="font-heading text-2xl font-extrabold text-ocean-deep mb-2">
              Conta não vinculada
            </h2>
            <p className="text-muted-foreground mb-4">
              Sua conta foi criada, mas ainda não foi vinculada a um atleta cadastrado.
              Avise o administrador do grupo com seu email para fazer a vinculação.
            </p>
            <Link to="/perfil" className="text-primary font-semibold hover:underline">
              Ir para meu perfil →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!status || !athlete) return null;

  const firstName = athlete.full_name.split(" ")[0] || "Atleta";
  const greeting = greet();
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="min-h-dvh pb-12">
      <div className="blur-orb size-[500px] bg-primary/20 -top-32 -right-32" />
      <div className="blur-orb size-[400px] bg-accent/20 top-[40%] -left-40" />

      <AppHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <h1 className="sr-only">Painel do atleta</h1>

        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 lg:col-span-8">
            <div className="glass rounded-[40px] p-8 md:p-10 relative overflow-hidden">
              <div className="blur-orb size-64 bg-sun-flare/30 -top-24 -right-24" />
              <div className="blur-orb size-64 bg-primary/20 -bottom-24 -left-24" />

              <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
                <div>
                  <StatusBadge status={status.status} label={status.label} />
                  <h2 className="font-heading text-4xl md:text-5xl font-extrabold tracking-tighter mt-4 mb-2 text-ocean-deep">
                    {greeting}, <span className="text-refract">{firstName}.</span>
                  </h2>
                  <p className="text-muted-foreground text-lg max-w-[45ch]">
                    {messageFor(status.status)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative">
                <InfoCard
                  icon={<Wallet className="size-5" />}
                  label="Mensalidade"
                  value={athlete.plans ? formatCurrency(Number(athlete.plans.price)) : "—"}
                  hint={athlete.plans?.name ?? "Sem plano"}
                />
                <InfoCard
                  icon={<CalendarClock className="size-5" />}
                  label="Validade até"
                  value={status.lastDueDate ? format(status.lastDueDate, "dd MMM yy", { locale: ptBR }) : "—"}
                  hint={
                    status.daysSinceDue !== null
                      ? status.daysSinceDue > 0
                        ? `vencido há ${status.daysSinceDue} dias`
                        : `restam ${Math.abs(status.daysSinceDue)} dias`
                      : "Sem pagamento"
                  }
                />
                <InfoCard
                  icon={<Trophy className="size-5" />}
                  label="Plano"
                  value={athlete.plans ? `${athlete.plans.duration_months}m` : "—"}
                  hint={athlete.plans?.duration_months === 1 ? "mensal" : "duração"}
                />
              </div>
            </div>
          </section>

          <aside className="col-span-12 lg:col-span-4">
            <div className="glass rounded-[40px] p-8 relative overflow-hidden h-full">
              <div className="blur-orb size-40 bg-primary/20 -top-10 -right-10" />
              <h3 className="font-heading text-2xl font-extrabold text-ocean-deep mb-1 relative">Resumo</h3>
              <p className="text-muted-foreground text-sm mb-8 relative">Sua jornada no clube</p>

              <div className="space-y-5 relative">
                <Stat label="Total contribuído" value={formatCurrency(totalPaid)} />
                <Stat
                  label="Atleta desde"
                  value={athlete.joined_at ? format(new Date(athlete.joined_at), "MMM/yy", { locale: ptBR }) : "—"}
                />
                <Stat label="Pagamentos" value={String(payments.length)} />
              </div>
            </div>
          </aside>

          <section className="col-span-12">
            <div className="flex items-end justify-between mb-4 px-2">
              <div>
                <h3 className="font-heading text-2xl font-extrabold text-ocean-deep">
                  Histórico de pagamentos
                </h3>
                <p className="text-sm text-muted-foreground">Tudo que passou pela sua conta</p>
              </div>
            </div>

            <div className="glass rounded-[32px] overflow-hidden">
              {payments.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <p>Nenhum pagamento registrado ainda.</p>
                </div>
              ) : (
                payments.map((p, i) => (
                  <div key={p.id} className={`flex items-center justify-between p-5 hover:bg-white/40 transition-colors ${i !== payments.length - 1 ? "border-b border-border/50" : ""}`}>
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-gradient-aqua text-primary-foreground grid place-items-center shadow-glow">
                        <ArrowDownRight className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-ocean-deep capitalize">{formatMonth(p.reference_month)}</p>
                        <p className="text-sm text-muted-foreground">
                          Pago em {formatDate(p.paid_at)}{p.method ? ` · ${p.method}` : ""}
                        </p>
                      </div>
                    </div>
                    <p className="font-heading font-bold text-lg tabular-nums text-ocean-deep">
                      {formatCurrency(Number(p.amount))}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function InfoCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white/50 backdrop-blur p-5 rounded-3xl border border-white/60">
      <div className="flex items-center gap-2 text-primary mb-2">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="font-heading text-2xl font-extrabold text-ocean-deep tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end justify-between border-b border-white/10 pb-4 last:border-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className="font-heading font-bold tabular-nums">{value}</span>
    </div>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function messageFor(s: string) {
  switch (s) {
    case "active": return "Sua mensalidade está em dia. Pega o protetor solar e vai pra areia!";
    case "warning": return "Sua mensalidade vence em breve. Já pode renovar.";
    case "charge": return "Sua mensalidade está em atraso. Entre em contato com o admin.";
    case "inactive": return "Sua mensalidade está inativa há muito tempo. Procure o admin.";
    case "exempt": return "Você é um membro isento — obrigado pela sua contribuição ao grupo.";
    case "sick": return "Esperamos sua recuperação para te ver de volta na areia!";
    case "left": return "Esta conta foi marcada como inativa.";
    case "new": return "Bem-vindo ao grupo! Aguarde seu primeiro pagamento ser registrado.";
    default: return "";
  }
}
