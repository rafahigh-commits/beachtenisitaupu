import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Bell } from "lucide-react";
import { formatCurrency } from "@/lib/membership";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingItem {
  id: string;
  amount: number;
  reference_month: string;
  created_at: string;
  athletes: { full_name: string } | null;
}

export function PendingDropdown({
  count,
  onGoToTab,
}: {
  count: number;
  onGoToTab: () => void;
}) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("payment_submissions")
      .select("id, amount, reference_month, created_at, athletes(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(8);
    setItems((data ?? []) as unknown as PendingItem[]);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="relative">
          <Bell className="size-4 mr-1.5" />
          Pendências
          {count > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-warning text-warning-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1">
              {count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Pagamentos aguardando aprovação</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma pendência. 🎉
          </div>
        ) : (
          items.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => { setOpen(false); onGoToTab(); }}
              className="flex flex-col items-start gap-0.5 cursor-pointer"
            >
              <span className="font-semibold text-ocean-deep text-sm truncate max-w-full">
                {s.athletes?.full_name ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(Number(s.amount))} · ref.{" "}
                {format(new Date(s.reference_month + "T00:00:00"), "MMM/yy", { locale: ptBR })}
                {" · "}
                {format(new Date(s.created_at), "dd/MM HH:mm")}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { setOpen(false); onGoToTab(); }} className="justify-center font-semibold text-primary cursor-pointer">
          Ver todas pendências →
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
