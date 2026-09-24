"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "gold" | "green" | "blue" | "red" | "ghost" | "dark";

const VARIANTS: Record<Variant, { bg: string; shadow: string; color: string }> = {
  gold: { bg: "linear-gradient(180deg,#ffe07a,#ffc21f 55%,#f0a400)", shadow: "#9a6400", color: "#2a1a00" },
  green: { bg: "linear-gradient(180deg,#5fe095,#22a95f 55%,#168a4b)", shadow: "#0b5a30", color: "#ffffff" },
  blue: { bg: "linear-gradient(180deg,#89b0ff,#3d7af0 55%,#2a5fd0)", shadow: "#173e94", color: "#ffffff" },
  red: { bg: "linear-gradient(180deg,#ff8e85,#e0413b 55%,#c32f2a)", shadow: "#7d1714", color: "#ffffff" },
  ghost: { bg: "rgba(255,255,255,.08)", shadow: "rgba(0,0,0,.35)", color: "#fbf1dc" },
  dark: { bg: "linear-gradient(180deg,#3a2a1c,#24180e)", shadow: "#0d0804", color: "#fbf1dc" },
};

export function GameButton({
  variant = "gold",
  size = "lg",
  className = "",
  children,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "lg" | "md" | "sm" }) {
  const v = VARIANTS[variant];
  const sizing = size === "lg" ? "h-14 px-6 text-xl" : size === "md" ? "h-12 px-5 text-base" : "h-9 px-3 text-sm";
  return (
    <button
      type="button"
      {...rest}
      className={`btn-game inline-flex items-center justify-center gap-2 ${sizing} ${className}`}
      style={{ background: v.bg, color: v.color, ["--btn-shadow" as string]: v.shadow, ...style }}
    >
      {children}
    </button>
  );
}

/** A link styled as a game button (no nested interactive elements). */
export function GameLink({
  href,
  variant = "gold",
  size = "lg",
  className = "",
  children,
  testId,
}: {
  href: string;
  variant?: Variant;
  size?: "lg" | "md" | "sm";
  className?: string;
  children: ReactNode;
  testId?: string;
}) {
  const v = VARIANTS[variant];
  const sizing = size === "lg" ? "h-14 px-6 text-xl" : size === "md" ? "h-12 px-5 text-base" : "h-9 px-3 text-sm";
  return (
    <Link
      href={href}
      data-testid={testId}
      className={`btn-game inline-flex items-center justify-center gap-2 ${sizing} ${className}`}
      style={{ background: v.bg, color: v.color, ["--btn-shadow" as string]: v.shadow }}
    >
      {children}
    </Link>
  );
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            role="dialog"
            className="safe-bottom relative max-h-[88dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-[#10231a] px-4 pt-3 shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20" />
            {title && <div className="mb-3 text-center text-lg font-extrabold tracking-wide">{title}</div>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toggle({ checked, onChange, label, testId }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 text-start"
    >
      <span className="font-semibold">{label}</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-white/15"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "start-6" : "start-1"}`} />
      </span>
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  testId,
  cols,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  testId?: string;
  /** Tailwind grid-cols classes for a fixed grid (e.g. "grid-cols-4"); default wraps freely. */
  cols?: string;
}) {
  return (
    <div className={`${cols ? `grid ${cols}` : "flex flex-wrap"} gap-1.5 rounded-2xl bg-black/25 p-1.5`} data-testid={testId}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`min-w-0 rounded-xl px-2 py-2 text-sm leading-tight font-bold transition ${cols ? "" : "flex-auto"} ${
            o.value === value ? "bg-[#ffcf4a] text-[#2a1a00] shadow" : "text-white/75 hover:bg-white/5"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A labelled group. Not a <label>: wrapping button groups in a label would
 * give every label word to the first button's accessible name.
 */
export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="block space-y-1.5">
      <span id={id} className="block text-xs font-bold tracking-wider text-white/60 uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-white/50">{hint}</span>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-lg font-bold text-white placeholder:text-white/30 focus:border-[#ffcf4a] focus:outline-none ${props.className ?? ""}`}
    />
  );
}

export function Toast({ message, tone = "error" }: { message: string | null; tone?: "error" | "info" | "success" }) {
  const bg = tone === "error" ? "bg-[#7d1714]" : tone === "success" ? "bg-emerald-700" : "bg-[#1d3b2c]";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            role="status"
            data-testid="toast"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className={`${bg} rounded-2xl px-4 py-2.5 text-center text-sm font-extrabold tracking-wide text-white shadow-xl`}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
