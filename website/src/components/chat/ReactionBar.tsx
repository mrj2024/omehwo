type Props = {
  disabled?: boolean;
  onReact: (emoji: string) => void;
};

const reactions = ["👋", "😂", "🔥", "💀", "❤️", "👍"];

export function ReactionBar({ disabled = false, onReact }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {reactions.map((emoji) => (
        <button
          key={emoji}
          disabled={disabled}
          onClick={() => onReact(emoji)}
          className="rounded-full border bg-white px-3 py-2 text-lg shadow-sm transition hover:scale-105 disabled:opacity-40"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}