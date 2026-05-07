import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface Athlete {
  id: string;
  full_name: string;
  user_id: string | null;
}

interface Props {
  athletes: Athlete[];
}

export function PushSender({ athletes }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendAll, setSendAll] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const linked = useMemo(
    () => athletes.filter((a) => a.user_id).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [athletes],
  );

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      return toast.error("Título e mensagem são obrigatórios.");
    }
    const user_ids = sendAll ? undefined : Array.from(selected);
    if (!sendAll && (!user_ids || user_ids.length === 0)) {
      return toast.error("Selecione ao menos um destinatário.");
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-push-notification", {
      body: { title, body, user_ids },
    });
    setSending(false);
    if (error) return toast.error(error.message);
    const d = data as { sent: number; failed: number; recipients: number; tokens: number };
    toast.success(`Enviadas: ${d.sent} · Falhas: ${d.failed} · Destinatários: ${d.recipients}`);
    setTitle("");
    setBody("");
  }

  return (
    <div className="glass rounded-[32px] p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bell className="size-5 text-primary" />
        <h3 className="font-heading text-xl font-extrabold text-ocean-deep">Push Notifications</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Envie notificações para os dispositivos dos atletas que ativaram as notificações no navegador.
      </p>

      <div>
        <Label>Título</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Aula cancelada hoje" />
      </div>
      <div>
        <Label>Mensagem</Label>
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Mensagem a exibir..." />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <Checkbox checked={sendAll} onCheckedChange={(v) => setSendAll(Boolean(v))} />
        Enviar para todos os atletas
      </label>

      {!sendAll && (
        <div className="bg-white/70 rounded-2xl border border-border/50 max-h-72 overflow-y-auto divide-y divide-border/40">
          {linked.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum atleta com conta vinculada.
            </p>
          ) : linked.map((a) => (
            <label key={a.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30">
              <Checkbox
                checked={selected.has(a.user_id!)}
                onCheckedChange={() => toggle(a.user_id!)}
              />
              <span className="text-sm font-semibold text-ocean-deep flex-1 truncate">{a.full_name}</span>
            </label>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSend} disabled={sending}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Enviar push
        </Button>
      </div>
    </div>
  );
}
