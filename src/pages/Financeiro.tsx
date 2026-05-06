import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, Plus, TrendingUp, TrendingDown, Wallet, Pencil, Trash2, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatMonth } from "@/lib/membership";

interface MonthSummary {
  month: string;
  payments_total: number;
  extras_total: number;
  income_total: number;
  expenses_total: number;
  balance: number;
  expenses_by_category: {
    category_id: string | null;
    category_name: string;
    color: string | null;
    total: number;
  }[];
}

interface YearMonth {
  month: string;
  payments_total: number;
  extras_total: number;
  income_total: number;
  expenses_total: number;
  balance: number;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
}

interface Expense {
  id: string;
  category_id: string | null;
  description: string;
  amount: number;
  expense_date: string;
  reference_month: string;
  notes: string | null;
}

interface ExtraIncome {
  id: string;
  description: string;
  amount: number;
  income_date: string;
  reference_month: string;
  source: string | null;
  notes: string | null;
}

const monthInputValue = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const monthToDate = (ym: string) => `${ym}-01`;

export default function Financeiro() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(monthInputValue(now));
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [yearData, setYearData] = useState<YearMonth[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin data
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [extras, setExtras] = useState<ExtraIncome[]>([]);

  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [extraDialog, setExtraDialog] = useState(false);
  const [editingExtra, setEditingExtra] = useState<ExtraIncome | null>(null);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [forecastIncome, setForecastIncome] = useState<Record<string, number>>({});
  const [forecastAvgExpenses, setForecastAvgExpenses] = useState(0);

  const loadSummary = useCallback(async () => {
    const { data, error } = await supabase.rpc("financial_summary_month", {
      _month: monthToDate(selectedMonth),
    });
    if (error) {
      toast.error("Erro ao carregar resumo: " + error.message);
      return;
    }
    setSummary(data as unknown as MonthSummary);
  }, [selectedMonth]);

  const loadYear = useCallback(async () => {
    const { data, error } = await supabase.rpc("financial_summary_year", {
      _year: selectedYear,
    });
    if (error) {
      toast.error("Erro ao carregar ano: " + error.message);
      return;
    }
    setYearData((data as unknown as YearMonth[]) ?? []);
  }, [selectedYear]);

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    const monthStart = monthToDate(selectedMonth);
    const [cats, exps, exts] = await Promise.all([
      supabase.from("expense_categories").select("*").order("name"),
      supabase
        .from("expenses")
        .select("*")
        .eq("reference_month", monthStart)
        .order("expense_date", { ascending: false }),
      supabase
        .from("extra_incomes")
        .select("*")
        .eq("reference_month", monthStart)
        .order("income_date", { ascending: false }),
    ]);
    if (cats.data) setCategories(cats.data);
    if (exps.data) setExpenses(exps.data);
    if (exts.data) setExtras(exts.data);
  }, [isAdmin, selectedMonth]);

  const loadForecast = useCallback(async () => {
    const [athletesRes, paymentsRes, expensesRes] = await Promise.all([
      supabase
        .from("athletes")
        .select("id, joined_at, manual_status, plan:plans(id, price, duration_months, active)"),
      supabase
        .from("payments")
        .select("athlete_id, reference_month, amount")
        .gte("reference_month", `${selectedYear - 1}-01-01`)
        .lte("reference_month", `${selectedYear}-12-31`),
      supabase
        .from("expenses")
        .select("amount, reference_month")
        .gte("reference_month", `${selectedYear}-01-01`)
        .lte("reference_month", `${selectedYear}-12-31`),
    ]);

    const athletes = (athletesRes.data ?? []) as Array<{
      id: string;
      joined_at: string | null;
      manual_status: string | null;
      plan: { id: string; price: number; duration_months: number; active: boolean } | null;
    }>;
    const allPayments = (paymentsRes.data ?? []) as Array<{
      athlete_id: string;
      reference_month: string;
      amount: number;
    }>;

    const byAthlete = new Map<string, typeof allPayments>();
    for (const p of allPayments) {
      const arr = byAthlete.get(p.athlete_id) ?? [];
      arr.push(p);
      byAthlete.set(p.athlete_id, arr);
    }

    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const incomeByMonth: Record<string, number> = {};

    for (const a of athletes) {
      if (!a.plan || !a.plan.active) continue;
      if (a.manual_status === "saiu" || a.manual_status === "isento") continue;
      const duration = a.plan.duration_months || 1;
      const price = Number(a.plan.price) || 0;
      if (price <= 0) continue;

      const payments = (byAthlete.get(a.id) ?? []).slice().sort(
        (x, y) => y.reference_month.localeCompare(x.reference_month),
      );

      let nextDate: Date;
      if (payments.length > 0) {
        const last = new Date(payments[0].reference_month);
        nextDate = new Date(last.getFullYear(), last.getMonth() + duration, 1);
      } else if (a.joined_at) {
        const j = new Date(a.joined_at);
        nextDate = new Date(j.getFullYear(), j.getMonth(), 1);
      } else {
        nextDate = new Date(currentMonthStart);
      }

      while (nextDate < currentMonthStart) {
        nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + duration, 1);
      }

      while (nextDate.getFullYear() === selectedYear) {
        const key = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`;
        incomeByMonth[key] = (incomeByMonth[key] ?? 0) + price;
        nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + duration, 1);
      }
    }

    const expByMonth: Record<string, number> = {};
    for (const e of (expensesRes.data ?? []) as Array<{ amount: number; reference_month: string }>) {
      const key = e.reference_month.slice(0, 7);
      expByMonth[key] = (expByMonth[key] ?? 0) + Number(e.amount);
    }
    const pastEntries = Object.entries(expByMonth).filter(([k, v]) => {
      const [y, m] = k.split("-").map(Number);
      return new Date(y, m - 1, 1) <= currentMonthStart && v > 0;
    });
    const avgExp = pastEntries.length > 0
      ? pastEntries.reduce((s, [, v]) => s + v, 0) / pastEntries.length
      : 0;

    setForecastIncome(incomeByMonth);
    setForecastAvgExpenses(avgExp);
  }, [selectedYear]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSummary(), loadYear(), loadAdminData(), loadForecast()]).finally(() =>
      setLoading(false),
    );
  }, [loadSummary, loadYear, loadAdminData, loadForecast]);

  const refreshAll = async () => {
    await Promise.all([loadSummary(), loadYear(), loadAdminData(), loadForecast()]);
  };

  const maxYearValue = useMemo(
    () =>
      Math.max(
        1,
        ...yearData.map((m) => Math.max(m.income_total, m.expenses_total)),
      ),
    [yearData],
  );

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-ocean-deep">
              Financeiro
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin
                ? "Controle de entradas, saídas e categorias"
                : "Resumo financeiro do clube"}
            </p>
          </div>
        </div>

        <Tabs defaultValue="month" className="space-y-6">
          <TabsList>
            <TabsTrigger value="month">Mês</TabsTrigger>
            <TabsTrigger value="year">Ano</TabsTrigger>
            {isAdmin && <TabsTrigger value="manage">Lançamentos</TabsTrigger>}
            {isAdmin && <TabsTrigger value="categories">Categorias</TabsTrigger>}
          </TabsList>

          {/* MÊS — onepage */}
          <TabsContent value="month" className="space-y-6">
            <div className="flex items-center gap-3">
              <Label htmlFor="month">Mês</Label>
              <Input
                id="month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-44"
              />
            </div>

            {loading || !summary ? (
              <div className="grid place-items-center py-20">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SummaryCard
                    icon={<TrendingUp className="size-5" />}
                    label="Entradas"
                    value={summary.income_total}
                    accent="emerald"
                    sub={`Mensalidades ${formatCurrency(
                      summary.payments_total,
                    )} + Extras ${formatCurrency(summary.extras_total)}`}
                  />
                  <SummaryCard
                    icon={<TrendingDown className="size-5" />}
                    label="Saídas"
                    value={summary.expenses_total}
                    accent="rose"
                    sub={`${summary.expenses_by_category.length} categoria(s)`}
                  />
                  <SummaryCard
                    icon={<Wallet className="size-5" />}
                    label="Saldo"
                    value={summary.balance}
                    accent={summary.balance >= 0 ? "ocean" : "rose"}
                    sub={formatMonth(summary.month)}
                  />
                </div>

                <div className="glass rounded-3xl p-6">
                  <h2 className="text-lg font-semibold text-ocean-deep mb-4">
                    Saídas por categoria
                  </h2>
                  {summary.expenses_by_category.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Nenhuma despesa registrada neste mês.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {summary.expenses_by_category.map((c) => {
                        const pct =
                          summary.expenses_total > 0
                            ? (c.total / summary.expenses_total) * 100
                            : 0;
                        return (
                          <div key={c.category_id ?? "none"} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span
                                  className="size-3 rounded-full"
                                  style={{
                                    backgroundColor: c.color ?? "hsl(var(--muted-foreground))",
                                  }}
                                />
                                <span className="font-medium text-ocean-deep">
                                  {c.category_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">
                                  {pct.toFixed(0)}%
                                </span>
                                <span className="font-semibold text-ocean-deep tabular-nums">
                                  {formatCurrency(c.total)}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor:
                                    c.color ?? "hsl(var(--primary))",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* ANO */}
          <TabsContent value="year" className="space-y-6">
            <div className="flex items-center gap-3">
              <Label htmlFor="year">Ano</Label>
              <Input
                id="year"
                type="number"
                min="2020"
                max="2100"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-32"
              />
            </div>
            <div className="glass rounded-3xl p-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Saídas</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="w-[200px]">Comparativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearData.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell className="font-medium">
                        {formatMonth(m.month)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600 tabular-nums">
                        {formatCurrency(m.income_total)}
                      </TableCell>
                      <TableCell className="text-right text-rose-600 tabular-nums">
                        {formatCurrency(m.expenses_total)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${m.balance >= 0 ? "text-ocean-deep" : "text-rose-600"}`}
                      >
                        {formatCurrency(m.balance)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="h-1.5 rounded-full bg-emerald-500/80"
                            style={{ width: `${(m.income_total / maxYearValue) * 100}%` }}
                          />
                          <div className="h-1.5 rounded-full bg-rose-500/80"
                            style={{ width: `${(m.expenses_total / maxYearValue) * 100}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 tabular-nums">
                      {formatCurrency(yearData.reduce((s, m) => s + m.income_total, 0))}
                    </TableCell>
                    <TableCell className="text-right font-bold text-rose-600 tabular-nums">
                      {formatCurrency(yearData.reduce((s, m) => s + m.expenses_total, 0))}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatCurrency(yearData.reduce((s, m) => s + m.balance, 0))}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* GERENCIAR LANÇAMENTOS — admin */}
          {isAdmin && (
            <TabsContent value="manage" className="space-y-6">
              <div className="flex items-center gap-3">
                <Label htmlFor="month-manage">Mês</Label>
                <Input
                  id="month-manage"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-44"
                />
              </div>

              {/* Saídas */}
              <div className="glass rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-ocean-deep">
                    Despesas do mês
                  </h2>
                  <Button
                    onClick={() => {
                      setEditingExpense(null);
                      setExpenseDialog(true);
                    }}
                  >
                    <Plus className="size-4 mr-1" /> Nova despesa
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Nenhuma despesa neste mês.
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenses.map((e) => {
                        const cat = categories.find((c) => c.id === e.category_id);
                        return (
                          <TableRow key={e.id}>
                            <TableCell>{new Date(e.expense_date).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell className="font-medium">{e.description}</TableCell>
                            <TableCell>
                              {cat ? (
                                <span className="inline-flex items-center gap-1.5 text-sm">
                                  <span className="size-2 rounded-full" style={{ backgroundColor: cat.color ?? "currentColor" }} />
                                  {cat.name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(e.amount)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" onClick={() => { setEditingExpense(e); setExpenseDialog(true); }}>
                                  <Pencil className="size-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={async () => {
                                  if (!confirm("Excluir despesa?")) return;
                                  const { error } = await supabase.from("expenses").delete().eq("id", e.id);
                                  if (error) toast.error(error.message);
                                  else { toast.success("Despesa excluída"); refreshAll(); }
                                }}>
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Entradas extras */}
              <div className="glass rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-ocean-deep">
                    Receitas extras do mês
                  </h2>
                  <Button
                    onClick={() => {
                      setEditingExtra(null);
                      setExtraDialog(true);
                    }}
                  >
                    <Plus className="size-4 mr-1" /> Nova receita
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  As mensalidades dos atletas entram automaticamente. Use isto para receitas adicionais (patrocínios, eventos, etc.).
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extras.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Nenhuma receita extra neste mês.
                        </TableCell>
                      </TableRow>
                    ) : (
                      extras.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{new Date(e.income_date).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="font-medium">{e.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.source ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(e.amount)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" onClick={() => { setEditingExtra(e); setExtraDialog(true); }}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={async () => {
                                if (!confirm("Excluir receita?")) return;
                                const { error } = await supabase.from("extra_incomes").delete().eq("id", e.id);
                                if (error) toast.error(error.message);
                                else { toast.success("Receita excluída"); refreshAll(); }
                              }}>
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}

          {/* CATEGORIAS — admin */}
          {isAdmin && (
            <TabsContent value="categories" className="space-y-4">
              <div className="glass rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-ocean-deep flex items-center gap-2">
                    <Tag className="size-5" /> Categorias de despesa
                  </h2>
                  <Button onClick={() => { setEditingCategory(null); setCategoryDialog(true); }}>
                    <Plus className="size-4 mr-1" /> Nova categoria
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Cor</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <span className="size-5 rounded-full inline-block" style={{ backgroundColor: c.color ?? "currentColor" }} />
                        </TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                            {c.active ? "Ativa" : "Inativa"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => { setEditingCategory(c); setCategoryDialog(true); }}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={async () => {
                              if (!confirm(`Excluir categoria "${c.name}"?`)) return;
                              const { error } = await supabase.from("expense_categories").delete().eq("id", c.id);
                              if (error) toast.error(error.message);
                              else { toast.success("Categoria excluída"); refreshAll(); }
                            }}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Dialog despesa */}
      {isAdmin && (
        <ExpenseDialog
          open={expenseDialog}
          onOpenChange={setExpenseDialog}
          editing={editingExpense}
          categories={categories.filter((c) => c.active)}
          defaultMonth={selectedMonth}
          onSaved={refreshAll}
        />
      )}
      {isAdmin && (
        <ExtraIncomeDialog
          open={extraDialog}
          onOpenChange={setExtraDialog}
          editing={editingExtra}
          defaultMonth={selectedMonth}
          onSaved={refreshAll}
        />
      )}
      {isAdmin && (
        <CategoryDialog
          open={categoryDialog}
          onOpenChange={setCategoryDialog}
          editing={editingCategory}
          onSaved={refreshAll}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  accent: "emerald" | "rose" | "ocean";
}) {
  const colors: Record<string, string> = {
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-700",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-700",
    ocean: "from-primary/20 to-primary/5 text-ocean-deep",
  };
  return (
    <div className={`glass rounded-3xl p-6 bg-gradient-to-br ${colors[accent]}`}>
      <div className="flex items-center gap-2 text-sm font-semibold opacity-80">
        {icon} {label}
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums">
        {formatCurrency(value)}
      </div>
      {sub && <div className="mt-1 text-xs opacity-70">{sub}</div>}
    </div>
  );
}

// ───────── Dialogs ─────────

function ExpenseDialog({
  open, onOpenChange, editing, categories, defaultMonth, onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: Expense | null;
  categories: Category[];
  defaultMonth: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    reference_month: defaultMonth,
    category_id: "" as string,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        description: editing.description,
        amount: String(editing.amount),
        expense_date: editing.expense_date,
        reference_month: editing.reference_month.slice(0, 7),
        category_id: editing.category_id ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      setForm({
        description: "",
        amount: "",
        expense_date: new Date().toISOString().slice(0, 10),
        reference_month: defaultMonth,
        category_id: "",
        notes: "",
      });
    }
  }, [editing, defaultMonth, open]);

  const submit = async () => {
    if (!form.description || !form.amount) {
      toast.error("Descrição e valor são obrigatórios");
      return;
    }
    setSaving(true);
    const payload = {
      description: form.description,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      reference_month: monthToDate(form.reference_month),
      category_id: form.category_id || null,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("expenses").update(payload).eq("id", editing.id)
      : await supabase.from("expenses").insert({
          ...payload,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Despesa atualizada" : "Despesa adicionada");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          <DialogDescription>Registre uma saída financeira.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data da despesa</Label>
              <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </div>
            <div>
              <Label>Mês de referência</Label>
              <Input type="month" value={form.reference_month} onChange={(e) => setForm({ ...form, reference_month: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExtraIncomeDialog({
  open, onOpenChange, editing, defaultMonth, onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: ExtraIncome | null;
  defaultMonth: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    income_date: new Date().toISOString().slice(0, 10),
    reference_month: defaultMonth,
    source: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        description: editing.description,
        amount: String(editing.amount),
        income_date: editing.income_date,
        reference_month: editing.reference_month.slice(0, 7),
        source: editing.source ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      setForm({
        description: "",
        amount: "",
        income_date: new Date().toISOString().slice(0, 10),
        reference_month: defaultMonth,
        source: "",
        notes: "",
      });
    }
  }, [editing, defaultMonth, open]);

  const submit = async () => {
    if (!form.description || !form.amount) {
      toast.error("Descrição e valor são obrigatórios");
      return;
    }
    setSaving(true);
    const payload = {
      description: form.description,
      amount: Number(form.amount),
      income_date: form.income_date,
      reference_month: monthToDate(form.reference_month),
      source: form.source || null,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("extra_incomes").update(payload).eq("id", editing.id)
      : await supabase.from("extra_incomes").insert({
          ...payload,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Receita atualizada" : "Receita adicionada");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar receita" : "Nova receita extra"}</DialogTitle>
          <DialogDescription>Receitas além das mensalidades.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Origem</Label>
              <Input value={form.source} placeholder="Patrocínio, evento..." onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.income_date} onChange={(e) => setForm({ ...form, income_date: e.target.value })} />
            </div>
            <div>
              <Label>Mês de referência</Label>
              <Input type="month" value={form.reference_month} onChange={(e) => setForm({ ...form, reference_month: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: Category | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", color: "#3b82f6", active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setForm({ name: editing.name, color: editing.color ?? "#3b82f6", active: editing.active });
    else setForm({ name: "", color: "#3b82f6", active: true });
  }, [editing, open]);

  const submit = async () => {
    if (!form.name) {
      toast.error("Nome obrigatório");
      return;
    }
    setSaving(true);
    const { error } = editing
      ? await supabase.from("expense_categories").update(form).eq("id", editing.id)
      : await supabase.from("expense_categories").insert(form);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Categoria atualizada" : "Categoria criada");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Cor</Label>
            <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-20" />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <Label htmlFor="active">Ativa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
