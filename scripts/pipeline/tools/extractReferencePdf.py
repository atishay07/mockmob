"""Extract a downloaded reference PDF once into reusable page text.

Usage: python scripts/pipeline/tools/extractReferencePdf.py <id> <source_url> <syllabus_version>
Reads data/question-factory-runtime/reference-downloads/<id>.pdf and writes <id>.pages.json,
<id>.normalized.txt and an identity entry in extraction-metadata.json. No network access.
"""
import hashlib, json, re, sys, datetime, pathlib
import pdfplumber

root = pathlib.Path('data/question-factory-runtime/reference-downloads')
doc_id, url, syllabus = sys.argv[1], sys.argv[2], sys.argv[3]
pdf_path = root / f'{doc_id}.pdf'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
pages = []
with pdfplumber.open(pdf_path) as pdf:
    for i, page in enumerate(pdf.pages, start=1):
        text = re.sub(r'\s+', ' ', page.extract_text() or '').strip()
        pages.append({'page': i, 'text': text})
(root / f'{doc_id}.pages.json').write_text(json.dumps(pages, ensure_ascii=False), encoding='utf-8')
normalized = root / f'{doc_id}.normalized.txt'
normalized.write_bytes('\r\n'.join(f'PAGE {p["page"]}\r\n{p["text"]}' for p in pages).encode('utf-8'))
meta_path = root / 'extraction-metadata.json'
meta = json.loads(meta_path.read_text(encoding='utf-8'))
meta = [m for m in meta if m.get('id') != doc_id]
meta.append({'id': doc_id, 'file': str(pdf_path).replace('\\', '/'), 'pages': len(pages), 'identity_sha256': sha(pdf_path),
             'extraction_file': str(normalized).replace('\\', '/'), 'extraction_sha256': sha(normalized), 'source_url': url,
             'syllabus_version': syllabus, 'extractor': f'pdfplumber {pdfplumber.__version__}',
             'retrieved_at': datetime.datetime.now(datetime.timezone.utc).isoformat()})
meta_path.write_text(json.dumps(meta, indent=2), encoding='utf-8')
print(json.dumps({'id': doc_id, 'pages': len(pages), 'first': pages[0]['text'][:160]}, ensure_ascii=False))
