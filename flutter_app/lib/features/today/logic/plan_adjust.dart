// Which weekdays a new study-days count uses (L05 pace strip, app-today-1016 8.7). Pure.
//
// Adding a day picks the rest day with the largest circular gap to its planned neighbours (ties
// to the earlier weekday); removing one drops the planned day whose neighbours are closest
// together (ties to the later weekday). The student's own picks stay wherever possible.
import '../../rhythm/widgets/goal_editor.dart' show spreadDays;

/// [current] adjusted to [n] days (0 = Monday).
Set<int> adjustPlan(Set<int>? current, int n) {
  final target = n.clamp(1, 7);
  if (current == null || current.isEmpty) return spreadDays(target);
  final days = {...current};
  while (days.length < target) {
    days.add(_bestRestDay(days));
  }
  while (days.length > target) {
    days.remove(_crowdedDay(days));
  }
  return days;
}

/// Circular distance forward from [a] to [b] in a 7-day week.
int _forward(int a, int b) => (b - a + 7) % 7 == 0 ? 7 : (b - a + 7) % 7;

int _bestRestDay(Set<int> planned) {
  var best = -1, bestGap = -1;
  for (var d = 0; d < 7; d++) {
    if (planned.contains(d)) continue;
    var before = 7, after = 7;
    for (final p in planned) {
      final f = _forward(d, p), b = _forward(p, d);
      if (f < after) after = f;
      if (b < before) before = b;
    }
    final gap = before < after ? before : after;
    if (gap > bestGap) {
      best = d;
      bestGap = gap;
    }
  }
  return best;
}

int _crowdedDay(Set<int> planned) {
  final sorted = planned.toList()..sort();
  var pick = sorted.first, pickSpan = 99;
  for (final d in sorted) {
    var prev = 7, next = 7;
    for (final p in sorted) {
      if (p == d) continue;
      final f = _forward(d, p), b = _forward(p, d);
      if (f < next) next = f;
      if (b < prev) prev = b;
    }
    final span = prev + next;
    if (span <= pickSpan) {
      pick = d;
      pickSpan = span;
    }
  }
  return pick;
}
