import { Waves } from "lucide-react";
import { Link } from "react-router-dom";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { box: "size-8", icon: "size-4", text: "text-base" },
    md: { box: "size-10", icon: "size-5", text: "text-xl" },
    lg: { box: "size-14", icon: "size-7", text: "text-2xl" },
  } as const;
  const s = sizes[size];

  return (
    <Link to="/" className="flex items-center gap-3 group">
      <div
        className={`${s.box} bg-gradient-aqua rounded-xl rotate-12 grid place-items-center shadow-glow group-hover:rotate-[24deg] transition-transform duration-500`}
      >
        <Waves className={`${s.icon} text-primary-foreground -rotate-12`} strokeWidth={2.5} />
      </div>
      <span
        className={`font-heading font-extrabold tracking-tight ${s.text} text-ocean-deep`}
      >
        BEACH<span className="text-refract">.CLUB</span>
      </span>
    </Link>
  );
}
