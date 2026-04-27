import { differenceInDays, parseISO, format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PaymentRow {
  reference_month: string;
  paid_at: string;
  due_date?: string | null;
  amount: number;
}

export type ManualStatus = "isento" | "saiu" | "doente";

export type Status =
  | "active"      // em dia
  | "warning"     // próximo do vencimento (entre vencimento e charge_days)
  | "charge"      // em cobrança (passou charge_days mas ainda não inativo)
  | "inactive"    // ultrapassou inactive_days
  | "exempt"      // isento (manual)
  | "left"        // saiu (manual)
  | "sick"        // doente (manual)
  | "new";        // novo, sem pagamentos ainda

export interface StatusInfo {
  status: Status;
  label: string;
  daysSinceDue: number | null;
  lastDueDate: Date | null;
  lastPayment: PaymentRow | null;
}

interface PlanInfo {
  duration_months: number;
}

/** Calcula até quando vai a validade de um pagamento. */
function paymentDueDate(p: PaymentRow, plan?: PlanInfo): Date {
  if (p.due_date) return parseISO(p.due_date);
  const ref = parseISO(p.reference_month);
  const months = plan?.duration_months ?? 1;
  // último dia do período (subtrai 1 dia)
  const end = addMonths(ref, months);
  end.setDate(end.getDate() - 1);
  return end;
}

export function computeStatus(
  payments: PaymentRow[],
  chargeDays: number,
  inactiveDays: number,
  manualStatus: ManualStatus | null,
  plan?: PlanInfo,
  joinedAt?: string,
): StatusInfo {
  // Status manual sobrescreve tudo
  if (manualStatus === "isento") {
    return { status: "exempt", label: "Isento", daysSinceDue: null, lastDueDate: null, lastPayment: null };
  }
  if (manualStatus === "saiu") {
    return { status: "left", label: "Saiu", daysSinceDue: null, lastDueDate: null, lastPayment: null };
  }
  if (manualStatus === "doente") {
    return { status: "sick", label: "Doente", daysSinceDue: null, lastDueDate: null, lastPayment: null };
  }

  const now = new Date();
  const sorted = [...payments].sort((a, b) =>
    paymentDueDate(b, plan).getTime() - paymentDueDate(a, plan).getTime(),
  );
  const last = sorted[0] ?? null;

  if (!last) {
    if (joinedAt && differenceInDays(now, parseISO(joinedAt)) <= chargeDays) {
      return { status: "new", label: "Novo membro", daysSinceDue: null, lastDueDate: null, lastPayment: null };
    }
    return { status: "inactive", label: "Inativo", daysSinceDue: null, lastDueDate: null, lastPayment: null };
  }

  const due = paymentDueDate(last, plan);
  const daysSinceDue = differenceInDays(now, due);

  if (daysSinceDue <= 0) {
    return { status: "active", label: "Em dia", daysSinceDue, lastDueDate: due, lastPayment: last };
  }
  if (daysSinceDue <= chargeDays) {
    return { status: "warning", label: "Vence em breve", daysSinceDue, lastDueDate: due, lastPayment: last };
  }
  if (daysSinceDue <= inactiveDays) {
    return { status: "charge", label: "Atrasado", daysSinceDue, lastDueDate: due, lastPayment: last };
  }
  return { status: "inactive", label: "Inativo", daysSinceDue, lastDueDate: due, lastPayment: last };
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatMonth(iso: string) {
  return format(parseISO(iso), "MMMM 'de' yyyy", { locale: ptBR });
}

export function formatDate(iso: string) {
  return format(parseISO(iso), "dd 'de' MMM, yyyy", { locale: ptBR });
}
