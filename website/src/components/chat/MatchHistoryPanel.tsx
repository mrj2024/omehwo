import { Heart, Trash2, Video, MessageCircle } from "lucide-react";
import type { MatchHistoryItem } from "../../hooks/useMatchHistory";

type Props = {
  history: MatchHistoryItem[];
  isDark: boolean;
  toggleFavorite: (id: string) => void;
  clearHistory: () => void;
};

export function MatchHistoryPanel({
  history,
  isDark,
  toggleFavorite,
  clearHistory,
}: Props) {
  return (
    <section
      className={`rounded-[2rem] border p-4 shadow-xl ${
        isDark ? "border-zinc-800 bg-zinc-950" : "border-white bg-white"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-black">Recent Matches</h2>

        <button
          onClick={clearHistory}
          className="rounded-xl border px-3 py-1 text-sm font-bold"
        >
          <Trash2 size={14} className="mr-1 inline" />
          Clear
        </button>
      </div>

      {history.length === 0 ? (
        <p className="text-sm opacity-60">No match history yet.</p>
      ) : (
        <div className="space-y-2">
          {history.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border p-3 ${
                isDark
                  ? "border-zinc-800 bg-zinc-900"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-black">{item.username}</p>
                  <p className="flex items-center gap-1 text-xs opacity-60">
                    {item.mode === "video" ? (
                      <Video size={13} />
                    ) : (
                      <MessageCircle size={13} />
                    )}
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </p>
                </div>

                <button onClick={() => toggleFavorite(item.id)}>
                  <Heart
                    size={18}
                    className={item.favorited ? "fill-red-500 text-red-500" : ""}
                  />
                </button>
              </div>

              {item.interests.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.interests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700"
                    >
                      #{interest}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}