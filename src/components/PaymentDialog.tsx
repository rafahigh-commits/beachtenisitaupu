import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/membership";
import { format } from "date-fns";
import { toast } from "sonner";

export interface PaymentDialogPlan {
  id: string;
  name: string;
  price: number;
  duration_months: number;
}

export interface PaymentDialogTarget {
  id: string;
  full_name: string;
  plan_id: string | null;
  plans?: { price: number; duration_months: number } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: PaymentDialogTarget | null;
  plans: PaymentDialogPlan[];
  /** "payment" = direct admin insert; "submission" = athlete pending submission */
  mode: "payment" | "submission";
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export function PaymentDialog({
  open, onOpenChange, target, plans, mode, onSuccess, title, description,
}: Props) {
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("custom");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !target) return;
    const planId = target.plan_id && plans.some((p) => p.id === target.plan_id) ? target.plan_id : "custom";
    setSelectedPlanId(planId);
    if (planId !== "custom") {
      const p = plans.find((pl) => pl.id === planId);
      setAmount(p ? String(p.price) : "");
    } else {
      setAmount(String(target.plans?.price ?? ""));
    }
    setMonth("");
    setPaidAt(format(new Date(), "yyyy-MM-dd"));
    setDueDate("");
    setReceiptFile(null);
  }, [open, target, plans]);

  function handleMonthChange(value: string) {
    const monthIso = value ? value + "-01" : "";
    setMonth(monthIso);
    if (!monthIso) { setDueDate(""); return; }
    let months = 1;
    if (selectedPlanId !== "custom") {
      months = plans.find((p) => p.id === selectedPlanId)?.duration_months ?? 1;
    } else {
      months = target?.plans?.duration_months ?? 1;
    }
    const [y, m] = value.split("-").map(Number);
    const due = new Date(y, m - 1 + months, 1);
    due.setDate(due.getDate() - 1);
    setDueDate(format(due, "yyyy-MM-dd"));
  }

  function handlePlanSelect(planId: string) {
    setSelectedPlanId(planId);
    if (planId !== "custom") {
      const p = plans.find((pl) => pl.id === planId);
      if (p) setAmount(String(p.price));
      if (month) {
        const [y, m] = month.split("-").map(Number);
        const months = p?.duration_months ?? 1;
        const due = new Date(y, m - 1 + months, 1);
        due.setDate(due.getDate() - 1);
        setDueDate(format(due, "yyyy-MM-dd"));
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSaving(true);

    let receiptPath: string | null = null;
    if (receiptFile) {
      const maxBytes = 5 * 1024 * 1024;
      if (receiptFile.size > maxBytes) {
        setSaving(false);
        toast.error("Comprovante deve ter no máximo 5 MB.");
        return;
      }
      const isImage = receiptFile.type.startsWith("image/");
      if (!isImage && receiptFile.type !== "application/pdf") {
        setSaving(false);
        toast.error("Comprovante deve ser imagem ou PDF.");
        return;
      }
      const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${target.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("payment-receipts")
        .upload(path, receiptFile, { upsert: false, contentType: receiptFile.type });
      if (upErr) {
        setSaving(false);
        toast.error("Falha ao enviar comprovante: " + upErr.message);
        return;
      }
      receiptPath = path;
    }

    const { data: userData } = await supabase.auth.getUser();

    if (mode === "payment") {
      const { error } = await supabase.from("payments").insert({
        athlete_id: target.id,
        amount: Number(amount),
        reference_month: month,
        paid_at: paidAt,
        due_date: dueDate || null,
        method: "PIX",
        receipt_url: receiptPath,
        created_by: userData.user?.id,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Pagamento registrado!");
    } else {
      const { error } = await supabase.from("payment_submissions").insert({
        athlete_id: target.id,
        amount: Number(amount),
        reference_month: month,
        paid_at: paidAt,
        due_date: dueDate || null,
        method: "PIX",
        receipt_url: receiptPath,
        submitted_by: userData.user?.id,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Pagamento enviado para aprovação!");
    }
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title ?? (mode === "submission" ? "Enviar pagamento para aprovação" : "Registrar pagamento")}</DialogTitle>
            <DialogDescription>{description ?? target?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Plano / Valor</Label>
              <Select value={selectedPlanId} onValueChange={handlePlanSelect}>
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
              {selectedPlanId === "custom" && (
                <Input
                  className="mt-2"
                  type="number"
                  step="0.01"
                  required
                  placeholder="Valor (R$)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mês de referência</Label>
                <Input
                  type="month"
                  required
                  value={month ? month.slice(0, 7) : ""}
                  onChange={(e) => handleMonthChange(e.target.value)}
                />
              </div>
              <div>
                <Label>Pago em</Label>
                <Input type="date" required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Validade até</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Calculada a partir do mês de referência. Ajuste se necessário.</p>
            </div>
            <div>
              <Label htmlFor="receipt">Comprovante {mode === "submission" ? "(recomendado)" : "(opcional)"}</Label>
              <Input
                id="receipt"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground mt-1">Imagem ou PDF, até 5 MB.</p>
            </div>
            {mode === "submission" && (
              <p className="text-xs text-muted-foreground bg-warning/10 rounded-lg p-3">
                Seu pagamento ficará <strong>em aprovação</strong> até o administrador validar.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : (mode === "submission" ? "Enviar" : "Registrar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
