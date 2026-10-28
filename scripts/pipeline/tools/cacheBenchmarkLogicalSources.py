"""Cache original PDF text order for source construction; never author evidence."""
import hashlib
import json
import pathlib
import re
import pypdf

root = pathlib.Path('artifacts/question-factory/cuet-readiness-2026-10-08/execution/cbse-independent-key-candidates')
draft = json.loads((root / 'source-support-v1/source-support-draft-v1.json').read_text(encoding='utf-8'))
output = root / 'source-support-v3'
output.mkdir(exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()
sources = {}
for span in draft['evidence_spans']:
    source_id = span.get('source_id', '')
    if not source_id.startswith('ncert-') or source_id in sources:
        continue
    code = source_id.removeprefix('ncert-')
    candidates = [pathlib.Path(span['page_map_file']).parent / (code + '.pdf')] if span.get('page_map_file') else []
    candidates += [pathlib.Path('data/question-factory-runtime/reference-downloads') / (code + '.pdf'),
                   pathlib.Path('data/question-factory-runtime/business-economics-auth-work/official-ncert') / (code + '.pdf')]
    path = next((p for p in candidates if p.exists() and sha(p.read_bytes()) == span.get('source_pdf_sha256')), None)
    if path is None:
        raise ValueError('source_pdf_identity_missing:' + source_id)
    sources[source_id] = path

manifest = []
for source_id, path in sources.items():
    target = output / (source_id + '.logical-pages-v5.json')
    if target.exists():
        saved = json.loads(target.read_text(encoding='utf-8'))
        if saved['pdf_sha256'] != sha(path.read_bytes()):
            raise ValueError('cached_pdf_identity_changed:' + source_id)
    else:
        pages = []
        for number, page in enumerate(pypdf.PdfReader(path).pages, start=1):
            # Retain the publisher's original text stream order. Geometric
            # y-then-x ordering previously mixed adjacent teaching columns.
            text = re.sub(r'\s+', ' ', page.extract_text() or '').strip()
            pages.append({'page': number, 'text': text, 'text_sha256': sha(text.encode('utf-8'))})
        saved = {'source_id': source_id, 'pdf_path': str(path), 'pdf_sha256': sha(path.read_bytes()),
                 'extraction_method': 'pypdf original content-stream order; whitespace normalization only',
                 'semantic_review_required': True, 'pages': pages,
                 'notice': 'A cached document or matching term is not answer support. Each decisive excerpt and option claim requires review.'}
        target.write_text(json.dumps(saved, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    manifest.append({'source_id': source_id, 'cache_path': str(target), 'pdf_sha256': saved['pdf_sha256'],
                     'cache_sha256': sha(target.read_bytes()), 'pages': len(saved['pages'])})
(output / 'logical-source-cache-manifest-v5.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'documents': len(manifest), 'pages': sum(row['pages'] for row in manifest), 'paid_calls': 0}))
