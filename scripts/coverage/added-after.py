"""python scripts/coverage/added-after.py

The record behind "Added after the first check" on the CUET 2026 coverage pages (owner, 23 Nov 2026: the claim has to say
which material was written after we read the papers). Writes data/coverage/cuet2026/added-after.json.

The first check of a paper is its <id>-A.json and <id>-B.json (two separate checks of the bank as it stood on their
snapshotDate; a question counted only when both found it). After it, material was written for what the papers asked and
MockMob did not teach, and a third check wrote <id>-final.json. For every question the final check counts and the first
check did not, this script says where its best match came from:
  added  the match was written after the first check: a Key card that is not in the deck at FIRST_COMMIT (the commit that
         stored the first check's data, before any gap was filled), or a bank question that was not in a saved snapshot of
         the first check (bank-cache.json `from` is a read-only fetch after the publish of 22 Nov 2026);
  found  the match was already there (the Key card is in the deck at FIRST_COMMIT): the third check found what the first
         two had not both found.
It reads git history and the data folder only. No database, no network. Run it again whenever a <id>-final.json changes;
scripts/coverage/build-public.mjs refuses a later-counted question that this file does not list.
"""
import io, json, glob, os, subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BASE = os.path.join(ROOT, 'data', 'coverage', 'cuet2026')
FIRST_COMMIT = '211cdc9f9'


def read(p):
    return json.load(io.open(p, encoding='utf-8'))


def old_deck_ids(deck):
    out = subprocess.run(['git', 'show', '%s:data/keycards/decks/%s.json' % (FIRST_COMMIT, deck)], capture_output=True, cwd=ROOT)
    if out.returncode != 0:
        return set()
    ids = set()

    def walk(x):
        if isinstance(x, dict):
            if isinstance(x.get('id'), str) and x['id'].startswith('kc.'):
                ids.add(x['id'])
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    walk(json.loads(out.stdout.decode('utf-8')))
    return ids


cache = read(os.path.join(BASE, 'bank-cache.json'))
decks = {}
subjects = {}
for f in sorted(glob.glob(os.path.join(BASE, '*-final.json'))):
    sid = os.path.basename(f)[:-len('-final.json')]
    final = read(f)
    A = {q['n']: q for q in read(os.path.join(BASE, sid + '-A.json'))['questions']}
    B = {q['n']: q for q in read(os.path.join(BASE, sid + '-B.json'))['questions']}
    row = {'addedCards': [], 'addedQuestions': [], 'found': []}
    for q in sorted(final['questions'], key=lambda x: x['n']):
        n = q['n']
        if q['verdict'] != 'covered':
            continue
        if A[n].get('verdict') == 'covered' and B[n].get('verdict') == 'covered':
            continue
        best = q['best']
        if best.startswith('kc.'):
            deck = best.split('.')[1]
            if deck not in decks:
                decks[deck] = old_deck_ids(deck)
            (row['found'] if best in decks[deck] else row['addedCards']).append({'n': n, 'id': best})
        else:
            src = str(cache.get(best, {}).get('from', ''))
            if not src.startswith('read-only fetch'):
                raise SystemExit('%s Q%s: bank match %s is from "%s": decide by hand whether it was there at the first check' % (sid, n, best, src))
            row['addedQuestions'].append({'n': n, 'id': best})
    subjects[sid] = row

out = {
    'what': 'For each CUET 2026 question counted now and not at the first check: whether its best match was written after the first check (added) or was already there (found). Written by scripts/coverage/added-after.py.',
    'firstCommit': FIRST_COMMIT,
    'subjects': subjects,
}
io.open(os.path.join(BASE, 'added-after.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(out, indent=1) + '\n')
tot = {k: sum(len(s[k]) for s in subjects.values()) for k in ('addedCards', 'addedQuestions', 'found')}
print('added-after.json:', tot, {sid: [len(s['addedCards']), len(s['addedQuestions']), len(s['found'])] for sid, s in subjects.items()})
