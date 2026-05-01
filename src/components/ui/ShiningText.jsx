"use client";

import { motion } from "motion/react";

export function ShiningText({ text, className = "" }) {
  return (
    <motion.span
      className={`inline-flex bg-[linear-gradient(110deg,#74786f,35%,#f6f7ee,50%,#74786f,75%,#74786f)] bg-[length:200%_100%] bg-clip-text font-medium text-transparent ${className}`}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{
        repeat: Infinity,
        duration: 2,
        ease: "linear",
      }}
    >
      {text}
    </motion.span>
  );
}
