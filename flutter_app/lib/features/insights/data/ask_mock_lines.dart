import '../../../core/domain/chapter_breakdown.dart';

/// Where a mock's lost marks went, one plain line per chapter, from the counts the result screen
/// already holds (ASK-MOBI-1018 section 3, "Ask Mobi about this mock"). The sheet shows these as
/// its first answer, free: they are this paper's own figures, never read from anywhere else.
///
/// At most [take] chapters, most marks first; a chapter with no name is left out. Empty when the
/// paper lost no marks, so an entry can stay hidden then.
List<String> mockLostLines(ChapterBreakdown chapters, {required int lost, int take = 3}) {
  if (lost <= 0) return const [];
  return [
    for (final c in chapters.lossChapters)
      if (c.chapter.trim().isNotEmpty) _line(c, lost),
  ].take(take).toList();
}

String _line(ChapterStat c, int lost) {
  final cause = switch ((c.wrong, c.unattempted)) {
    (final w, final b) when w > 0 && b > 0 => '$w wrong and $b left blank',
    (final w, _) when w > 0 => '$w wrong',
    (_, final b) => '$b left blank',
  };
  // One chapter that cost every lost mark says so, instead of "30 of the 30".
  final share = c.marksLost >= lost ? 'all $lost marks slipped' : '${c.marksLost} of the $lost marks slipped';
  return '${c.chapter}: $share, $cause';
}
