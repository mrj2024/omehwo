import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  dark?: boolean;
};

export function Card({ children, dark = false, className = "", ...props }: Props) {
  return (
    <div
      {...props}
      className={`rounded-3xl border shadow-sm ${
        dark
          ? "border-zinc-800 bg-zinc-900"
          : "border-slate-200 bg-white"
      } ${className}`}
    >
      {children}
    </div>
  );
}