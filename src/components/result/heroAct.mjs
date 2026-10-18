// The act Mobi plays on the result hero. PURE.
//
// The server's recap table (and the app's) says `rest` for an ordinary result: the held resting stance, which is a low body
// with the visor narrowed to slits. Beside a score that reads as the sleeping Mobi the owner rejected (F11: never sleepy). The
// web hero shows him awake instead: `idle`, standing at ease with his eyes open, in the same calm mood. Every other act
// (proud, cheer, encourage) is the table's own and is passed through.
export const heroAct = (act) => (act === 'rest' ? 'idle' : act);
