// src/components/ui/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "subtle";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  className = "",
  type,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 disabled:cursor-not-allowed disabled:opacity-60";

  const sizeClass =
    size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  const variantClass =
    variant === "primary"
      ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
      : variant === "outline"
        ? "border border-slate-300 bg-white/80 text-slate-800 hover:border-blue-400 hover:text-blue-700"
        : variant === "ghost"
          ? "text-slate-700 hover:bg-slate-100/80"
          : "bg-slate-100 text-slate-800 hover:bg-slate-200";

  const composedClassName = `${base} ${sizeClass} ${variantClass} ${className}`.trim();

  return (
    <button
      type={type ?? "button"}
      className={composedClassName}
      {...props}
    >
      {leftIcon && <span className="mr-1.5 flex items-center">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="ml-1.5 flex items-center">{rightIcon}</span>}
    </button>
  );
}
