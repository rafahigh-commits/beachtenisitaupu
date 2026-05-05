import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Check, X, FileText, Inbox } from "lucide-react";
import { formatCurrency } from "@/lib/membership";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Submission {
  id: string;
  athlete_id: string;
  amount: number;
  reference_month: string;
  paid_at: string;
  due_date: string | null;
  method: string | null;
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
  athletes: { full_name: string } | null;
}

export function PendingTab({ onApproved }: { onApproved: () => void }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Submission[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Submission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptIsPdf, setReceiptIsPdf] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_submissions")
      .select("id, athlete_id, amount, reference_month, paid_at, due_date, method, notes, receipt_url, created_at, athletes(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as unknown as Submission[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(s: Submission) {
    setBusyId(s.id);
    const { error } = await supabase.rpc("approve_payment_submission", { _submission_id: s.id });
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Pagamento aprovado!");
    load();
    onApproved();
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    const { error } = await supabase.rpc("reject_payment_submission", {
      _submission_id: rejectTarget.id,
      _reason: rejectReason || null,
    });
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Submissão rejeitada.");
    setRejectTarget(null);
    setRejectReason("");
    load();
  }

  async function viewReceipt(path: string) {
    const { data, error } = await supabase.storage
      .from("payment-receipts")
      .createSignedUrl(path, 60);
    if (error || !data) { toast.error("Não foi possível abrir o comprovante."); return; }
    window.open(data.signedUrl, "_blank");
  }

  if (loading) {
    return <div className="grid place-items-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="glass rounded-[32px] p-4 md:p-6">
      <div className="flex items-center gap-2 mb-5">
        <Inbox className="size-5 text-primary" />
        <h3 className="font-heading text-xl font-extrabold text-ocean-deep">Pagamentos pendentes</h3>
        <span className="text-xs font-bold uppercase tracking-widest bg-warning/15 text-warning rounded-full px-2.5 py-1">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhuma pendência. 🎉</p>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.id} className="bg-white/60 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ocean-deep">
                  {s.athletes?.full_name ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(Number(s.amount))} · ref.{" "}
                  {format(new Date(s.reference_month + "T00:00:00"), "MMM/yy", { locale: ptBR })} ·
                  pago em {format(new Date(s.paid_at + "T00:00:00"), "dd/MM/yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Enviado em {format(new Date(s.created_at), "dd/MM HH:mm")}
                  {s.due_date && <> · validade até {format(new Date(s.due_date + "T00:00:00"), "dd/MM/yyyy")}</>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {s.receipt_url && (
                  <Button size="sm" variant="outline" onClick={() => viewReceipt(s.receipt_url!)}>
                    <FileText className="size-4 mr-1" /> Comprovante
                  </Button>
                )}
                <Button size="sm" onClick={() => approve(s)} disabled={busyId === s.id}>
                  {busyId === s.id ? <Loader2 className="size-4 animate-spin" /> : <><Check className="size-4 mr-1" /> Aprovar</>}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setRejectTarget(s); setRejectReason(""); }} disabled={busyId === s.id}>
                  <X className="size-4 mr-1" /> Rejeitar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar pagamento</DialogTitle>
            <DialogDescription>{rejectTarget?.athletes?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Motivo (opcional)</Label>
            <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ex.: comprovante ilegível" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={busyId === rejectTarget?.id}>
              {busyId === rejectTarget?.id ? <Loader2 className="size-4 animate-spin" /> : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
