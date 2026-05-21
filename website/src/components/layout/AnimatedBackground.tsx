import { motion } from "framer-motion";

type Props = {
  isDark: boolean;
};

export function AnimatedBackground({ isDark }: Props) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -20, 30, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full blur-3xl ${
          isDark ? "bg-blue-700/20" : "bg-blue-300/40"
        }`}
      />

      <motion.div
        animate={{
          x: [0, -40, 20, 0],
          y: [0, 30, -20, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`absolute bottom-[-140px] right-[-100px] h-96 w-96 rounded-full blur-3xl ${
          isDark ? "bg-orange-600/20" : "bg-orange-300/50"
        }`}
      />
    </div>
  );
}