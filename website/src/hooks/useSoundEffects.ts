import useSound from "use-sound";

export function useSoundEffects(enabled: boolean) {
  const [playPop] = useSound("/sounds/pop.mp3", { volume: 0.35 });
  const [playSend] = useSound("/sounds/send.mp3", { volume: 0.25 });
  const [playAlert] = useSound("/sounds/alert.mp3", { volume: 0.4 });

  return {
    playPop: () => enabled && playPop(),
    playSend: () => enabled && playSend(),
    playAlert: () => enabled && playAlert(),
  };
}