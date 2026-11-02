/// How a card's words are shown: the book's name and reference, the kind said once, the leading ellipsis of an
/// excerpt, and how a back breaks into lines. A port of the website's `src/components/keycards/kinds.js`
/// (`bookName`, `sourceLine`, `chapterRef`, `cardFace`, `startsMidSentence`, `backLines`, `ownMarker`,
/// `formulaLines`, `entryRows`) and of its `NcertText`, held equal by `test/unit/keycards/display_parity_test.dart`
/// over real cards. The words are NCERT's own; only their layout is the app's. Pure, so tests can run it.
library;

import 'keycards_models.dart';

// ---- The book and the reference ----

/// The book's name as the syllabus prints it, from the NCERT code, where the decks spell one book several ways
/// ("Accountancy : Partnership Accounts", "Accountancy – Partnership Accounts").
const Map<String, String> bookByCode = {
  'leac1': 'Accountancy Part 1',
  'leac2': 'Accountancy Part 2',
  'lebs1': 'Business Studies Part 1',
  'lebs2': 'Business Studies Part 2',
};

/// `bookName(source)`: by the code, else the book as written (a space before a colon dropped), else null.
String? bookName({String? code, String? book}) {
  final c = (code ?? '').toLowerCase();
  final byCode = bookByCode[c.length >= 5 ? c.substring(0, 5) : c];
  if (byCode != null) return byCode;
  final b = book?.replaceAll(RegExp(r'\s+:'), ':').trim();
  return b == null || b.isEmpty ? null : b;
}

/// "Business Studies Part 1, Ch 1, p. 3" from a card's source; null when there is nothing to cite. WordNet
/// meanings say so on each card; the English deck's own cards carry no line.
String? sourceLine(KcSource source) {
  if (source.kind == 'wordnet') return 'Meaning from WordNet';
  if (source.kind == 'authored') return null;
  final parts = [
    bookName(code: source.code, book: source.book),
    if (source.chapterNo != null) 'Ch ${source.chapterNo}',
    if (source.page != null) 'p. ${source.page}',
  ].nonNulls;
  return parts.isEmpty ? null : parts.join(', ');
}

bool _same(String? a, String? b) => (a ?? '').trim().toLowerCase() == (b ?? '').trim().toLowerCase();

/// `chapterRef(ncert, { title, unit })`: "Business Studies Part 1, Ch 1". No reference at all when it is only the
/// chapter's own title again, and just "Ch 7" under a unit heading that is the book's name.
String? chapterRef(String? book, int? chapter, {String? title, String? unit}) {
  if (book == null || book.isEmpty) return null;
  if (chapter == null) return title != null && _same(book, title) ? null : book;
  return unit != null && _same(book, unit) ? 'Ch $chapter' : '$book, Ch $chapter';
}

/// `unitRepeats`: is the unit just the book's name again, or the chapter's own title? Then a header need not
/// print it.
bool unitRepeats(String? unit, {String? title, String? book}) =>
    unit == null || unit.isEmpty || _same(unit, title) || _same(unit, book);

// ---- The face ----

final RegExp _lower = RegExp(r'^\p{Ll}', unicode: true);

/// `startsMidSentence`: an NCERT excerpt whose first letter is lowercase starts mid-sentence. English answers
/// ("affect") are whole answers, never excerpts.
bool startsMidSentence(String text, KeyCard card) => _lower.hasMatch(text.trimLeft()) && card.source.isNcert;

/// `withLead`: the text with a leading ellipsis when it starts mid-sentence.
String withLead(String text, KeyCard card) => startsMidSentence(text, card) ? '…${text.trimLeft()}' : text;

const Map<String, String> _kindPrefix = {'formula': r'^formula\s*:\s*', 'rule': r'^rule\s*:\s*', 'entry': r'^journal entry\s*:\s*'};

/// `cardFace`: the kind label and the front as a card shows them, without saying the kind twice: "Formula" over
/// "Formula: Current ratio" reads "Current ratio"; an entry whose front begins "Journal entry:" is labelled
/// "Journal entry". Display only; the stored front is untouched.
({String label, String front}) cardFace(KeyCard card) {
  final pattern = _kindPrefix[card.kind];
  final re = pattern == null ? null : RegExp(pattern, caseSensitive: false);
  final label = card.kind == 'entry' && re != null && re.hasMatch(card.front) ? 'Journal entry' : card.label;
  if (re == null || !re.hasMatch(card.front)) return (label: label, front: card.front);
  final rest = card.front.replaceFirst(re, '');
  return (label: label, front: _lower.hasMatch(rest) ? '${rest[0].toUpperCase()}${rest.substring(1)}' : rest);
}

// ---- Lines ----

/// The lines of a list, steps or types back (fragments joined by line breaks).
List<String> backLines(String back) => [
  for (final l in back.split(RegExp(r'\n+')))
    if (l.trim().isNotEmpty) l.trim(),
];

final RegExp _ownMarker = RegExp(
  r'^(\((?:\d{1,2}|[ivx]{1,5}|[a-z])\)|(?:\d{1,2}|[ivx]{1,5}|[a-z])[.)]|[•–-])\s+(\S.*)$',
  caseSensitive: false,
);

/// `ownMarker`: a list line's own number or letter ("1. Liquidity Ratios", "(a) Fixed Assets Turnover Ratio"): the
/// marker and the rest, or null. The screen then draws the book's marker and no bullet.
({String marker, String rest})? ownMarker(String line) {
  final m = _ownMarker.firstMatch(line.trim());
  return m == null ? null : (marker: m.group(1)!, rest: m.group(2)!);
}

/// A formula line: the first one split before its "=" (`lhs`, `rhs`), any other as it is (`text`).
typedef KcFormulaLine = ({String? lhs, String? rhs, String? text});

final RegExp _continues = RegExp(r'^[=+×÷/]');

/// `formulaLines`: each continuation that starts with "=" (or another operator) joins the line above, so
/// "Trade Receivable Turnover ratio" then "= Net Credit Revenue ..." is one formula; the first line breaks before
/// its "=" rather than inside a term.
List<KcFormulaLine> formulaLines(String back) {
  final merged = <String>[];
  for (final line in backLines(back)) {
    if (merged.isNotEmpty && _continues.hasMatch(line)) {
      merged[merged.length - 1] += ' $line';
    } else {
      merged.add(line);
    }
  }
  return [
    for (final (i, line) in merged.indexed)
      if (i == 0 && line.indexOf('=') > 0)
        (lhs: line.substring(0, line.indexOf('=')).trim(), rhs: line.substring(line.indexOf('=')).trim(), text: null)
      else
        (lhs: null, rhs: null, text: line),
  ];
}

// ---- Journal entries ----

/// A row of a journal entry as the book sets it out.
enum KcEntryRowKind {
  /// An account debited: the account, then "Dr." at the right (and its amount).
  debit,

  /// "To" an account credited, indented under the debits.
  credit,

  /// The narration in brackets, under the entry.
  narration,

  /// Anything else (a heading, "1. When interest is due"), as it is.
  plain,
}

class KcEntryRow {
  KcEntryRow(this.kind, this.text, {this.amount});

  KcEntryRowKind kind;
  final String text;

  /// The amount line that goes with a debit or credit ("10,00,000"), drawn at the right.
  String? amount;

  @override
  bool operator ==(Object other) => other is KcEntryRow && other.kind == kind && other.text == text && other.amount == amount;

  @override
  int get hashCode => Object.hash(kind, text, amount);

  @override
  String toString() => 'KcEntryRow($kind, "$text"${amount == null ? '' : ', amount: "$amount"'})';
}

final RegExp _amount = RegExp(r'^(?:rs\.?\s*)?[\d,]+(?:\.\d+)?(?:\s*/-)?$', caseSensitive: false);
final RegExp _labelled = RegExp(r'^\((?:[a-z]|[ivx]+|\d+)\)\s', caseSensitive: false);
final RegExp _loneDr = RegExp(r'^Dr\.?(?:\s+(.*))?$');
final RegExp _hasDr = RegExp(r'(^|\s)Dr\.?(\s|$)');
final RegExp _drLine = RegExp(r'^(.*?)\s+Dr\.?(?:\s+(.*))?$');
final RegExp _bracketed = RegExp(r'^\(.*\)\.?$');
final RegExp _to = RegExp(r'^To\s');

/// `entryRows`: a journal entry back as rows. A lone "Dr." line belongs to the account above it; "X Dr. To Y" on
/// one line is split; an amount line goes with the row above it; the narration in brackets is a note. Null when
/// the back is not an entry (no Dr. and no To line), so a "Treatment:" card stays a paragraph.
List<KcEntryRow>? entryRows(String back) {
  final lines = [
    for (final l in back.replaceAllMapped(RegExp(r'(\bDr\.?)[ \t]+(?=To\s)'), (m) => '${m[1]}\n').split(RegExp(r'\n+')))
      if (l.trim().isNotEmpty) l.trim(),
  ];
  if (!lines.any((l) => _hasDr.hasMatch(l) || _to.hasMatch(l))) return null;
  final rows = <KcEntryRow>[];
  for (final line in lines) {
    final last = rows.isEmpty ? null : rows.last;
    final lone = _loneDr.firstMatch(line);
    if (lone != null && last != null && last.kind != KcEntryRowKind.debit && last.kind != KcEntryRowKind.narration) {
      last.kind = KcEntryRowKind.debit;
      final rest = (lone.group(1) ?? '').trim();
      if (rest.isNotEmpty && _amount.hasMatch(rest)) {
        last.amount = rest;
      } else if (rest.isNotEmpty) {
        rows.add(KcEntryRow(KcEntryRowKind.narration, rest));
      }
      continue;
    }
    if (_amount.hasMatch(line) && last != null && last.amount == null && (last.kind == KcEntryRowKind.debit || last.kind == KcEntryRowKind.credit)) {
      last.amount = line;
      continue;
    }
    if (_to.hasMatch(line)) {
      rows.add(KcEntryRow(KcEntryRowKind.credit, line));
      continue;
    }
    if (_bracketed.hasMatch(line) && !_labelled.hasMatch(line)) {
      rows.add(KcEntryRow(KcEntryRowKind.narration, line));
      continue;
    }
    final dr = _drLine.firstMatch(line);
    if (dr != null && dr.group(1)!.isNotEmpty) {
      rows.add(KcEntryRow(KcEntryRowKind.debit, dr.group(1)!));
      final rest = (dr.group(2) ?? '').trim();
      if (rest.isNotEmpty && _amount.hasMatch(rest)) {
        rows.last.amount = rest;
      } else if (rest.isNotEmpty) {
        rows.add(KcEntryRow(KcEntryRowKind.narration, rest));
      }
      continue;
    }
    rows.add(KcEntryRow(KcEntryRowKind.plain, line));
  }
  return rows;
}

/// The app's one step past the website's rows: a narration the book breaks over lines ("(R's share of goodwill
/// adjusted in P's" then "and Q's capital accounts ...)") reads as one narration, not as short plain lines. The
/// words stay the book's.
List<KcEntryRow> joinedNarrations(List<KcEntryRow> rows) {
  final out = <KcEntryRow>[];
  var open = false;
  for (final r in rows) {
    if (open && r.kind == KcEntryRowKind.plain) {
      final last = out.removeLast();
      out.add(KcEntryRow(KcEntryRowKind.narration, '${last.text} ${r.text}'));
      open = !RegExp(r'\)\.?$').hasMatch(r.text);
      continue;
    }
    open = r.kind == KcEntryRowKind.plain && r.text.startsWith('(') && !_labelled.hasMatch(r.text) && !RegExp(r'\)\.?$').hasMatch(r.text);
    out.add(open ? KcEntryRow(KcEntryRowKind.narration, r.text) : r);
  }
  return out;
}

// ---- Blanks with their punctuation (the website's blankRuns) ----

/// One part of a front split on its blanks: a run of [text], or a blank ([blank], numbered [n] from 1) that may carry the
/// punctuation that touches it: [lead] (an opening bracket or quote right before it) and [tail] (a comma, stop, closing
/// bracket or quote right after it).
typedef KcBlankRun = ({String text, bool blank, int n, String lead, String tail});

/// Punctuation that belongs to a blank: a comma, stop or closing bracket or quote right after it, an opening bracket or
/// quote right before it (the web's `GAP_TAIL` and `GAP_LEAD`).
final RegExp _gapTail = RegExp('^[,.;:!?)\\]}’”\'"…%]+');
final RegExp _gapLead = RegExp('[([{‘“\'"]+\$');

/// `blankRuns`: the front split on its blanks (`____`, three or more underscores), with the punctuation that touches a blank
/// moved onto it as `lead` and `tail`, so a screen draws the gap and its punctuation in one unbreakable run: a line never
/// starts with ", and" or ends with "(". No character is lost. A front without blanks is one text part; an empty one is none.
List<KcBlankRun> blankRuns(String? front) {
  final text = front ?? '';
  // Mutable while the punctuation moves: [text, blank, n, lead, tail].
  final parts = <List<Object>>[];
  var at = 0;
  var n = 0;
  for (final m in RegExp(r'_{3,}').allMatches(text)) {
    if (m.start > at) parts.add([text.substring(at, m.start), false, 0, '', '']);
    parts.add(['', true, n += 1, '', '']);
    at = m.end;
  }
  if (at < text.length) parts.add([text.substring(at), false, 0, '', '']);
  if (parts.isEmpty) parts.add([text, false, 0, '', '']);
  for (var i = 0; i < parts.length; i++) {
    final p = parts[i];
    if (p[1] != true) continue;
    final before = i > 0 && parts[i - 1][1] != true ? parts[i - 1] : null;
    final after = i + 1 < parts.length && parts[i + 1][1] != true ? parts[i + 1] : null;
    final lead = before == null ? null : _gapLead.firstMatch(before[0] as String)?.group(0);
    if (lead != null) {
      p[3] = lead;
      final t = before![0] as String;
      before[0] = t.substring(0, t.length - lead.length);
    }
    final tail = after == null ? null : _gapTail.firstMatch(after[0] as String)?.group(0);
    if (tail != null) {
      p[4] = tail;
      after![0] = (after[0] as String).substring(tail.length);
    }
  }
  return [
    for (final p in parts)
      if (p[1] == true || (p[0] as String).isNotEmpty) (text: p[0] as String, blank: p[1] as bool, n: p[2] as int, lead: p[3] as String, tail: p[4] as String),
  ];
}

// ---- The back as the screen draws it (the website's NcertText) ----

/// One paragraph of a back: a list item takes a bullet unless the book already numbers or letters it (then
/// [text] carries the marker) or the list is "bare" (some line carries a marker).
typedef KcParagraph = ({String text, bool bullet});

/// A run of a paragraph: plain text, or a blanked word marked in the full line.
typedef KcPart = ({String text, bool mark});

/// How a card's back is laid out.
sealed class KcBackShape {
  const KcBackShape();
}

class KcListBack extends KcBackShape {
  const KcListBack({required this.bare, required this.items});

  /// Some line carries the book's own marker: lines without one get no bullet (a lead-in line stays bare).
  final bool bare;
  final List<({String? own, String text})> items;

  List<KcParagraph> get paragraphs => [
    for (final i in items) (text: i.own == null ? i.text : '${i.own} ${i.text}', bullet: i.own == null && !bare),
  ];
}

class KcFormulaBack extends KcBackShape {
  const KcFormulaBack(this.lines);

  /// The first line has the leading ellipsis already when it starts mid-sentence.
  final List<KcFormulaLine> lines;

  /// Every line as a paragraph; the first line's "=" part is its own line, close under it.
  List<String> get texts => [
    for (final l in lines) ...(l.lhs != null ? [l.lhs!, l.rhs!] : [l.text!]),
  ];
}

class KcEntryBack extends KcBackShape {
  const KcEntryBack(this.rows);

  final List<KcEntryRow> rows;
}

class KcParasBack extends KcBackShape {
  const KcParasBack(this.paras);

  /// Paragraphs of parts; the first part already carries the ellipsis when the paragraph starts mid-sentence.
  final List<List<KcPart>> paras;

  List<String> get texts => [for (final p in paras) p.map((x) => x.text).join()];
}

/// Kinds whose back is fragments joined by line breaks, drawn as a list.
const Set<String> listKinds = {'list', 'steps', 'types'};

/// Kinds whose front is the quote with words blanked, and whose back marks them.
const Set<String> blankKinds = {'term', 'key_line'};

/// `markBlanks`: the quote with its blanked words marked, each found in order after the last one.
List<KcPart> markBlanks(String quote, List<String> blanks) {
  final words = [
    for (final w in blanks)
      if (w.trim().isNotEmpty) w,
  ];
  if (words.isEmpty) return [(text: quote, mark: false)];
  final out = <KcPart>[];
  var at = 0;
  final lower = quote.toLowerCase();
  for (final word in words) {
    final i = lower.indexOf(word.toLowerCase(), at);
    if (i < 0) continue;
    if (i > at) out.add((text: quote.substring(at, i), mark: false));
    out.add((text: quote.substring(i, i + word.length), mark: true));
    at = i + word.length;
  }
  if (at < quote.length) out.add((text: quote.substring(at), mark: false));
  return out;
}

/// The card's back, laid out as the website's `NcertText` does it: a list (items), a formula, a journal entry, or
/// paragraphs (a line break in the book's words starts a paragraph). Never changes a word.
KcBackShape backShape(KeyCard card) {
  final lines = listKinds.contains(card.kind) ? backLines(card.back) : const <String>[];
  if (lines.length > 1) {
    final bare = lines.any((l) => ownMarker(l) != null);
    final items = <({String? own, String text})>[];
    for (final (i, l) in lines.indexed) {
      final o = ownMarker(l);
      items.add(o != null ? (own: o.marker, text: o.rest) : (own: null, text: i == 0 ? withLead(l, card) : l));
    }
    return KcListBack(bare: bare, items: items);
  }
  if (card.kind == 'formula') {
    final out = <KcFormulaLine>[];
    for (final (i, l) in formulaLines(card.back).indexed) {
      out.add(
        l.lhs != null
            ? (lhs: i == 0 ? withLead(l.lhs!, card) : l.lhs, rhs: l.rhs, text: null)
            : (lhs: null, rhs: null, text: i == 0 ? withLead(l.text!, card) : l.text),
      );
    }
    return KcFormulaBack(out);
  }
  if (card.kind == 'entry') {
    final rows = entryRows(card.back);
    if (rows != null) return KcEntryBack(rows);
  }
  final marked = blankKinds.contains(card.kind) ? markBlanks(card.back, card.blanks) : <KcPart>[(text: card.back, mark: false)];
  final raw = <List<KcPart>>[[]];
  for (final p in marked) {
    if (p.mark) {
      raw.last.add(p);
      continue;
    }
    for (final (i, t) in p.text.split(RegExp(r'\n+')).indexed) {
      if (i > 0) raw.add([]);
      if (t.isNotEmpty) raw.last.add((text: raw.last.isNotEmpty ? t : t.trimLeft(), mark: false));
    }
  }
  final paras = <List<KcPart>>[];
  for (final ps in raw) {
    if (!ps.any((x) => x.text.trim().isNotEmpty)) continue;
    final first = ps.first;
    final lead = !first.mark && first.text.isNotEmpty && startsMidSentence(first.text, card);
    paras.add(lead ? [(text: '…${first.text}', mark: false), ...ps.skip(1)] : ps);
  }
  return KcParasBack(paras);
}
