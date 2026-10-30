# Page texts of one PDF in pdfium's reading order, printed as a JSON array (one string per page).
# The Key cards quote check (scripts/keycards/lib.mjs) reads it as a second extraction: pdftotext interleaves
# two-column pages and side boxes line by line, so a sentence printed whole can come out split; pdfium keeps it whole.
#
#   python scripts/keycards/pdfium_pages.py <file.pdf>
import json
import sys

import pypdfium2 as pdfium

doc = pdfium.PdfDocument(sys.argv[1])
pages = [doc[i].get_textpage().get_text_range() for i in range(len(doc))]
sys.stdout.write(json.dumps(pages, ensure_ascii=True))
