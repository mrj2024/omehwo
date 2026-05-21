import { motion } from "framer-motion";
import { Moon, Sparkles, Sun, Video, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "../ui/Button";
import type { SiteSettings } from "../../types/app";

type Props = {
  email: string;
  password: string;
  authMode: "login" | "register";
  isDark: boolean;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setAuthMode: (value: "login" | "register") => void;
  handleAuth: () => void;
  setSettings: React.Dispatch<React.SetStateAction<SiteSettings>>;
};

export function AuthScreen({
  email,
  password,
  authMode,
  isDark,
  setEmail,
  setPassword,
  setAuthMode,
  handleAuth,
  setSettings,
}: Props) {
  return (
    <main
      className={
        isDark
          ? "min-h-screen bg-[#0b0f19] text-white"
          : "min-h-screen bg-[#f5f7fb] text-slate-950"
      }
    >
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1fr_420px]">
        <section className="hidden lg:block">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-4 py-2 text-sm font-black text-blue-700 shadow-sm"
          >
            <Sparkles size={16} />
            Classic stranger chat, rebuilt properly
          </motion.div>

          <h1 className="mt-6 max-w-3xl text-7xl font-black tracking-tight">
            Talk to strangers with a better first impression.
          </h1>

          <p className={isDark ? "mt-6 max-w-2xl text-lg text-zinc-400" : "mt-6 max-w-2xl text-lg text-slate-600"}>
            Interest matching, LiveKit video, safety reports, moderator tools,
            and a cleaner Omegle-inspired experience.
          </p>

          <div className="mt-8 grid max-w-3xl grid-cols-3 gap-4">
            {[
              ["Text", MessageCircle],
              ["Video", Video],
              ["Safety", ShieldCheck],
            ].map(([label, Icon]) => (
              <div
                key={String(label)}
                className={
                  isDark
                    ? "rounded-3xl border border-zinc-800 bg-zinc-900 p-5"
                    : "rounded-3xl border border-white bg-white p-5 shadow-sm"
                }
              >
                <Icon className="mb-4 text-blue-600" size={28} />
                <p className="font-black">{String(label)}</p>
              </div>
            ))}
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={
            isDark
              ? "rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
              : "rounded-[2rem] border border-white bg-white p-6 shadow-2xl"
          }
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-blue-600 text-white shadow-xl">
              <Sparkles />
            </div>

            <h2 className="text-4xl font-black">
              Ome<span className="text-orange-500">Clone</span>
            </h2>

            <p className={isDark ? "mt-2 text-sm text-zinc-400" : "mt-2 text-sm text-slate-500"}>
              Sign in to start matching.
            </p>
          </div>

          <div className={isDark ? "mb-5 grid grid-cols-2 rounded-2xl bg-zinc-900 p-1" : "mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1"}>
            <button
              onClick={() => setAuthMode("login")}
              className={`rounded-xl py-3 font-black ${
                authMode === "login" ? "bg-blue-600 text-white" : ""
              }`}
            >
              Login
            </button>

            <button
              onClick={() => setAuthMode("register")}
              className={`rounded-xl py-3 font-black ${
                authMode === "register" ? "bg-orange-500 text-white" : ""
              }`}
            >
              Register
            </button>
          </div>

          <div className="space-y-3">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className={
                isDark
                  ? "w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none"
                  : "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
              }
            />

            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={
                isDark
                  ? "w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none"
                  : "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
              }
            />

            <Button onClick={handleAuth} variant="primary" className="w-full">
              {authMode === "login" ? "Login" : "Create Account"}
            </Button>
          </div>

          <button
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                theme: prev.theme === "light" ? "dark" : "light",
              }))
            }
            className={
              isDark
                ? "mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 py-3 font-bold"
                : "mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3 font-bold"
            }
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            {isDark ? "Use Light Theme" : "Use Dark Theme"}
          </button>
        </motion.section>
      </div>
    </main>
  );
}