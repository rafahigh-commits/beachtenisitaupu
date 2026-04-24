import { differenceInDays, parseISO, format, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PaymentRow {
  reference_month: string;
  paid_at: string;
}

export type Status = "active" | "warning" | "overdue" | "new";

export interface StatusInfo {
  status: Status;
  label: string;
  daysSincePayment: number | null;
  daysUntilDue: number | null;
  lastPayment: PaymentRow | null;
  nextDueDate: Date;
}

/**
 * Active = pagou o mês corrente ou anterior e está dentro da tolerância.
 * Overdue = ultrapassou tolerância sem pagar o mês de referência atual.
 */
export function computeStatus(
  payments: PaymentRow[],
  graceDays: number,
  joinedAt?: string,
): StatusInfo {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const nextDueDate = addMonths(currentMonthStart, 1);

  const sorted = [...payments].sort((a, b) =>
    b.reference_month.localeCompare(a.reference_month),
  );
  const last = sorted[0] ?? null;

  if (!last) {
    // Nunca pagou — se acabou de entrar, é "novo"
    if (joinedAt && differenceInDays(now, parseISO(joinedAt)) <= graceDays) {
      return {
        status: "new",
        label: "Novo membro",
        daysSincePayment: null,
        daysUntilDue: differenceInDays(nextDueDate, now),
        lastPayment: null,
        nextDueDate,
      };
    }
    return {
      status: "overdue",
      label: "Em atraso",
      daysSincePayment: null,
      daysUntilDue: differenceInDays(nextDueDate, now),
      lastPayment: null,
      nextDueDate,
    };
  }

  const lastRefMonth = startOfMonth(parseISO(last.reference_month));
  const monthsBehind =
    (currentMonthStart.getFullYear() - lastRefMonth.getFullYear()) * 12 +
    (currentMonthStart.getMonth() - lastRefMonth.getMonth());

  const daysSince = differenceInDays(now, parseISO(last.paid_at));

  if (monthsBehind <= 0) {
    return {
      status: "active",
      label: "Em dia",
      daysSincePayment: daysSince,
      daysUntilDue: differenceInDays(nextDueDate, now),
      lastPayment: last,
      nextDueDate,
    };
  }

  // pagou mês anterior, mas o atual ainda está na tolerância
  const daysIntoMonth = differenceInDays(now, currentMonthStart);
  if (monthsBehind === 1 && daysIntoMonth <= graceDays) {
    return {
      status: "warning",
      label: "Vence em breve",
      daysSincePayment: daysSince,
      daysUntilDue: graceDays - daysIntoMonth,
      lastPayment: last,
      nextDueDate,
    };
  }

  return {
    status: "overdue",
    label: "Em atraso",
    daysSincePayment: daysSince,
    daysUntilDue: -daysIntoMonth,
    lastPayment: last,
    nextDueDate,
  };
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
