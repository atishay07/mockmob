"""Exact text replacements that keep a file's line endings. Usage: python rep.py <file> <edits.json>
edits.json = [[old, new], ...] with \n line endings; each old must occur exactly once."""
import io, json, sys

path, edits = sys.argv[1], json.load(io.open(sys.argv[2], encoding='utf-8'))
raw = io.open(path, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')
for old, new in edits:
    n = s.count(old)
    if n != 1:
        sys.exit('expected once, found %d: %r' % (n, old[:70]))
    s = s.replace(old, new)
io.open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
print('ok', path, len(edits), 'edits', 'CRLF' if crlf else 'LF')
