import io, re

# ---- copy
p = 'src/components/daily/dailyStripCopy.mjs'
raw = io.open(p, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')
a = s.index("/** The home block's two openers")
b = s.index("/** The home card's shorter sentence (17 Nov 2026)")
s = s[:a] + """/** The home card's two rows (owner, 26 Nov 2026; the council's verdict): what each is, in one line. A guest's five is the
 *  shared one, so the line says when the five become your own; the Sunday paper's size is in its figures beside it. */
export const CAL_COPY = Object.freeze({
  daily: 'Five questions every day, free. Signed in, they come from your own mistakes.',
  sunday: 'One full paper every Sunday, the same for everyone. Sign up to sit it.',
});
""" + s[b:]
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)

# ---- page.js: the block moves to right after the five questions; the pictures are no longer passed in
p = 'src/app/page.js'
s = io.open(p, encoding='utf-8', newline='').read()
a = s.index("        {/* ------------------- THE WEEK'S TWO FIXED DATES: Daily Five and Sunday Mock ------------------- */}")
b = s.index("</section></Later>", a) + len("</section></Later>") + 1
block = s[a:b]
s = s[:a] + s[b:].lstrip('\n')
block = block.replace("""            {/* How it works, as three small pictures (owner LK427, 23 Nov 2026): in the paragraph's place. */}
            {/* 24 Nov 2026 (owner: the Daily Five took too much room and the Sunday Mock was lost under it): the pictures open
                inside the Daily Five card ("How the Daily Five works"); the two cards stand as a pair. */}
            <DailyFiveRow where="home" how={COLLEGE_DAILY ? null : <DailyHow />} />""",
"""            {/* 26 Nov 2026 (owner: "I really don't like its implementation right now"; the council's verdict): one calendar
                card, two dated rows, no openers, and it stands right after the five questions, where "come back tomorrow"
                follows "I just tried it". How each works lives on /daily and /sunday-mock. */}
            <DailyFiveRow where="home" />""")
assert 'DailyFiveRow where="home" />' in block
anchor = "        {/* ----------------------- YOUR WHOLE CUET PREP, IN ONE PLACE (the one frame) ----------------------- */}"
i = s.index(anchor)
s = s[:i] + block + "\n" + s[i:]
# the subjects claim under the five questions (phones; the Statement that carried it is for wide screens)
old = """                <DemoDrill note={DESK_NOTE} />
                {/* The note is one even line with no link (LK83/LK84): sign-up is the hero's volt key, and the card's own
                    end state offers it after the fifth answer. */}
              </div>
            </div>
"""
assert old in s
s = s.replace(old, old + """            <p className="lp-try__claim">{SUBJECT_CLAIM.long}.</p>
""")
s = s.replace("import { DesktopNote } from '@/components/landing/DesktopNote';\n", "")
s = s.replace("import DailyHow from '@/components/daily/DailyHow';\n", "")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok', 'DailyHow' in s, 'DesktopNote' in s)
