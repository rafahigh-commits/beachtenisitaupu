import { cn } from "@/lib/utils";
import type { Status } from "@/lib/membership";

const variants: Record<Status, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-success/10", text: "text-success", dot: "bg-success" },
  warning: { bg: "bg-warning/15", text: "text-warning", dot: "bg-warning" },
  charge: { bg: "bg-orange-500/15", text: "text-orange-600", dot: "bg-orange-500" },
  inactive: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  exempt: { bg: "bg-accent/30", text: "text-ocean-deep", dot: "bg-accent-foreground" },
  left: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
  sick: { bg: "bg-blue-500/10", text: "text-blue-600", dot: "bg-blue-500" },
  new: { bg: "bg-primary/10", text: "text-primary", dot: "bg-primary" },
};

export function StatusBadge({
  status,
  label,
  size = "md",
}: {
  status: Status;
  label: string;
  size?: "sm" | "md";
}) {
  const v = variants[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-bold uppercase tracking-widest",
        v.bg,
        v.text,
        size === "sm" ? "text-[10px] px-2.5 py-1" : "text-xs px-4 py-1.5",
      )}
    >
      <span className={cn("size-1.5 rounded-full animate-pulse", v.dot)} />
      {label}
    </span>
  );
}
