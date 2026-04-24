import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Loader2, CalendarClock, Wallet, Trophy, ArrowDownRight } from "lucide-react";
import {
  computeStatus,
  formatCurrency,
  formatDate,
  formatMonth,
  type StatusInfo,
} from "@/lib/membership";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Profile {
  id: string;
  full_name: string;
  joined_at: string;
  plan_id: string | null;
  plans: { name: string; price: number; frequency_per_week: number } | null;
}

interface Payment {
  id: string;
  amount: number;
  reference_month: string;
  paid_at: string;
  method: string | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState<StatusInfo | null>(null);

  useEffect(() => {
    document.title = "Dashboard | Beach.Club";
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [profRes, paysRes, settingsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, joined_at, plan_id, plans(name, price, frequency_per_week)")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("payments")
          .select("id, amount, reference_month, paid_at, method")
          .eq("user_id", user.id)
          .order("reference_month", { ascending: false }),
        supabase.from("group_settings").select("grace_days").eq("id", 1).maybeSingle(),
      ]);

      const prof = profRes.data as Profile | null;
      const pays = (paysRes.data ?? []) as Payment[];
      const grace = settingsRes.data?.grace_days ?? 7;

      setProfile(prof);
      setPayments(pays);
      setStatus(computeStatus(pays, grace, prof?.joined_at));
      setLoading(false);
    })();
  }, [user]);

  if (loading || !status) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = profile?.full_name?.split(" ")[0] || "Jogador";
  const greeting = greet();
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="min-h-dvh pb-12">
      <div className="blur-orb size-[500px] bg-primary/20 -top-32 -right-32" />
      <div className="blur-orb size-[400px] bg-accent/20 top-[40%] -left-40" />

      <AppHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <h1 className="sr-only">Painel do membro</h1>

        <div className="grid grid-cols-12 gap-6">
          {/* HERO */}
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
                  value={profile?.plans ? formatCurrency(Number(profile.plans.price)) : "—"}
                  hint={profile?.plans?.name ?? "Sem plano definido"}
                />
                <InfoCard
                  icon={<CalendarClock className="size-5" />}
                  label="Próximo vencimento"
                  value={format(status.nextDueDate, "dd MMM", { locale: ptBR })}
                  hint={
                    status.daysUntilDue !== null
                      ? status.daysUntilDue >= 0
                        ? `em ${status.daysUntilDue} dias`
                        : `${Math.abs(status.daysUntilDue)} dias atrasado`
                      : ""
                  }
                />
                <InfoCard
                  icon={<Trophy className="size-5" />}
                  label="Frequência"
                  value={
                    profile?.plans
                      ? `${profile.plans.frequency_per_week}x/sem`
                      : "—"
                  }
                  hint="seu ritmo na areia"
                />
              </div>
            </div>
          </section>

          {/* SIDE */}
          <aside className="col-span-12 lg:col-span-4">
            <div className="bg-gradient-deep text-primary-foreground rounded-[40px] p-8 relative overflow-hidden h-full">
              <div className="blur-orb size-40 bg-primary/40 -top-10 -right-10" />
              <h3 className="font-heading text-2xl font-extrabold mb-1">Resumo</h3>
              <p className="text-white/50 text-sm mb-8">Sua jornada no clube</p>

              <div className="space-y-6 relative">
                <Stat label="Total contribuído" value={formatCurrency(totalPaid)} />
                <Stat
                  label="Membro desde"
                  value={
                    profile?.joined_at
                      ? format(new Date(profile.joined_at), "MMM 'de' yyyy", { locale: ptBR })
                      : "—"
                  }
                />
                <Stat label="Pagamentos registrados" value={String(payments.length)} />
              </div>
            </div>
          </aside>

          {/* HISTORY */}
          <section className="col-span-12">
            <div className="flex items-end justify-between mb-4 px-2">
              <div>
                <h3 className="font-heading text-2xl font-extrabold text-ocean-deep">
                  Histórico de pagamentos
                </h3>
                <p className="text-sm text-muted-foreground">
                  Tudo que passou pela sua conta
                </p>
              </div>
            </div>

            <div className="glass rounded-[32px] overflow-hidden">
              {payments.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <p>Nenhum pagamento registrado ainda.</p>
                  <p className="text-sm mt-2">
                    Quando o admin registrar uma mensalidade, ela aparecerá aqui.
                  </p>
                </div>
              ) : (
                payments.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-5 hover:bg-white/40 transition-colors ${
                      i !== payments.length - 1 ? "border-b border-border/50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-gradient-aqua text-primary-foreground grid place-items-center shadow-glow">
                        <ArrowDownRight className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-ocean-deep capitalize">
                          {formatMonth(p.reference_month)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Pago em {formatDate(p.paid_at)}
                          {p.method ? ` · ${p.method}` : ""}
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

function InfoCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white/50 backdrop-blur p-5 rounded-3xl border border-white/60">
      <div className="flex items-center gap-2 text-primary mb-2">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="font-heading text-2xl font-extrabold text-ocean-deep tabular-nums">
        {value}
      </p>
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
    case "active":
      return "Sua mensalidade está em dia. Pega o protetor solar e vai pra quadra!";
    case "warning":
      return "Sua próxima mensalidade está chegando. Não esquece de regularizar.";
    case "overdue":
      return "Sua mensalidade está em atraso. Procure o admin do grupo para regularizar.";
    case "new":
      return "Bem-vindo ao grupo! Aguarde o admin registrar seu primeiro pagamento.";
    default:
      return "";
  }
}
