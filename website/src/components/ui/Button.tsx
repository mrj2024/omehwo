import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "orange";
};

export function Button({
  children,
  variant = "secondary",
  className = "",
  ...props
}: Props) {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    orange: "bg-orange-500 text-white hover:bg-orange-600",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "bg-transparent hover:bg-black/5",
    secondary: "border border-slate-300 bg-white hover:bg-slate-50",
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold transition disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}