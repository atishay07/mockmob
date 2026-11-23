'use client';

// The launch film's key and its full-screen player (launchFilm.mjs; owner LK427, 23 Nov 2026). The key is in the page hidden
// and shows only with /?film=1, or for everyone once the owner's switch is on (LAUNCH_FILM_ON). The film's file is not
// fetched until the key is pressed (the <video> has no source before that), so the page pays nothing for it.
// The player is a native <dialog>: Esc and the Close key leave it, the page behind cannot be worked while it is open, and the
// film stops when it closes. Other films on the page (the hero's) pause while it plays.
import { useEffect, useRef } from 'react';
import { Play, X } from 'lucide-react';
import { LAUNCH_FILM, LAUNCH_FILM_COPY as C, LAUNCH_FILM_ON, launchFilmShown, launchFilmSource } from './launchFilm.mjs';
import './launch-film.css';

export default function LaunchFilmKey() {
  const keyRef = useRef(null);
  const dialogRef = useRef(null);
  const videoRef = useRef(null);

  // The preview query is read once the page is awake; the key's `hidden` is this element's own attribute, not state.
  useEffect(() => {
    const key = keyRef.current;
    if (key && launchFilmShown({ search: window.location.search })) key.hidden = false;
  }, []);

  const open = () => {
    const dialog = dialogRef.current;
    const video = videoRef.current;
    if (!dialog || !video) return;
    if (!video.getAttribute('src')) {
      const lite = document.documentElement.hasAttribute('data-lite');
      const saveData = Boolean(navigator.connection?.saveData);
      video.setAttribute('src', launchFilmSource({ lite, saveData }));
    }
    document.querySelectorAll('video').forEach((other) => { if (other !== video && !other.paused) other.pause(); });
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    video.play().catch(() => { /* the reader presses play on the player's own controls */ });
  };
  const close = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
  };
  const onClosed = () => { videoRef.current?.pause(); keyRef.current?.focus({ preventScroll: true }); };

  return (
    <>
      <button type="button" ref={keyRef} className="lf-key" hidden={!LAUNCH_FILM_ON} onClick={open} data-cursor="Watch">
        <span className="lf-key__mark" aria-hidden="true"><Play size={14} strokeWidth={0} fill="currentColor" /></span>
        {C.key}
      </button>
      {/* A press on the dark surround closes the player, as the Close key and Esc do. */}
      <dialog ref={dialogRef} className="lf-dialog" aria-label={C.title} onClose={onClosed} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div className="lf-dialog__box">
          <video ref={videoRef} className="lf-dialog__video" controls playsInline preload="none" poster={LAUNCH_FILM.poster} width={LAUNCH_FILM.width} height={LAUNCH_FILM.height} />
          <button type="button" className="lf-dialog__close" onClick={close} aria-label={C.close}><X size={22} strokeWidth={2.4} aria-hidden="true" /></button>
        </div>
      </dialog>
    </>
  );
}
