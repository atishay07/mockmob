import io


def rw(p, fn):
    raw = io.open(p, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = fn(raw.replace('\r\n', '\n'))
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)


def once(s, old, new):
    assert s.count(old) == 1, (s.count(old), old[:70])
    return s.replace(old, new)


# ---- coverage-proof.css: the roast room's motion fixes (26 Nov 2026)
def cov(s):
    s = once(s, ".lp-cq__cols { display: grid; gap: 0.75rem; min-width: 0; animation: lp-cq-in 200ms ease-out both; }\n@keyframes lp-cq-in { from { opacity: 0; } }",
             "/* A new question dips, it never blanks (26 Nov 2026, the motion review): from 0 every tap through the strip blinked the\n   place empty; from 0.4 a run of taps reads as one stream. */\n.lp-cq__cols { display: grid; gap: 0.75rem; min-width: 0; animation: lp-cq-in 140ms cubic-bezier(0.23, 1, 0.32, 1) both; }\n@keyframes lp-cq-in { from { opacity: 0.4; } }")
    s = once(s, ".lp-cq[data-fill='in'] .lp-cq__cell { animation: lp-cq-fill 300ms cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: calc(var(--i, 0) * 13ms); }\n@keyframes lp-cq-fill { from { opacity: 0; transform: scale(0.6); } }",
             "/* Ink, not balloons (26 Nov 2026): the squares settle from 0.88, not grow from 0.6. */\n.lp-cq[data-fill='in'] .lp-cq__cell { animation: lp-cq-fill 240ms cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: calc(var(--i, 0) * 13ms); }\n@keyframes lp-cq-fill { from { opacity: 0; transform: scale(0.88); } }")
    s = s.rstrip('\n') + """

/* The sheet on a phone rises from the foot of the screen and goes back down when it closes; its dim comes and goes with it
   (26 Nov 2026, the motion review: it faded up 24 px, the dim cut in and out in one frame, and closing had no motion). A
   transition, so a close during the open turns round where it is. Browsers without @starting-style show and hide it at
   once, as before. Wide screens keep the centred panel's own entrance. */
@media (max-width: 699.98px) {
  .lp-ch[open] .lp-ch__sheet { animation: none; }
  .lp-ch { transition: display 220ms allow-discrete, overlay 220ms allow-discrete; }
  .lp-ch .lp-ch__sheet { transform: translateY(100%); transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1); }
  .lp-ch[open] .lp-ch__sheet { transform: none; transition-duration: 320ms; }
  @starting-style { .lp-ch[open] .lp-ch__sheet { transform: translateY(100%); } }
  .lp-ch::backdrop { opacity: 0; transition: opacity 220ms ease-out, display 220ms allow-discrete, overlay 220ms allow-discrete; }
  .lp-ch[open]::backdrop { opacity: 1; }
  @starting-style { .lp-ch[open]::backdrop { opacity: 0; } }
}
@media (max-width: 699.98px) and (prefers-reduced-motion: reduce) {
  .lp-ch, .lp-ch .lp-ch__sheet, .lp-ch::backdrop { transition: none; }
}
html[data-motion='reduced'] .lp-ch, html[data-motion='reduced'] .lp-ch .lp-ch__sheet, html[data-motion='reduced'] .lp-ch::backdrop { transition: none; }
"""
    return s


rw('src/components/landing/coverage-proof.css', cov)


# ---- daily-row.css: the key's press lands at once and lets go a little slower
def daily(s):
    s = once(s, "  transition: transform 120ms cubic-bezier(0.2, 0.8, 0.3, 1), box-shadow 120ms cubic-bezier(0.2, 0.8, 0.3, 1), background-color 150ms ease-out;\n}",
             "  transition: transform 180ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 180ms cubic-bezier(0.23, 1, 0.32, 1), background-color 150ms ease-out;\n  touch-action: manipulation;\n}\n/* The press lands at once (26 Nov 2026, the motion review): with one 120 ms transition both ways a quick phone tap turned\n   back halfway and the keycap's press was barely seen. */\n.mm.lp .dwk-key:active { transition-duration: 40ms, 40ms, 150ms; }")
    return s


rw('src/components/daily/daily-row.css', daily)


# ---- r19-home-b.css: phone-feel and the roast room's cuts
def home(s):
    s = once(s, "    text-decoration: none; text-wrap: pretty; -webkit-tap-highlight-color: transparent;\n  }",
             "    text-decoration: none; text-wrap: pretty; -webkit-tap-highlight-color: transparent; touch-action: manipulation;\n    transition: opacity 120ms ease-out;\n  }\n  .mm.lp .lp-hero__links > .lp-hero__fact:active { opacity: 0.6; transition-duration: 40ms; }")
    s = once(s, "text-decoration-color: var(--line-strong); text-underline-offset: 4px; cursor: pointer;\n  }",
             "text-decoration-color: var(--line-strong); text-underline-offset: 4px; cursor: pointer;\n    -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: opacity 120ms ease-out;\n  }\n  .mm.lp .cl__all:active { opacity: 0.55; transition-duration: 40ms; }\n  /* The colleges that were waiting come in one after another, a step each (never all in one frame). */\n  .mm.lp .cl__list[data-all='true'] > li:nth-child(even) { transition: opacity 220ms cubic-bezier(0.23, 1, 0.32, 1), translate 220ms cubic-bezier(0.23, 1, 0.32, 1); }\n  .mm.lp .cl__list[data-all='true'] > li:nth-child(4) { transition-delay: 30ms; }\n  .mm.lp .cl__list[data-all='true'] > li:nth-child(6) { transition-delay: 60ms; }\n  .mm.lp .cl__list[data-all='true'] > li:nth-child(8) { transition-delay: 90ms; }\n  .mm.lp .cl__list[data-all='true'] > li:nth-child(10) { transition-delay: 120ms; }\n  @starting-style { .mm.lp .cl__list[data-all='true'] > li:nth-child(even) { opacity: 0; translate: 0 -6px; } }")
    s = once(s, "  .mm.lp .lp-try__claim { display: block; margin: 0.875rem 0 0; color: var(--ink-2); font: 500 0.9375rem/1.45 var(--font-body); text-align: center; text-wrap: balance; }",
             "  .mm.lp .lp-try__claim { display: block; margin: 0.875rem 0 0; color: var(--ink-2); font: 500 0.9375rem/1.45 var(--font-body); text-align: left; text-wrap: pretty; }")
    s = s.rstrip('\n') + """
/* The roast room, 26 Nov 2026 (tmp/council/2026-11-26-roast): on a phone the free-and-price line stands right under the keys,
   above the film (it sat about 700 px down, so the first screen never said "free"); Mobi's caption beside the Daily Five's
   head said the head again; and the creators' three large counts repeated the hero's own line. */
@media (max-width: 719.98px) {
  .mm.lp .lp-hero__grid { grid-template-areas: 'copy' 'links' 'film' 'strip'; }
  .mm.lp .lp-hero__links { margin-top: 2px; }
  .mm.lp .lp-rhythm .pip-seat figcaption { display: none; }
  .mm.lp #on-instagram .lp-ig__stats { display: none; }
}
@media (prefers-reduced-motion: reduce) { .mm.lp .cl__all, .mm.lp .lp-hero__links > .lp-hero__fact, .mm.lp .cl__list[data-all='true'] > li { transition: none; } }
"""
    return s


rw('src/app/r19-home-b.css', home)


# ---- storyController.mjs: a wheel or key step arrives the way it travels
def ctrl(s):
    s = once(s, "  s.stage.style.transform = leanTransform(-dir * 10);",
             "  // The way it travels (26 Nov 2026, the motion review): a forward step starts 10 px low and rises to rest; it used to\n  // start high and sink, so every step ended by moving backwards.\n  s.stage.style.transform = leanTransform(dir * 10);")
    s = s.replace("has no finger to lean with: the content starts 10 px the other way and settles.", "has no finger to lean with: the content starts 10 px short, on the side it comes from, and settles.")
    return s


rw('src/components/landing/storyController.mjs', ctrl)


# ---- copy: the calendar rows say less; the sheet makes no defensive claim (landing checklist L-024)
def copy(s):
    s = once(s, "  daily: 'Five questions every day, free. Signed in, they come from your own mistakes.',\n  sunday: 'One full paper every Sunday, the same for everyone. Sign up to sit it.',",
             "  daily: 'Free. Signed in, the five come from your own mistakes.',\n  sunday: 'One full paper, the same for everyone. Sign up to sit it.',")
    return s


rw('src/components/daily/dailyStripCopy.mjs', copy)


def words(s):
    s = once(s, "    claim: { lead: 'We do not claim to predict CUET 2027 questions.', text: 'This check shows how much of a real CUET paper MockMob teaches. It is not a prediction.' },",
             "    // What the figure is, said plainly and not as a disclaimer (the landing checklist's L-024: no defensive fine print).\n    claim: { lead: 'What the figure tells you:', text: 'how much of a real CUET paper MockMob already teaches, question by question.' },")
    return s


rw('src/components/landing/coverageWords.mjs', words)


def page(s):
    s = once(s, """<HeroDockGate aside=".op-gate, .lp-app, .dwk-story__stage">""", """<HeroDockGate aside=".op-gate, .lp-app, .dcal .dwk-key[data-lead='true']">""")
    return s


rw('src/app/page.js', page)
print('ok')
