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
