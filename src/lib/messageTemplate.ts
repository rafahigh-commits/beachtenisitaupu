import { format } from "date-fns";
import { formatCurrency } from "./membership";

export interface TemplateAthleteContext {
  full_name: string;
  plan_price: number | null;
  due_date: Date | null;
}

/** Substitui variáveis {{nome}}, {{vencimento}}, {{valor}} no corpo. */
export function renderTemplate(body: string, ctx: TemplateAthleteContext): string {
  const firstName = (ctx.full_name || "").trim().split(/\s+/)[0] || "";
  const vencimento = ctx.due_date ? format(ctx.due_date, "dd/MM/yyyy") : "—";
  const valor = ctx.plan_price != null ? formatCurrency(ctx.plan_price) : "—";

  return body
    .replace(/\{\{\s*nome\s*\}\}/gi, firstName)
    .replace(/\{\{\s*vencimento\s*\}\}/gi, vencimento)
    .replace(/\{\{\s*valor\s*\}\}/gi, valor);
}

/** Normaliza telefone BR para formato wa.me (apenas dígitos, com 55). */
export function toWhatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = "55" + digits;
  }
  if (digits.length < 12 || digits.length > 13) return null;
  return digits;
}

export const TEMPLATE_VARIABLES = [
  { token: "{{nome}}", label: "Nome" },
  { token: "{{vencimento}}", label: "Vencimento" },
  { token: "{{valor}}", label: "Valor" },
] as const;
