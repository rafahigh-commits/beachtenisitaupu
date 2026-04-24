import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Search, Users, DollarSign, AlertTriangle, CheckCircle2, Settings, Shield } from "lucide-react";
import { computeStatus, formatCurrency, formatMonth, type StatusInfo } from "@/lib/membership";
import { toast } from "sonner";
import { format } from "date-fns";

interface MemberRow {
  id: string;
  full_name: string;
  phone: string | null;
  joined_at: string;
  plan_id: string | null;
  plans: { name: string; price: number } | null;
  payments: { reference_month: string; paid_at: string; amount: number }[];
}

interface Plan {
  id: string;
  name: string;
  price: number;
  frequency_per_week: number;
}

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<(MemberRow & { status: StatusInfo })[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [graceDays, setGraceDays] = useState(7);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");

  // payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<MemberRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMonth, setPayMonth] = useState(format(new Date(), "yyyy-MM-01"));
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [payMethod, setPayMethod] = useState("PIX");
  const [paySaving, setPaySaving] = useState(false);

  // role dialog
  const [roleTarget, setRoleTarget] = useState<MemberRow | null>(null);

  useEffect(() => {
    document.title = "Admin | Beach.Club";
  }, []);

  const load = useCallback(async () => {
    const [membersRes, plansRes, settingsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, phone, joined_at, plan_id, plans(name, price), payments(reference_month, paid_at, amount)",
        )
        .order("full_name"),
      supabase.from("plans").select("id, name, price, frequency_per_week").order("frequency_per_week"),
      supabase.from("group_settings").select("grace_days, group_name").eq("id", 1).maybeSingle(),
    ]);

    const grace = settingsRes.data?.grace_days ?? 7;
    setGraceDays(grace);
    setGroupName(settingsRes.data?.group_name ?? "");

    const list = ((membersRes.data ?? []) as MemberRow[]).map((m) => ({
      ...m,
      status: computeStatus(m.payments ?? [], grace, m.joined_at),
    }));
    setMembers(list);
    setPlans((plansRes.data ?? []) as Plan[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = members.filter((m) =>
    m.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  const stats = {
    total: members.length,
    active: members.filter((m) => m.status.status === "active").length,
    overdue: members.filter((m) => m.status.status === "overdue").length,
    revenue: members
      .filter((m) => m.status.status === "active")
      .reduce((s, m) => s + Number(m.plans?.price ?? 0), 0),
  };

  function openPayDialog(m: MemberRow) {
    setPayTarget(m);
    setPayAmount(String(m.plans?.price ?? ""));
    setPayMonth(format(new Date(), "yyyy-MM-01"));
    setPayDate(format(new Date(), "yyyy-MM-dd"));
    setPayMethod("PIX");
    setPayOpen(true);
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    setPaySaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("payments").insert({
      user_id: payTarget.id,
      amount: Number(payAmount),
      reference_month: payMonth,
      paid_at: payDate,
      method: payMethod,
      created_by: userData.user?.id,
    });
    setPaySaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pagamento registrado!");
    setPayOpen(false);
    load();
  }

  async function saveSettings() {
    const { error } = await supabase
      .from("group_settings")
      .update({ grace_days: graceDays, group_name: groupName })
      .eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas!");
    load();
  }

  async function makeAdmin(memberId: string) {
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: memberId, role: "admin" });
    if (error) return toast.error(error.message);
    toast.success("Membro promovido a admin!");
    setRoleTarget(null);
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
      <div className="blur-orb size-[500px] bg-primary/20 -top-40 -right-40" />
      <div className="blur-orb size-[400px] bg-accent/20 bottom-0 -left-32" />

      <AppHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <header className="mb-8">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-3 py-1 mb-3">
            <Shield className="size-3" /> Painel Administrativo
          </span>
          <h1 className="font-heading text-4xl font-extrabold text-ocean-deep">
            Comando do Clube
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe todos os membros, pagamentos e configurações.
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Users className="size-5" />} label="Total membros" value={stats.total} tone="primary" />
          <StatCard icon={<CheckCircle2 className="size-5" />} label="Em dia" value={stats.active} tone="success" />
          <StatCard icon={<AlertTriangle className="size-5" />} label="Em atraso" value={stats.overdue} tone="destructive" />
          <StatCard icon={<DollarSign className="size-5" />} label="Receita ativa" value={formatCurrency(stats.revenue)} tone="accent" />
        </div>

        <Tabs defaultValue="members">
          <TabsList className="mb-6">
            <TabsTrigger value="members">Membros</TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <div className="glass rounded-[32px] p-6 md:p-8">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-6">
                <div className="relative max-w-sm flex-1">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar jogador..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filtered.length === 0 && (
                  <p className="text-center text-muted-foreground py-12">
                    Nenhum membro encontrado.
                  </p>
                )}
                {filtered.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col md:flex-row md:items-center gap-4 p-4 md:p-5 rounded-2xl bg-white/60 hover:bg-white/80 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="size-12 rounded-2xl bg-gradient-aqua text-primary-foreground font-bold grid place-items-center shadow-glow shrink-0">
                        {m.full_name.slice(0, 2).toUpperCase() || "??"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ocean-deep truncate">
                          {m.full_name || "Sem nome"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.plans?.name ?? "Sem plano"} ·{" "}
                          {m.phone ?? "sem WhatsApp"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <StatusBadge status={m.status.status} label={m.status.label} size="sm" />
                      {m.status.lastPayment && (
                        <span className="text-xs text-muted-foreground capitalize">
                          últ: {formatMonth(m.status.lastPayment.reference_month)}
                        </span>
                      )}
                      <Button size="sm" onClick={() => openPayDialog(m)}>
                        <Plus className="size-4 mr-1" /> Pagamento
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRoleTarget(m)}>
                        <Shield className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="plans">
            <div className="glass rounded-[32px] p-6 md:p-8 grid sm:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div key={p.id} className="bg-white/70 rounded-2xl p-6 border border-border/50">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    {p.frequency_per_week}x por semana
                  </p>
                  <h3 className="font-heading text-xl font-extrabold text-ocean-deep mb-1">
                    {p.name}
                  </h3>
                  <p className="font-heading text-3xl font-extrabold text-refract">
                    {formatCurrency(Number(p.price))}
                  </p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="glass rounded-[32px] p-6 md:p-8 max-w-xl">
              <div className="flex items-center gap-2 mb-6">
                <Settings className="size-5 text-primary" />
                <h3 className="font-heading text-xl font-extrabold text-ocean-deep">
                  Regras do grupo
                </h3>
              </div>
              <div className="space-y-5">
                <div>
                  <Label htmlFor="group-name">Nome do grupo</Label>
                  <Input
                    id="group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="grace">Tolerância de atraso (dias)</Label>
                  <Input
                    id="grace"
                    type="number"
                    min={0}
                    max={30}
                    value={graceDays}
                    onChange={(e) => setGraceDays(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quantos dias após o vencimento o membro continua "em dia".
                  </p>
                </div>
                <Button onClick={saveSettings}>Salvar configurações</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <form onSubmit={handleSavePayment}>
            <DialogHeader>
              <DialogTitle>Registrar pagamento</DialogTitle>
              <DialogDescription>
                {payTarget?.full_name ?? "Membro"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mês de referência</Label>
                  <Input
                    type="month"
                    required
                    value={payMonth.slice(0, 7)}
                    onChange={(e) => setPayMonth(e.target.value + "-01")}
                  />
                </div>
                <div>
                  <Label>Pago em</Label>
                  <Input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Forma</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Transferência">Transferência</SelectItem>
                    <SelectItem value="Cartão">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={paySaving}>
                {paySaving ? <Loader2 className="size-4 animate-spin" /> : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Role dialog */}
      <Dialog open={!!roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promover a administrador</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja dar acesso de admin para{" "}
              <strong>{roleTarget?.full_name}</strong>? Eles poderão ver todos os membros e
              registrar pagamentos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={() => roleTarget && makeAdmin(roleTarget.id)}>
              Promover a admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "primary" | "success" | "destructive" | "accent";
}) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    destructive: "text-destructive bg-destructive/10",
    accent: "text-accent-foreground bg-accent/30",
  };
  return (
    <div className="glass rounded-2xl p-5">
      <div className={`size-10 rounded-xl grid place-items-center mb-3 ${tones[tone]}`}>
        {icon}
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-heading text-2xl font-extrabold text-ocean-deep tabular-nums mt-1">
        {value}
      </p>
    </div>
  );
}
