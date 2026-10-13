import '../models/attempt.dart';

/// A paper must be a mock or at least this long to carry tonight's repair (a 10-question check
/// counts; a 5-question practice does not).
const int minQuestionsForRepairBasis = 10;

/// True when [attempt] may carry tonight's repair.
bool isRepairBasis(Attempt attempt) => attempt.isMock || attempt.total >= minQuestionsForRepairBasis;

/// The chapter name used to group mistakes. A question without one goes under [otherChapter].
const String otherChapter = 'Other questions';

String chapterKey(String? chapter) {
  final c = chapter?.trim() ?? '';
  return c.isEmpty ? otherChapter : c;
}

/// Tonight's repair, one definition for Today, Review and Start: a repair run covers one chapter
/// of one paper, so tonight is the chapter holding the most open mistakes of the paper (ties go
/// to the chapter with the earliest question), its mistakes in question order.
class TonightChapter<T> {
  const TonightChapter({required this.chapter, required this.items, required this.paperOpen});

  final String chapter;

  /// The chapter's open mistakes, by question number.
  final List<T> items;

  /// Every open mistake in the paper, this chapter included.
  final int paperOpen;

  bool get hasNamedChapter => chapter != otherChapter;
}

/// Picks tonight's chapter from the open mistakes of one paper, or null when there are none.
TonightChapter<T>? pickTonightChapter<T>(
  Iterable<T> open, {
  required String? Function(T) chapterOf,
  required int Function(T) numberOf,
}) {
  final byChapter = <String, List<T>>{};
  var total = 0;
  for (final item in open) {
    byChapter.putIfAbsent(chapterKey(chapterOf(item)), () => []).add(item);
    total++;
  }
  if (byChapter.isEmpty) return null;
  int first(List<T> items) => items.map(numberOf).reduce((a, b) => a < b ? a : b);
  final best = byChapter.entries.reduce((a, b) {
    if (a.value.length != b.value.length) return b.value.length > a.value.length ? b : a;
    return first(b.value) < first(a.value) ? b : a;
  });
  final items = [...best.value]..sort((a, b) => numberOf(a).compareTo(numberOf(b)));
  return TonightChapter(chapter: best.key, items: items, paperOpen: total);
}
