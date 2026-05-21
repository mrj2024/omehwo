import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";

type Props = {
  token: string | null;
  room: string | null;
  isDark: boolean;
};

export function LiveKitVideoPanel({ token, room, isDark }: Props) {
  if (!token || !room) return null;

  return (
    <section
      className={
        isDark
          ? "overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-xl"
          : "overflow-hidden rounded-[2rem] border border-white bg-white shadow-xl"
      }
    >
      <LiveKitRoom
        token={token}
        serverUrl={import.meta.env.VITE_LIVEKIT_URL}
        connect
        video
        audio
        data-lk-theme="default"
        className="min-h-[480px]"
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </section>
  );
}