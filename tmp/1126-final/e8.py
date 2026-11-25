import io


def rw(p, fn):
    raw = io.open(p, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    s = fn(raw.replace('\r\n', '\n'))
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)


BAD = r"""\.dcal .dwk-key[data-lead='true']">"""
GOOD = r"""\.dcal \.dwk-key\[data-lead='true'\]">"""
for p in ['data/tests/home_next_1120.test.mjs', 'data/tests/landing_checklist_1104.test.mjs']:
    def fix(s):
        assert BAD in s, p
        return s.replace(BAD, GOOD)
    rw(p, fix)


def cov(s):
    old = r"""  assert.match(how.claim.text, /It is not a prediction\.$/);"""
    assert old in s
    return s.replace(old, """  // 26 Nov 2026: said plainly, not as a disclaimer (the landing checklist's L-024 bans defensive fine print).
  assert.equal(how.claim.lead, 'What the figure tells you:');
  assert.doesNotMatch(how.claim.text, /predict/i);""")


rw('src/components/landing/coverage2026.test.mjs', cov)


# CreatorReels: name the figures' list so a phone can leave it out
def reels(s):
    i = s.index("<div><dt>Combined followers</dt>")
    j = s.rfind("<dl", 0, i)
    tag_end = s.index(">", j)
    tag = s[j:tag_end + 1]
    print('dl tag:', tag)
    if 'className="' in tag:
        new = tag.replace('className="', 'className="lp-ig__stats ', 1)
    else:
        new = tag[:-1] + ' className="lp-ig__stats">'
    return s[:j] + new + s[tag_end + 1:]


rw('src/components/landing/CreatorReels.jsx', reels)
print('ok')
