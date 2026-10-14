import '../data/runner_session.dart';

/// One cell of the palette sheet (spec 5.5): every fact is its own flag, so the painter draws
/// each as its own shape and TalkBack reads each in words.
class SheetCell {
  const SheetCell({
    required this.number,
    required this.answered,
    required this.visited,
    required this.marked,
    required this.unsynced,
    required this.current,
  });

  final int number;
  final bool answered;
  final bool visited;
  final bool marked;

  /// The answer exists only on this phone so far (a hollow dot).
  final bool unsynced;
  final bool current;

  @override
  bool operator ==(Object other) =>
      other is SheetCell &&
      other.number == number &&
      other.answered == answered &&
      other.visited == visited &&
      other.marked == marked &&
      other.unsynced == unsynced &&
      other.current == current;

  @override
  int get hashCode => Object.hash(number, answered, visited, marked, unsynced, current);
}

/// The counts the legend and the submit page show. Not answered counts every question without
/// an answer, visited or not, so the three numbers always add up to the total with marks apart.
class SheetCounts {
  const SheetCounts({
    required this.answered,
    required this.notAnswered,
    required this.notVisited,
    required this.marked,
    required this.total,
  });

  final int answered;
  final int notAnswered;
  final int notVisited;
  final int marked;
  final int total;
}

List<SheetCell> sheetCellsOf(RunnerSession s) {
  final unsynced = s.unsyncedQuestionIds;
  return [
    for (var i = 0; i < s.questions.length; i++)
      SheetCell(
        number: i + 1,
        answered: s.answerFor(s.questions[i].id) != null,
        visited: s.visited.contains(s.questions[i].id) || i == s.currentIndex,
        marked: s.marked.contains(s.questions[i].id),
        unsynced: unsynced.contains(s.questions[i].id),
        current: i == s.currentIndex,
      ),
  ];
}

SheetCounts sheetCountsOf(List<SheetCell> cells) {
  var answered = 0;
  var notVisited = 0;
  var marked = 0;
  for (final c in cells) {
    if (c.answered) answered++;
    if (!c.visited && !c.answered) notVisited++;
    if (c.marked) marked++;
  }
  return SheetCounts(answered: answered, notAnswered: cells.length - answered, notVisited: notVisited, marked: marked, total: cells.length);
}

/// The first and last question numbers sharing [index]'s passage, or null when the passage
/// belongs to this question alone.
(int, int)? passageRangeOf(RunnerSession s, int index) {
  final group = s.questions[index].passageGroupId;
  if (group == null || group.isEmpty) return null;
  var first = index;
  var last = index;
  while (first > 0 && s.questions[first - 1].passageGroupId == group) {
    first--;
  }
  while (last < s.questions.length - 1 && s.questions[last + 1].passageGroupId == group) {
    last++;
  }
  return first == last ? null : (first + 1, last + 1);
}

/// What Mobi does on a practice's submit page, read from the sheet itself.
enum SheetMobiCue {
  /// Every question has an answer and none is marked: one nod.
  nod,

  /// Questions without an answer: he points at the "not answered" row, and it pulses once.
  pointAtBlank,

  /// All answered, some marked for review: a curious tilt.
  tilt,
}

/// The cue for a sheet with [counts]: blanks first, then marks, then a full sheet.
SheetMobiCue sheetMobiCue(SheetCounts counts) {
  if (counts.notAnswered > 0) return SheetMobiCue.pointAtBlank;
  if (counts.marked > 0) return SheetMobiCue.tilt;
  return SheetMobiCue.nod;
}

/// A legend key on the palette, used as a filter: only the cells in that state stay bright.
enum SheetFilter { notAnswered, notVisited, marked, unsynced }

/// Whether [cell] is in the state [filter] names (the legend's own meaning: "not answered" is a
/// question seen and left blank; "not visited" one never opened).
bool sheetCellMatches(SheetCell cell, SheetFilter filter) => switch (filter) {
  SheetFilter.notAnswered => !cell.answered && cell.visited,
  SheetFilter.notVisited => !cell.answered && !cell.visited,
  SheetFilter.marked => cell.marked,
  SheetFilter.unsynced => cell.unsynced,
};

/// The next cell matching [filter] after [from], wrapping round, so the "Go to question N" key
/// walks through the matches; [from] itself comes last. -1 when nothing matches.
int nextSheetMatch(List<SheetCell> cells, SheetFilter filter, int from) {
  final n = cells.length;
  for (var step = 1; step <= n; step++) {
    final i = (from + step) % n;
    if (i >= 0 && sheetCellMatches(cells[i], filter)) return i;
  }
  return -1;
}
