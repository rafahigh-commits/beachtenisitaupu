import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, MessageSquare, Plus, Pencil, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  renderTemplate, toWhatsappNumber, TEMPLATE_VARIABLES,
} from "@/lib/messageTemplate";
import type { StatusInfo, Status } from "@/lib/membership";
import { PushSender } from "./PushSender";

interface Athlete {
  id: string;
  full_name: string;
  phone: string | null;
  user_id?: string | null;
  plans: { price: number } | null;
  status: StatusInfo;
}

interface Template {
  id: string;
  name: string;
  body: string;
}

const STATUS_FILTERS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Em dia" },
  { value: "warning", label: "Vence em breve" },
  { value: "charge", label: "Atrasado" },
  { value: "inactive", label: "Inativos" },
  { value: "exempt", label: "Isentos" },
  { value: "sick", label: "Doentes" },
  { value: "left", label: "Saíram" },
  { value: "new", label: "Novos membros" },
];

export function MessagesTab({ athletes }: { athletes: Athlete[] }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(true);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<Template | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);

  // Sender state
  const [selectedTplId, setSelectedTplId] = useState<string>("free");
  const [messageBody, setMessageBody] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("charge");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  async function loadTemplates() {
    setLoadingTpl(true);
    const { data, error } = await supabase
      .from("message_templates")
      .select("id, name, body")
      .order("name");
    if (error) toast.error(error.message);
    setTemplates((data ?? []) as Template[]);
    setLoadingTpl(false);
  }

  useEffect(() => { loadTemplates(); }, []);

  const filtered = useMemo(() => {
    return athletes.filter((a) =>
      statusFilter === "all" ? true : a.status.status === statusFilter,
    );
  }, [athletes, statusFilter]);

  // Sempre que o filtro mudar, marca todos os com telefone por padrão
  useEffect(() => {
    const next = new Set<string>();
    for (const a of filtered) if (toWhatsappNumber(a.phone)) next.add(a.id);
    setSelectedIds(next);
  }, [filtered]);

  function openNewTemplate() {
    setEditingTpl(null);
    setTplName("");
    setTplBody("");
    setEditorOpen(true);
  }

  function openEditTemplate(t: Template) {
    setEditingTpl(t);
    setTplName(t.name);
    setTplBody(t.body);
    setEditorOpen(true);
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    setSavingTpl(true);
    const { data: userData } = await supabase.auth.getUser();
    if (editingTpl) {
      const { error } = await supabase
        .from("message_templates")
        .update({ name: tplName, body: tplBody })
        .eq("id", editingTpl.id);
      if (error) { setSavingTpl(false); return toast.error(error.message); }
      toast.success("Template atualizado!");
    } else {
      const { error } = await supabase
        .from("message_templates")
        .insert({ name: tplName, body: tplBody, created_by: userData.user?.id });
      if (error) { setSavingTpl(false); return toast.error(error.message); }
      toast.success("Template criado!");
    }
    setSavingTpl(false);
    setEditorOpen(false);
    loadTemplates();
  }

  async function deleteTemplate(t: Template) {
    if (!confirm(`Excluir template "${t.name}"?`)) return;
    const { error } = await supabase.from("message_templates").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Template excluído.");
    loadTemplates();
    if (selectedTplId === t.id) {
      setSelectedTplId("free");
      setMessageBody("");
    }
  }

  function pickTemplate(id: string) {
    setSelectedTplId(id);
    if (id === "free") {
      setMessageBody("");
      return;
    }
    const t = templates.find((x) => x.id === id);
    if (t) setMessageBody(t.body);
  }

  function insertVariable(token: string) {
    setMessageBody((prev) => (prev ? prev + " " + token : token));
  }

  function toggleAthlete(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!checked) { setSelectedIds(new Set()); return; }
    const next = new Set<string>();
    for (const a of filtered) if (toWhatsappNumber(a.phone)) next.add(a.id);
    setSelectedIds(next);
  }

  function buildContext(a: Athlete) {
    return {
      full_name: a.full_name,
      plan_price: a.plans?.price ?? null,
      due_date: a.status.lastDueDate,
    };
  }

  const previewAthlete = useMemo(
    () => filtered.find((a) => selectedIds.has(a.id)) ?? filtered[0] ?? null,
    [filtered, selectedIds],
  );
  const preview = previewAthlete && messageBody
    ? renderTemplate(messageBody, buildContext(previewAthlete))
    : "";

  async function handleSend() {
    if (!messageBody.trim()) return toast.error("Escreva uma mensagem.");
    const targets = filtered.filter((a) => selectedIds.has(a.id));
    if (targets.length === 0) return toast.error("Selecione ao menos um atleta.");

    let opened = 0;
    let skipped = 0;
    toast.info(`Abrindo ${targets.length} conversa(s) — permita pop-ups.`);

    for (let i = 0; i < targets.length; i++) {
      const a = targets[i];
      const num = toWhatsappNumber(a.phone);
      if (!num) { skipped++; continue; }
      const text = renderTemplate(messageBody, buildContext(a));
      const url = `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      opened++;
      // pequena pausa para evitar bloqueio de pop-ups
      if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 350));
    }
    if (skipped > 0) toast.warning(`${skipped} sem WhatsApp válido foram ignorados.`);
    if (opened > 0) toast.success(`${opened} conversa(s) abertas.`);
  }

  const allChecked = filtered.length > 0 &&
    filtered.every((a) => !toWhatsappNumber(a.phone) || selectedIds.has(a.id));

  return (
    <div className="space-y-6">
      <PushSender athletes={athletes.map((a) => ({ id: a.id, full_name: a.full_name, user_id: a.user_id ?? null }))} />

      {/* Templates */}
      <div className="glass rounded-[32px] p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            <h3 className="font-heading text-xl font-extrabold text-ocean-deep">Templates</h3>
          </div>
          <Button size="sm" onClick={openNewTemplate}>
            <Plus className="size-4" /> Novo template
          </Button>
        </div>

        {loadingTpl ? (
          <div className="grid place-items-center py-8"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum template ainda. Crie um para reutilizar mensagens.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((t) => (
              <div key={t.id} className="bg-white/70 rounded-2xl p-4 border border-border/50 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-heading font-extrabold text-ocean-deep">{t.name}</h4>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditTemplate(t)}
                      className="size-7 rounded-lg bg-white/60 hover:bg-primary hover:text-primary-foreground grid place-items-center transition-colors"
                      aria-label="Editar"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(t)}
                      className="size-7 rounded-lg bg-white/60 hover:bg-destructive hover:text-destructive-foreground grid place-items-center transition-colors"
                      aria-label="Excluir"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{t.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sender */}
      <div className="glass rounded-[32px] p-4 md:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Send className="size-5 text-primary" />
          <h3 className="font-heading text-xl font-extrabold text-ocean-deep">Enviar mensagem</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Template</Label>
            <Select value={selectedTplId} onValueChange={pickTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Mensagem livre</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Filtrar atletas por status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Mensagem</Label>
          <Textarea
            rows={5}
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Olá {{nome}}, seu plano vence em {{vencimento}}…"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs text-muted-foreground">Inserir:</span>
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => insertVariable(v.token)}
                className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                {v.token}
              </button>
            ))}
          </div>
        </div>

        {preview && (
          <div className="bg-muted/50 rounded-2xl p-4 border border-border/40">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Pré-visualização ({previewAthlete?.full_name})
            </p>
            <p className="text-sm whitespace-pre-wrap">{preview}</p>
          </div>
        )}

        {/* Athlete list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Destinatários ({filtered.length})</Label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(v) => toggleAll(Boolean(v))}
              />
              Selecionar todos
            </label>
          </div>
          <div className="bg-white/70 rounded-2xl border border-border/50 max-h-80 overflow-y-auto divide-y divide-border/40">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhum atleta nesse filtro.</p>
            ) : filtered.map((a) => {
              const validPhone = toWhatsappNumber(a.phone);
              return (
                <label
                  key={a.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${validPhone ? "cursor-pointer hover:bg-muted/30" : "opacity-50"}`}
                >
                  <Checkbox
                    checked={selectedIds.has(a.id)}
                    onCheckedChange={(v) => toggleAthlete(a.id, Boolean(v))}
                    disabled={!validPhone}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ocean-deep truncate">{a.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.status.label} · {a.phone || "sem telefone"}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={selectedIds.size === 0 || !messageBody.trim()}>
            <Send className="size-4" /> Abrir {selectedIds.size} conversa(s) no WhatsApp
          </Button>
        </div>
      </div>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <form onSubmit={saveTemplate}>
            <DialogHeader>
              <DialogTitle>{editingTpl ? "Editar template" : "Novo template"}</DialogTitle>
              <DialogDescription>
                Use {"{{nome}}"}, {"{{vencimento}}"} e {"{{valor}}"} para personalizar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Nome do template</Label>
                <Input required value={tplName} onChange={(e) => setTplName(e.target.value)} />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea
                  required
                  rows={6}
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
                  placeholder="Olá {{nome}}, seu plano vence em {{vencimento}}. Valor: {{valor}}."
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => setTplBody((b) => (b ? b + " " + v.token : v.token))}
                      className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingTpl}>
                {savingTpl ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
