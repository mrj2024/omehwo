import type { SiteSettings } from "../../types/app";
import { Moon, SlidersHorizontal, Sun, X } from "lucide-react";

type Props = {
  settings: SiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<SiteSettings>>;
  isDark: boolean;
  onClose: () => void;
};

export function SettingsModal({ settings, setSettings, isDark, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <section
        className={
          isDark
            ? "w-full max-w-lg rounded-[2rem] border border-zinc-700 bg-zinc-900 p-6 text-white shadow-2xl"
            : "w-full max-w-lg rounded-[2rem] border border-white bg-white p-6 text-slate-950 shadow-2xl"
        }
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <SlidersHorizontal />
              Site Settings
            </h2>
            <p className="text-sm opacity-60">Saved locally on this device.</p>
          </div>

          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                theme: prev.theme === "light" ? "dark" : "light",
              }))
            }
            className="flex w-full items-center justify-between rounded-2xl border p-4 font-bold"
          >
            Theme
            <span className="flex items-center gap-2">
              {settings.theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
              {settings.theme}
            </span>
          </button>

          {[
            ["Compact chat", "compactMode"],
            ["Prompt deck", "showPrompts"],
            ["Safety notice", "showSafetyNotice"],
          ].map(([label, key]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between rounded-2xl border p-4 font-bold"
            >
              {label}
              <input
                type="checkbox"
                checked={Boolean(settings[key as keyof SiteSettings])}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    [key]: e.target.checked,
                  }))
                }
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}