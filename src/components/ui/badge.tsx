import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default" | "secondary" | "destructive" | "outline"
  | "ittwa" | "success" | "warning"
  | "concussion" | "hey-arnold" | "replacements" | "dark-knight"
  | "qb" | "rb" | "wr" | "te" | "k";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "border border-border text-foreground",
    ittwa: "bg-ittwa text-white",
    success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    // Division badges
    concussion: "bg-blue-500/20 text-blue-400 border border-blue-500/40",
    "hey-arnold": "bg-violet-500/20 text-violet-400 border border-violet-500/40",
    replacements: "bg-green-500/20 text-green-400 border border-green-500/40",
    "dark-knight": "bg-orange-500/20 text-orange-400 border border-orange-500/40",
    // Position badges
    qb: "bg-red-500/20 text-red-400 border border-red-500/40",
    rb: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
    wr: "bg-blue-500/20 text-blue-400 border border-blue-500/40",
    te: "bg-orange-500/20 text-orange-400 border border-orange-500/40",
    k: "bg-purple-500/20 text-purple-400 border border-purple-500/40",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
