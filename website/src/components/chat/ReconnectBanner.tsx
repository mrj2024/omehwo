import { RefreshCcw, X } from "lucide-react";
import type { MatchHistoryItem } from "../../hooks/useMatchHistory";

type Props = {
  lastMatch?: MatchHistoryItem;
  isDark: boolean;
  onDismiss: () => void;
  onReconnect: () => void;
};

export function ReconnectBanner({
  lastMatch,
  isDark,
  onDismiss,
  onReconnect,
}: Props) {
  if (!lastMatch) return null;

  return (
    <div
      className={`rounded-[2rem] border p-4 shadow-xl ${
        isDark ? "border-blue-900 bg-blue-950/40" : "border-blue-200 bg-blue-50"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black">Want another similar match?</p>
          <p className="text-sm opacity-70">
            Last chat: {lastMatch.username} • {lastMatch.mode}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onReconnect}
            className="rounded-2xl bg-blue-600 px-4 py-2 font-bold text-white"
          >
            <RefreshCcw size={16} className="mr-1 inline" />
            Similar
          </button>

          <button onClick={onDismiss} className="rounded-2xl border px-3 py-2">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}