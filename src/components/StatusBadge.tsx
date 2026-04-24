import { cn } from "@/lib/utils";
import type { Status } from "@/lib/membership";

const variants: Record<Status, { bg: string; text: string; dot: string }> = {
  active: {
    bg: "bg-success/10",
    text: "text-success",
    dot: "bg-success",
  },
  warning: {
    bg: "bg-warning/15",
    text: "text-warning",
    dot: "bg-warning",
  },
  overdue: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    dot: "bg-destructive",
  },
  new: {
    bg: "bg-primary/10",
    text: "text-primary",
    dot: "bg-primary",
  },
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
        size === "sm"
          ? "text-[10px] px-2.5 py-1"
          : "text-xs px-4 py-1.5",
      )}
    >
      <span className={cn("size-1.5 rounded-full animate-pulse", v.dot)} />
      {label}
    </span>
  );
}
