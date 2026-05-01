"use client";

import MockMobAIHub from './MockMobAIHub';

export default function AssistantDrawer({ open, onClose, initialTab = 'ai' }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95]">
      <button
        type="button"
        className="absolute inset-0 hidden bg-zinc-950/58 md:block"
        onClick={onClose}
        aria-label="Close PrepOS"
      />
      <section className="absolute inset-0 flex flex-col bg-[#090a08] md:inset-y-3 md:right-3 md:left-auto md:w-[min(520px,calc(100vw-28px))] md:overflow-hidden md:rounded-[26px] md:border md:border-white/10 md:shadow-[0_0_90px_rgba(0,0,0,0.62)]">
        <MockMobAIHub variant="drawer" initialTab={initialTab} onClose={onClose} />
      </section>
    </div>
  );
}
