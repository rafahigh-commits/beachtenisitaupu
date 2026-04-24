import { Link } from "react-router-dom";
import logoItaipu from "@/assets/logo-itaipu.png";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { box: "size-9", text: "text-sm" },
    md: { box: "size-12", text: "text-lg" },
    lg: { box: "size-16", text: "text-xl" },
  } as const;
  const s = sizes[size];

  return (
    <Link to="/" className="flex items-center gap-3 group">
      <div className={`${s.box} rounded-2xl bg-white shadow-glow grid place-items-center p-1.5 group-hover:scale-105 transition-transform duration-300`}>
        <img src={logoItaipu} alt="Itaipu Beach Tennis" className="size-full object-contain" />
      </div>
      <span className={`font-heading font-extrabold tracking-tight ${s.text} text-ocean-deep leading-tight hidden sm:block`}>
        ITAIPU<span className="text-refract"> Beach Tennis</span>
      </span>
    </Link>
  );
}
