import { ShieldAlert, EyeOff, LockKeyhole } from "lucide-react";

type Props = {
  isDark: boolean;
};

export function SafetyPanel({ isDark }: Props) {
  return (
    <section
      className={`rounded-[2rem] border p-4 ${
        isDark
          ? "border-yellow-800 bg-yellow-950/30 text-yellow-100"
          : "border-yellow-200 bg-yellow-50 text-yellow-900"
      }`}
    >
      <h3 className="mb-3 flex items-center gap-2 font-black">
        <ShieldAlert size={18} />
        Safety Tools
      </h3>

      <div className="grid gap-2 text-sm">
        <p className="flex items-center gap-2">
          <EyeOff size={15} />
          Do not share private information.
        </p>

        <p className="flex items-center gap-2">
          <LockKeyhole size={15} />
          Reports include recent chat snippets.
        </p>

        <p className="flex items-center gap-2">
          <ShieldAlert size={15} />
          Moderators can warn or ban abusive users.
        </p>
      </div>
    </section>
  );
}