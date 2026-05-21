import type { Report } from "../../types/app";
import {
  Ban,
  CheckCircle,
  Eye,
  Megaphone,
  ShieldCheck,
  Trash2,
} from "lucide-react";

type Props = {
  reports: Report[];
  expandedReportId: string | null;
  isDark: boolean;
  setExpandedReportId: (id: string | null) => void;
  clearReports: () => void;
  markReviewed: (id: string) => void;
  moderateUser: (
    targetUserId: string,
    action: "warn" | "ban",
    reason: string
  ) => void;
};

export function ModeratorPanel({
  reports,
  expandedReportId,
  isDark,
  setExpandedReportId,
  clearReports,
  markReviewed,
  moderateUser,
}: Props) {
  return (
    <section
      className={
        isDark
          ? "rounded-[2rem] border border-indigo-900 bg-zinc-950 p-4 shadow-xl"
          : "rounded-[2rem] border border-indigo-200 bg-white p-4 shadow-xl"
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-black text-indigo-600">
          <ShieldCheck />
          Moderator Dashboard
        </h2>

        <button
          onClick={clearReports}
          className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold"
        >
          <Trash2 size={16} />
          Clear
        </button>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm opacity-60">No reports yet.</p>
      ) : (
        <div className="grid gap-3">
          {reports.map((report) => {
            const expanded = expandedReportId === report.id;

            return (
              <div
                key={report.id}
                className={
                  isDark
                    ? "rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
                    : "rounded-3xl border border-slate-200 bg-slate-50 p-4"
                }
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-black text-red-600">
                      Reported: {report.reported.username}
                    </p>
                    <p>Reporter: {report.reporter.username}</p>
                    <p className="mt-1">
                      <span className="font-black">Reason:</span> {report.reason}
                    </p>
                    <p className="mt-1 text-xs opacity-60">
                      Status: {report.status}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setExpandedReportId(expanded ? null : report.id)}
                      className="rounded-xl border px-3 py-2 font-bold"
                    >
                      <Eye size={15} className="mr-1 inline" />
                      Snippet
                    </button>

                    <button
                      onClick={() => markReviewed(report.id)}
                      className="rounded-xl bg-green-600 px-3 py-2 font-bold text-white"
                    >
                      <CheckCircle size={15} className="mr-1 inline" />
                      Reviewed
                    </button>

                    <button
                      onClick={() =>
                        moderateUser(report.reported.id, "warn", report.reason)
                      }
                      className="rounded-xl bg-yellow-500 px-3 py-2 font-bold text-white"
                    >
                      <Megaphone size={15} className="mr-1 inline" />
                      Warn
                    </button>

                    <button
                      onClick={() =>
                        moderateUser(report.reported.id, "ban", report.reason)
                      }
                      className="rounded-xl bg-red-600 px-3 py-2 font-bold text-white"
                    >
                      <Ban size={15} className="mr-1 inline" />
                      Ban
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div
                    className={
                      isDark
                        ? "mt-3 rounded-2xl border border-zinc-700 bg-zinc-950 p-3"
                        : "mt-3 rounded-2xl border border-slate-200 bg-white p-3"
                    }
                  >
                    <p className="mb-2 font-black">Chat Snippet</p>

                    {report.snippet.length === 0 ? (
                      <p className="opacity-60">No messages captured.</p>
                    ) : (
                      report.snippet.map((msg, index) => (
                        <p key={index}>
                          <span className="font-black">{msg.from.username}: </span>
                          {msg.text}
                        </p>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}