import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Plus, Search, Users, DollarSign, AlertTriangle,
  CheckCircle2, Settings, UserCog, Pencil, MessageSquare,
} from "lucide-react";
import { MessagesTab } from "@/components/admin/MessagesTab";
import { PendingTab } from "@/components/admin/PendingTab";
import { Inbox } from "lucide-react";
import {
  computeStatus, formatCurrency, formatMonth,
  type StatusInfo, type ManualStatus, type Status,
} from "@/lib/membership";
import { toast } from "sonner";
import { format } from "date-fns";

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_months: number;
}

interface Athlete {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  joined_at: string | null;
  plan_id: string | null;
  manual_status: ManualStatus | null;
  notes: string | null;
  user_id: string | null;
  legacy_id: number | null;
  plans: { name: string; price: number; duration_months: number } | null;
  payments: { reference_month: string; paid_at: string; amount: number; due_date: string | null }[];
}

type AthleteWithStatus = Athlete & { status: StatusInfo };

const STATUS_FILTERS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Em dia" },
  { value: "warning", label: "Vence em breve" },
  { value: "charge", label: "Atrasado" },
  { value: "inactive", label: "Inativos" },
  { value: "exempt", label: "Isentos" },
  { value: "sick", label: "Doentes" },
  { value: "left", label: "Saíram" },
];

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [athletes, setAthletes] = useState<AthleteWithStatus[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [chargeDays, setChargeDays] = useState(40);
  const [inactiveDays, setInactiveDays] = useState(120);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Athlete | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMonth, setPayMonth] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payDueDate, setPayDueDate] = useState("");
  const [paySelectedPlanId, setPaySelectedPlanId] = useState<string>("custom");
  const [payReceiptFile, setPayReceiptFile] = useState<File | null>(null);
  const [paySaving, setPaySaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Athlete | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    document.title = "Admin | Itaipu Beach Tennis";
  }, []);

  const load = useCallback(async () => {
    const [athRes, paysRes, plansRes, settingsRes] = await Promise.all([
      supabase
        .from("athletes")
        .select("id, full_name, phone, email, birth_date, joined_at, plan_id, manual_status, notes, user_id, legacy_id, plans(name, price, duration_months)")
        .order("full_name"),
      supabase.from("payments").select("athlete_id, reference_month, paid_at, amount, due_date"),
      supabase.from("plans").select("id, name, price, duration_months").eq("active", true).order("duration_months").order("price"),
      supabase.from("group_settings").select("charge_days, inactive_days, group_name").eq("id", 1).maybeSingle(),
    ]);

    const cd = settingsRes.data?.charge_days ?? 40;
    const id = settingsRes.data?.inactive_days ?? 120;
    setChargeDays(cd);
    setInactiveDays(id);
    setGroupName(settingsRes.data?.group_name ?? "");

    const paysByAth = new Map<string, Athlete["payments"]>();
    for (const p of (paysRes.data ?? []) as Array<{
      athlete_id: string; reference_month: string; paid_at: string; amount: number; due_date: string | null;
    }>) {
      const arr = paysByAth.get(p.athlete_id) ?? [];
      arr.push({ reference_month: p.reference_month, paid_at: p.paid_at, amount: Number(p.amount), due_date: p.due_date });
      paysByAth.set(p.athlete_id, arr);
    }

    const list = ((athRes.data ?? []) as Omit<Athlete, "payments">[]).map(
      (a): AthleteWithStatus => {
        const pays = paysByAth.get(a.id) ?? [];
        return {
          ...a,
          payments: pays,
          status: computeStatus(
            pays, cd, id,
            a.manual_status,
            a.plans ? { duration_months: a.plans.duration_months } : undefined,
            a.joined_at ?? undefined,
          ),
        };
      },
    );
    setAthletes(list);
    setPlans((plansRes.data ?? []) as Plan[]);

    const { count } = await supabase
      .from("payment_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingCount(count ?? 0);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return athletes.filter((a) => {
      const matchSearch = !q || a.full_name.toLowerCase().includes(q) || (a.phone ?? "").includes(q);
      const matchStatus = statusFilter === "all" || a.status.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [athletes, search, statusFilter]);

  const stats = useMemo(() => {
    const counted = athletes.filter((a) => a.status.status !== "left");
    return {
      total: counted.length,
      active: athletes.filter((a) => a.status.status === "active").length,
      overdue: athletes.filter((a) => ["charge", "inactive"].includes(a.status.status)).length,
      revenue: athletes
        .filter((a) => a.status.status === "active")
        .reduce((s, a) => s + Number(a.plans?.price ?? 0), 0),
    };
  }, [athletes]);

  function openPayDialog(a: Athlete) {
    setPayTarget(a);
    // Pré-seleciona plano do atleta, se houver
    const planId = a.plan_id && plans.some((p) => p.id === a.plan_id) ? a.plan_id : "custom";
    setPaySelectedPlanId(planId);
    if (planId !== "custom") {
      const p = plans.find((pl) => pl.id === planId);
      setPayAmount(p ? String(p.price) : "");
    } else {
      setPayAmount(String(a.plans?.price ?? ""));
    }
    setPayMonth("");
    setPayDate("");
    setPayDueDate("");
    setPayReceiptFile(null);
    setPayOpen(true);
  }

  function handleMonthChange(value: string) {
    // value vem como "YYYY-MM"
    const monthIso = value ? value + "-01" : "";
    setPayMonth(monthIso);
    if (!monthIso) {
      setPayDueDate("");
      return;
    }
    // Determina duração em meses do plano selecionado (ou do atleta, ou 1)
    let months = 1;
    if (paySelectedPlanId !== "custom") {
      months = plans.find((p) => p.id === paySelectedPlanId)?.duration_months ?? 1;
    } else {
      months = payTarget?.plans?.duration_months ?? 1;
    }
    const [y, m] = value.split("-").map(Number);
    const due = new Date(y, m - 1 + months, 1);
    due.setDate(due.getDate() - 1);
    setPayDueDate(format(due, "yyyy-MM-dd"));
  }

  function handlePlanSelect(planId: string) {
    setPaySelectedPlanId(planId);
    if (planId !== "custom") {
      const p = plans.find((pl) => pl.id === planId);
      if (p) setPayAmount(String(p.price));
      // Recalcula validade se já houver mês
      if (payMonth) {
        const [y, m] = payMonth.split("-").map(Number);
        const months = p?.duration_months ?? 1;
        const due = new Date(y, m - 1 + months, 1);
        due.setDate(due.getDate() - 1);
        setPayDueDate(format(due, "yyyy-MM-dd"));
      }
    }
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    setPaySaving(true);

    let receiptPath: string | null = null;
    if (payReceiptFile) {
      const maxBytes = 5 * 1024 * 1024;
      if (payReceiptFile.size > maxBytes) {
        setPaySaving(false);
        toast.error("Comprovante deve ter no máximo 5 MB.");
        return;
      }
      const allowed = ["application/pdf"];
      const isImage = payReceiptFile.type.startsWith("image/");
      if (!isImage && !allowed.includes(payReceiptFile.type)) {
        setPaySaving(false);
        toast.error("Comprovante deve ser imagem ou PDF.");
        return;
      }
      const safeName = payReceiptFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${payTarget.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("payment-receipts")
        .upload(path, payReceiptFile, { upsert: false, contentType: payReceiptFile.type });
      if (upErr) {
        setPaySaving(false);
        toast.error("Falha ao enviar comprovante: " + upErr.message);
        return;
      }
      receiptPath = path;
    }

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("payments").insert({
      athlete_id: payTarget.id,
      amount: Number(payAmount),
      reference_month: payMonth,
      paid_at: payDate,
      due_date: payDueDate || null,
      method: "PIX",
      receipt_url: receiptPath,
      created_by: userData.user?.id,
    });
    setPaySaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pagamento registrado!");
    setPayOpen(false);
    load();
  }

  async function saveSettings() {
    const { error } = await supabase
      .from("group_settings")
      .update({ charge_days: chargeDays, inactive_days: inactiveDays, group_name: groupName })
      .eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas!");
    load();
  }

  if (loading) {
    return <div className="min-h-dvh grid place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-dvh pb-12">
      <div className="blur-orb size-[500px] bg-primary/20 -top-40 -right-40" />
      <div className="blur-orb size-[400px] bg-accent/20 bottom-0 -left-32" />

      <AppHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <header className="mb-8">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-3 py-1 mb-3">
            <UserCog className="size-3" /> Painel Administrativo
          </span>
          <h1 className="font-heading text-4xl font-extrabold text-ocean-deep">Comando do Clube</h1>
          <p className="text-muted-foreground mt-1">{athletes.length} atletas cadastrados.</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Users className="size-5" />} label="Atletas ativos no grupo" value={stats.total} tone="primary" />
          <StatCard icon={<CheckCircle2 className="size-5" />} label="Em dia" value={stats.active} tone="success" />
          <StatCard icon={<AlertTriangle className="size-5" />} label="Cobrança / Inativos" value={stats.overdue} tone="destructive" />
          <StatCard icon={<DollarSign className="size-5" />} label="Receita ativa" value={formatCurrency(stats.revenue)} tone="accent" />
        </div>

        <Tabs defaultValue="members">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="members">Atletas</TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              <Inbox className="size-4 mr-1.5" /> Pendências
              {pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-warning text-warning-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="size-4 mr-1.5" /> Comunicações
            </TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <PendingTab onApproved={load} />
          </TabsContent>

          <TabsContent value="members">
            <div className="glass rounded-[32px] p-4 md:p-6">
              <div className="flex flex-col md:flex-row gap-3 md:items-center mb-5">
                <div className="relative flex-1">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | "all")}>
                  <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" /> Novo atleta
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                Mostrando <strong>{filtered.length}</strong> de {athletes.length}
              </p>

              <div className="space-y-2">
                {filtered.length === 0 && (
                  <p className="text-center text-muted-foreground py-12">Nenhum atleta encontrado.</p>
                )}
                {filtered.map((a) => (
                  <div key={a.id} className="flex flex-col md:flex-row md:items-center gap-3 p-3 md:p-4 rounded-2xl bg-white/60 hover:bg-white/80 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="size-10 rounded-xl bg-gradient-aqua text-primary-foreground font-bold grid place-items-center shadow-glow shrink-0 text-sm">
                        {a.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ocean-deep truncate">{a.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.plans?.name ?? "Sem plano"} · {a.phone ?? "sem WhatsApp"}
                        </p>
                        {(() => {
                          const last = [...a.payments].sort((x, y) => y.paid_at.localeCompare(x.paid_at))[0];
                          return (
                            <p className="text-xs text-muted-foreground truncate">
                              Último pagto:{" "}
                              {last
                                ? `${format(new Date(last.paid_at + "T00:00:00"), "dd/MM/yyyy")} · ${formatCurrency(last.amount)}`
                                : "—"}
                            </p>
                          );
                        })()}
                        {a.notes && (
                          <p className="text-xs text-muted-foreground/80 italic truncate mt-0.5" title={a.notes}>
                            📝 {a.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <div className="flex flex-col items-end gap-0.5">
                        <StatusBadge status={a.status.status} label={a.status.label} size="sm" />
                        {(() => {
                          const dues = a.payments
                            .map((p) => p.due_date)
                            .filter((d): d is string => !!d)
                            .sort();
                          const latest = dues.length ? dues[dues.length - 1] : null;
                          return (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              Validade: {latest ? format(new Date(latest + "T00:00:00"), "dd/MM/yyyy") : "—"}
                              {latest && a.status.daysSinceDue !== null && (
                                <> · {a.status.daysSinceDue > 0 ? `+${a.status.daysSinceDue}d` : `${a.status.daysSinceDue}d`}</>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                      <Button size="sm" onClick={() => openPayDialog(a)}>
                        <Plus className="size-4 mr-1" /> Pagto
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditTarget(a); setEditOpen(true); }}>
                        <Pencil className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="plans">
            <div className="glass rounded-[32px] p-6 md:p-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((p) => (
                <PlanCard key={p.id} plan={p} onSaved={load} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="messages">
            <MessagesTab athletes={athletes} />
          </TabsContent>

          <TabsContent value="settings">
            <div className="glass rounded-[32px] p-6 md:p-8 max-w-xl">
              <div className="flex items-center gap-2 mb-6">
                <Settings className="size-5 text-primary" />
                <h3 className="font-heading text-xl font-extrabold text-ocean-deep">Regras do grupo</h3>
              </div>
              <div className="space-y-5">
                <div>
                  <Label htmlFor="group-name">Nome do grupo</Label>
                  <Input id="group-name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="charge">Dias para entrar em atraso</Label>
                  <Input id="charge" type="number" min={0} value={chargeDays} onChange={(e) => setChargeDays(Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground mt-1">Após X dias do vencimento o atleta entra em atraso.</p>
                </div>
                <div>
                  <Label htmlFor="inactive">Dias para virar inativo</Label>
                  <Input id="inactive" type="number" min={0} value={inactiveDays} onChange={(e) => setInactiveDays(Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground mt-1">Após X dias do vencimento o atleta é considerado inativo.</p>
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
              <DialogDescription>{payTarget?.full_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Plano / Valor</Label>
                <Select value={paySelectedPlanId} onValueChange={handlePlanSelect}>
                  <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(Number(p.price))}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Outro valor</SelectItem>
                  </SelectContent>
                </Select>
                {paySelectedPlanId === "custom" && (
                  <Input
                    className="mt-2"
                    type="number"
                    step="0.01"
                    required
                    placeholder="Valor (R$)"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mês de referência</Label>
                  <Input
                    type="month"
                    required
                    value={payMonth ? payMonth.slice(0, 7) : ""}
                    onChange={(e) => handleMonthChange(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Pago em</Label>
                  <Input type="date" required value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Validade até</Label>
                <Input type="date" value={payDueDate} onChange={(e) => setPayDueDate(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Calculada a partir do mês de referência. Ajuste se necessário.</p>
              </div>
              <div>
                <Label htmlFor="receipt">Comprovante (opcional)</Label>
                <Input
                  id="receipt"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setPayReceiptFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground mt-1">Imagem ou PDF, até 5 MB.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={paySaving}>
                {paySaving ? <Loader2 className="size-4 animate-spin" /> : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit athlete dialog */}
      <EditAthleteDialog
        open={editOpen}
        athlete={editTarget}
        plans={plans}
        onClose={() => { setEditOpen(false); setEditTarget(null); }}
        onSaved={() => { setEditOpen(false); setEditTarget(null); load(); }}
      />
      <EditAthleteDialog
        open={createOpen}
        athlete={null}
        plans={plans}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); load(); }}
      />
    </div>
  );
}

function EditAthleteDialog({
  open, athlete, plans, onClose, onSaved,
}: {
  open: boolean; athlete: Athlete | null; plans: Plan[];
  onClose: () => void; onSaved: () => void;
}) {
  const isCreate = !athlete;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [joinedAt, setJoinedAt] = useState("");
  const [planId, setPlanId] = useState<string>("");
  const [manualStatus, setManualStatus] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (athlete) {
      setFullName(athlete.full_name);
      setPhone(athlete.phone ?? "");
      setEmail(athlete.email ?? "");
      setBirthDate(athlete.birth_date ?? "");
      setJoinedAt(athlete.joined_at ?? "");
      setPlanId(athlete.plan_id ?? "");
      setManualStatus(athlete.manual_status ?? "");
      setNotes(athlete.notes ?? "");
      setLinkedUserId(athlete.user_id ?? null);
    } else {
      setFullName("");
      setPhone("");
      setEmail("");
      setBirthDate("");
      setJoinedAt(format(new Date(), "yyyy-MM-dd"));
      setPlanId("");
      setManualStatus("");
      setNotes("");
      setLinkedUserId(null);
    }
  }, [athlete, open]);

  async function linkByEmail() {
    if (!athlete) return;
    const target = (email || athlete.email || "").trim();
    if (!target) { toast.error("Informe um email para buscar."); return; }
    setLinking(true);
    const { data, error } = await supabase.rpc("find_user_by_email", { _email: target });
    if (error) { setLinking(false); toast.error(error.message); return; }
    if (!data) {
      setLinking(false);
      toast.error("Nenhuma conta encontrada com esse email.");
      return;
    }
    const { error: updErr } = await supabase
      .from("athletes")
      .update({ user_id: data as string })
      .eq("id", athlete.id);
    setLinking(false);
    if (updErr) { toast.error(updErr.message); return; }
    setLinkedUserId(data as string);
    toast.success("Conta vinculada!");
    onSaved();
  }

  async function unlink() {
    if (!athlete) return;
    setLinking(true);
    const { error } = await supabase
      .from("athletes")
      .update({ user_id: null })
      .eq("id", athlete.id);
    setLinking(false);
    if (error) { toast.error(error.message); return; }
    setLinkedUserId(null);
    toast.success("Conta desvinculada.");
    onSaved();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      full_name: fullName,
      phone: phone || null,
      email: email || null,
      birth_date: birthDate || null,
      joined_at: joinedAt || null,
      plan_id: planId || null,
      manual_status: (manualStatus || null) as ManualStatus | null,
      notes: notes || null,
    };
    const { error } = isCreate
      ? await supabase.from("athletes").insert(payload)
      : await supabase.from("athletes").update(payload).eq("id", athlete!.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isCreate ? "Atleta cadastrado!" : "Atleta atualizado!");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{isCreate ? "Novo atleta" : "Editar atleta"}</DialogTitle>
            <DialogDescription>
              {isCreate ? "Cadastre um novo atleta no clube." : athlete?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div><Label>Nome completo</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>WhatsApp</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Aniversário</Label><Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></div>
              <div><Label>Entrada</Label><Input type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} /></div>
            </div>
            <div>
              <Label>Plano</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(Number(p.price))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status manual (sobrescreve cálculo)</Label>
              <Select value={manualStatus || "none"} onValueChange={(v) => setManualStatus(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum (calcular)</SelectItem>
                  <SelectItem value="isento">Isento</SelectItem>
                  <SelectItem value="doente">Doente</SelectItem>
                  <SelectItem value="saiu">Saiu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            {!isCreate && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Conta vinculada</Label>
                {linkedUserId ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm">
                      <span className="text-success font-semibold">Vinculado</span>
                      <span className="text-muted-foreground"> · {linkedUserId.slice(0, 8)}…</span>
                    </p>
                    <Button type="button" size="sm" variant="outline" onClick={unlink} disabled={linking}>
                      Desvincular
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">Nenhuma conta vinculada.</p>
                    <Button type="button" size="sm" onClick={linkByEmail} disabled={linking || !email}>
                      {linking ? <Loader2 className="size-4 animate-spin" /> : "Vincular por email"}
                    </Button>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Busca um usuário cadastrado com este email e liga ao atleta. A vinculação também acontece automaticamente quando o atleta cria conta.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlanCard({ plan, onSaved }: { plan: Plan; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price));
  const [months, setMonths] = useState(String(plan.duration_months));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(plan.name);
    setPrice(String(plan.price));
    setMonths(String(plan.duration_months));
  }, [plan]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("plans")
      .update({
        name,
        price: Number(price),
        duration_months: Number(months),
      })
      .eq("id", plan.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Plano atualizado!");
    setEditing(false);
    onSaved();
  }

  if (editing) {
    return (
      <div className="bg-white/80 rounded-2xl p-5 border border-primary/40 space-y-3">
        <div>
          <Label className="text-[10px]">Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">Preço (R$)</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px]">Meses</Label>
            <Input type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={save} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/70 rounded-2xl p-5 border border-border/50 group relative">
      <button
        onClick={() => setEditing(true)}
        className="absolute top-3 right-3 size-7 rounded-lg bg-white/60 hover:bg-primary hover:text-primary-foreground grid place-items-center transition-colors"
        aria-label="Editar plano"
      >
        <Pencil className="size-3" />
      </button>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
        {plan.duration_months === 1 ? "Mensal" : `${plan.duration_months} meses`}
      </p>
      <h3 className="font-heading text-lg font-extrabold text-ocean-deep">{plan.name}</h3>
      <p className="font-heading text-2xl font-extrabold text-refract mt-2">
        {formatCurrency(Number(plan.price))}
      </p>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: string | number;
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
      <div className={`size-10 rounded-xl grid place-items-center mb-3 ${tones[tone]}`}>{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-extrabold text-ocean-deep tabular-nums mt-1">{value}</p>
    </div>
  );
}
