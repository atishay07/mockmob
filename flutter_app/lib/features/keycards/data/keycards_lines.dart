/// How a card's back is set on screen when the book breaks it into lines (KEYCARDS-CONTENT-SPEC 3: the words are
/// NCERT's own; only their layout is the app's). Pure, so the walk's real cards can be checked in unit tests.
library;

/// One paragraph of a back: a list item takes a bullet unless the book already numbers or letters it.
typedef KcParagraph = ({String text, bool bullet});

/// Kinds whose lines are items of a list.
const Set<String> _listKinds = {'list', 'steps', 'types', 'difference'};

/// "1. ", "2) ", "(i) ", "(b) ", "a. ", "Step 1 :", "- " or "•": the book's own marker.
final RegExp _marker = RegExp(r'^(\(?(\d{1,2}|[ivxIVX]{1,5}|[a-hA-H])[.)]\s|Step\s+\d+\s*[:.]|[-–•*]\s)');

/// The back's lines as paragraphs: one paragraph for a back without line breaks; for a list, steps, types or a
/// difference, every line that is an item (not one ending in a colon, which introduces the items) and has no
/// marker of its own takes a bullet.
List<KcParagraph> backParagraphs(String back, String kind) {
  final lines = [
    for (final l in back.split('\n'))
      if (l.trim().isNotEmpty) l.trim(),
  ];
  if (lines.length < 2) return [(text: back.trim(), bullet: false)];
  final listy = _listKinds.contains(kind);
  return [for (final l in lines) (text: l, bullet: listy && !l.endsWith(':') && !_marker.hasMatch(l))];
}

/// A row of a journal entry as the book sets it out.
enum KcEntryRowKind {
  /// An account debited: the account (and its qualifier, such as "(Individually)"), then "Dr." at the right.
  debit,

  /// "To" an account credited, indented under the debits.
  credit,

  /// The narration in brackets, under the entry.
  narration,

  /// Anything else (an amount, a heading), as it is.
  plain,
}

class KcEntryRow {
  const KcEntryRow(this.kind, this.text, {this.aside});

  final KcEntryRowKind kind;
  final String text;

  /// A debit's qualifier printed after "Dr." in the source line, such as "(Individually)".
  final String? aside;

  @override
  bool operator ==(Object other) => other is KcEntryRow && other.kind == kind && other.text == text && other.aside == aside;

  @override
  int get hashCode => Object.hash(kind, text, aside);

  @override
  String toString() => 'KcEntryRow($kind, "$text"${aside == null ? '' : ', aside: "$aside"'})';
}

final RegExp _drAlone = RegExp(r'^Dr\.(?:\s+(.+))?$');
final RegExp _drAtEnd = RegExp(r'^(.*\S)\s+Dr\.(?:\s+(.+))?$');
final RegExp _label = RegExp(r'^\((?:[a-z]|[ivx]{1,5})\)\s+\S');

/// A narration closes with its bracket (and the full stop some lines carry after it).
final RegExp _closes = RegExp(r'\)\.?$');

/// The rows of a journal entry, or null when [back] is not one (an entry card can carry a treatment written as
/// prose). The words stay the book's; "Dr." moves to the right of the line it belongs to, as the book prints it,
/// and a narration broken over lines is joined.
List<KcEntryRow>? journalRows(String back) {
  if (!back.contains('Dr.')) return null;
  // "Partner's Capital A/c Dr. To Bank A/c" on one line: the credit starts its own row.
  final text = back.replaceAll('\r', '').replaceAllMapped(RegExp(r'\bDr\.[ \t]+(?=To\s)'), (m) => 'Dr.\n');
  final rows = <KcEntryRow>[];
  var narrationOpen = false;
  for (final raw in text.split('\n')) {
    final line = raw.trim();
    if (line.isEmpty) continue;
    if (narrationOpen && !line.startsWith('To ') && !_drAlone.hasMatch(line)) {
      final last = rows.removeLast();
      rows.add(KcEntryRow(KcEntryRowKind.narration, '${last.text} $line'));
      narrationOpen = !_closes.hasMatch(line);
      continue;
    }
    narrationOpen = false;
    final alone = _drAlone.firstMatch(line);
    if (alone != null) {
      final last = rows.isEmpty ? null : rows.last;
      if (last != null && last.kind == KcEntryRowKind.plain) {
        rows[rows.length - 1] = KcEntryRow(KcEntryRowKind.debit, last.text, aside: alone.group(1));
      } else {
        rows.add(KcEntryRow(KcEntryRowKind.plain, line));
      }
      continue;
    }
    final atEnd = _drAtEnd.firstMatch(line);
    if (atEnd != null) {
      rows.add(KcEntryRow(KcEntryRowKind.debit, atEnd.group(1)!, aside: atEnd.group(2)));
      continue;
    }
    if (line.startsWith('To ')) {
      rows.add(KcEntryRow(KcEntryRowKind.credit, line));
      continue;
    }
    if (line.startsWith('(') && !_label.hasMatch(line)) {
      rows.add(KcEntryRow(KcEntryRowKind.narration, line));
      narrationOpen = !_closes.hasMatch(line);
      continue;
    }
    rows.add(KcEntryRow(KcEntryRowKind.plain, line));
  }
  final debits = rows.where((r) => r.kind == KcEntryRowKind.debit).length;
  final credits = rows.where((r) => r.kind == KcEntryRowKind.credit).length;
  return debits > 0 && credits > 0 ? rows : null;
}
