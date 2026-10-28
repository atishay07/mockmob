"""Read and cache NCERT Directing in column order; never overwrite old sources."""
import hashlib, json, pathlib, re
import pdfplumber

root = pathlib.Path('data/question-factory-runtime/reference-downloads')
pdf_path = root / 'lebs107.pdf'
pages = []
with pdfplumber.open(pdf_path) as pdf:
    for number, page in enumerate(pdf.pages[1:], start=2):
        columns = []
        for side in (0, 1):
            # Whole characters belong to the actual gutter at x=250; a midpoint
            # crop cuts the first letters of the right column into the left one.
            filtered = page.filter(lambda o: o.get('object_type') != 'char' or
                (125 < o.get('top', 0) < 674 and
                 ((o.get('x0', 0) < 250) if side == 0 else (o.get('x0', 0) >= 250))))
            columns.append(re.sub(r'\s+', ' ', filtered.extract_text() or '').strip())
        pages.append({'pdf_page_1based': number, 'columns': columns})
text = '\n'.join(' '.join(p['columns']) for p in pages)
output = root / 'lebs107.column-normalized.txt'
output.write_text(text, encoding='utf-8')
(root / 'lebs107.column-pages.json').write_text(json.dumps(pages, ensure_ascii=False), encoding='utf-8')
metadata = {'source_url': 'https://ncert.nic.in/textbook/pdf/lebs107.pdf',
            'identity_sha256': hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
            'extraction_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'extraction_contract': 'Whole characters assigned by the observed column gutter; first case/objectives page excluded. Exact retained spans still require independent answer support.',
            'visually_checked_pdf_pages_1based': [2], 'all_pages_visually_checked': False}
(root / 'lebs107.column-metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
print(json.dumps({'characters': len(text), 'pages_cached': len(pages), 'head': text[:160]}))
