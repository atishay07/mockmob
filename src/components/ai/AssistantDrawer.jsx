"use client";

import { AnimatePresence, motion } from 'motion/react';
import MockMobAIHub from './MockMobAIHub';

export default function AssistantDrawer({ open, onClose, initialTab = 'ai' }) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[95]">
          <motion.button
            type="button"
            className="absolute inset-0 hidden bg-zinc-950/58 md:block"
            onClick={onClose}
            aria-label="Close PrepOS"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.section
            className="absolute inset-0 flex flex-col bg-[#090a08] md:inset-y-3 md:right-3 md:left-auto md:w-[min(520px,calc(100vw-28px))] md:overflow-hidden md:rounded-[26px] md:border md:border-white/10 md:shadow-[0_0_90px_rgba(0,0,0,0.62)]"
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
          >
            <MockMobAIHub variant="drawer" initialTab={initialTab} onClose={onClose} />
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
