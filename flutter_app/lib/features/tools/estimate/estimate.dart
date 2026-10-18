// The student's estimate: raw marks out of 1000 with a named source, set against one college's
// Round 1 cutoff. It replaces the old typed score field in the Colleges area: nothing ever asks for a
// score the student does not have; without an estimate the screens show cutoffs alone.
//
// One rule for every screen (owner, 19 Oct, G18): a college is "safe" when the LOW end of the range
// reaches its cutoff and "in reach" when only the HIGH end does. The rows, the sheet's headline and
// "Your colleges" all count with [verdictFor] and say it with the same two words.
// Pure: tested without a phone.

import 'dart:math' as math;

/// Where the estimate came from. The words on screen always name it.
enum EstimateSource { mocks, projection, typed }

class Estimate {
  const Estimate({required this.source, required this.low, required this.high, this.at, this.papers = const [], this.mocks = 0});

  final EstimateSource source;

  /// 0..1000.
  final double low;

  /// >= [low]; equal to it for a single figure.
  final double high;

  /// The newest mock counted, the projection's time, or when it was typed (null when unknown).
  final DateTime? at;

  /// From mocks only: each of the four papers DU counts with its marks out of 250 (the average of
  /// the mocks counted in it).
  final List<({String id, int marks})> papers;

  /// From mocks only: how many full mocks the estimate is built on.
  final int mocks;

  bool get isPoint => (high - low).abs() < 0.05;

  @override
  bool operator ==(Object other) => other is Estimate && other.source == source && other.low == low && other.high == high;

  @override
  int get hashCode => Object.hash(source, low, high);
}

/// Which of the student's estimates wins: one they typed after their newest full mock, else the
/// mocks, else the practice projection, else one they typed (even if older). Null when none exists.
Estimate? pickEstimate({Estimate? typed, Estimate? mocks, Estimate? projection}) {
  if (typed != null && (mocks == null || typed.at == null || mocks.at == null || !mocks.at!.isAfter(typed.at!))) return typed;
  return mocks ?? projection ?? typed;
}

/// clears: safe (the low end reaches the cutoff). within: in reach (only the high end does).
enum Verdict { clears, within, below, noSeat }

/// The estimate against one college's Round 1 cutoff.
typedef CollegeVerdict = ({Verdict v, double by, double cutoff});

/// The estimate against one cutoff [cutoff] (Round 1, 2026, for the category): safe when the low
/// end reaches it ([by] = how far above), in reach when only the high end does, below otherwise
/// ([by] = how far the high end falls short); a college with no Round 1 seat for the category has
/// no cutoff.
CollegeVerdict verdictFor(Estimate e, double? cutoff) {
  if (cutoff == null) return (v: Verdict.noSeat, by: 0, cutoff: 0);
  if (e.low >= cutoff) return (v: Verdict.clears, by: e.low - cutoff, cutoff: cutoff);
  if (e.high >= cutoff) return (v: Verdict.within, by: cutoff - e.low, cutoff: cutoff);
  return (v: Verdict.below, by: cutoff - e.high, cutoff: cutoff);
}

/// One decimal, without a trailing ".0" ("612", "907.5").
String estimateFigure(double v) {
  final r = (v * 10).round() / 10;
  return r == r.roundToDouble() ? r.toStringAsFixed(0) : r.toStringAsFixed(1);
}

/// "588 to 640" or "612".
String estimateRange(Estimate e) => e.isPoint ? estimateFigure(e.low) : '${estimateFigure(e.low)} to ${estimateFigure(e.high)}';

/// The verdict in words, always with real figures, in the same words as the headline.
String verdictWords(CollegeVerdict r) => switch (r.v) {
      Verdict.clears => 'Safe, clears by ${estimateFigure(r.by)}',
      Verdict.within => 'In reach if you score ${estimateFigure(r.cutoff)}',
      Verdict.below => 'Needs ${estimateFigure(r.by)} more',
      Verdict.noSeat => 'No Round 1 seat for this category',
    };

/// How many of a set of colleges an estimate puts safe, in reach and out of reach. Colleges with no
/// Round 1 seat for the category are left out of [total].
class Reach {
  const Reach({this.safe = 0, this.inReach = 0, this.below = 0});

  final int safe;
  final int inReach;
  final int below;

  int get total => safe + inReach + below;

  /// Safe or in reach: the colleges the range can get.
  int get reachable => safe + inReach;

  @override
  bool operator ==(Object other) => other is Reach && other.safe == safe && other.inReach == inReach && other.below == below;

  @override
  int get hashCode => Object.hash(safe, inReach, below);

  @override
  String toString() => 'Reach(safe: $safe, inReach: $inReach, below: $below)';
}

/// Counts [cutoffs] with [verdictFor], the rule the rows use, so the headline can never disagree
/// with them.
Reach reachOf(Estimate e, Iterable<double?> cutoffs) {
  var safe = 0, inReach = 0, below = 0;
  for (final c in cutoffs) {
    switch (verdictFor(e, c).v) {
      case Verdict.clears:
        safe++;
      case Verdict.within:
        inReach++;
      case Verdict.below:
        below++;
      case Verdict.noSeat:
        break;
    }
  }
  return Reach(safe: safe, inReach: inReach, below: below);
}

// ---------------------------------------------------------------------------------------------
// Typing a range.

/// The widest typed range that still says something: wider than this and nearly every college is
/// "in reach" (owner, 19 Oct, G18).
const double maxRangeGap = 200;

enum RangeProblem {
  /// Nothing typed.
  empty,

  /// Not a number or a range of two numbers.
  notANumber,

  /// A number under 0 or over 1000.
  outOfScale,

  /// The two ends are more than [maxRangeGap] apart.
  tooWide,
}

/// A typed score or range: [low] <= [high], both 0..1000, or a [problem].
class ParsedRange {
  const ParsedRange._(this.low, this.high, this.problem);
  const ParsedRange.ok(double low, double high) : this._(low, high, null);
  const ParsedRange.problem(RangeProblem problem) : this._(null, null, problem);

  final double? low;
  final double? high;
  final RangeProblem? problem;

  bool get ok => problem == null;
  bool get isEmpty => problem == RangeProblem.empty;
  bool get isPoint => ok && (high! - low!).abs() < 0.05;

  Estimate? estimate({DateTime? at}) => ok ? Estimate(source: EstimateSource.typed, low: low!, high: high!, at: at) : null;

  /// As a link writes it: "900-920" or "912".
  String? get link => !ok ? null : (isPoint ? estimateFigure(low!) : '${estimateFigure(low!)}-${estimateFigure(high!)}');

  @override
  bool operator ==(Object other) => other is ParsedRange && other.low == low && other.high == high && other.problem == problem;

  @override
  int get hashCode => Object.hash(low, high, problem);

  @override
  String toString() => ok ? 'ParsedRange($low, $high)' : 'ParsedRange($problem)';
}

final RegExp _number = RegExp(r'\d+(?:\.\d+)?|\.\d+');

/// "900-920", "900 to 920", "900–920", "900 — 920", "900 920", "920-900" (swapped) and "912" all
/// parse; a gap over [maxRangeGap] or a figure outside 0..1000 does not. Anything else in the text
/// (a word other than "to", a minus sign in front) is not a range.
ParsedRange parseRange(String? text) {
  final t = (text ?? '').trim().toLowerCase();
  if (t.isEmpty) return const ParsedRange.problem(RangeProblem.empty);
  final numbers = _number.allMatches(t).toList();
  if (numbers.isEmpty || numbers.length > 2) return const ParsedRange.problem(RangeProblem.notANumber);
  // What sits around and between the figures must be nothing, or one separator.
  if (t.substring(0, numbers.first.start).trim().isNotEmpty) return const ParsedRange.problem(RangeProblem.notANumber);
  if (t.substring(numbers.last.end).trim().isNotEmpty) return const ParsedRange.problem(RangeProblem.notANumber);
  if (numbers.length == 2) {
    final between = t.substring(numbers.first.end, numbers.last.start).trim();
    const separators = {'', '-', '–', '—', '~', 'to', '−'};
    if (!separators.contains(between)) return const ParsedRange.problem(RangeProblem.notANumber);
  }
  final values = [for (final m in numbers) double.parse(m.group(0)!)];
  if (values.any((v) => v < 0 || v > 1000)) return const ParsedRange.problem(RangeProblem.outOfScale);
  final low = values.reduce(math.min);
  final high = values.reduce(math.max);
  if (high - low > maxRangeGap) return const ParsedRange.problem(RangeProblem.tooWide);
  return ParsedRange.ok(low, high);
}

/// The sheet's two fields, From and To. To is optional. A whole range typed (or pasted) into From
/// counts when To is empty; a lower To swaps.
ParsedRange parseRangeFields(String from, String to) {
  final f = from.trim();
  final t = to.trim();
  if (t.isEmpty) return parseRange(f);
  if (f.isEmpty) return const ParsedRange.problem(RangeProblem.empty);
  final lo = parseRange(f);
  final hi = parseRange(t);
  // Each field holds one figure; a range in either one next to a figure in the other is not a range.
  if (!lo.ok) return lo;
  if (!hi.ok) return hi;
  if (!lo.isPoint || !hi.isPoint) return const ParsedRange.problem(RangeProblem.notANumber);
  return parseRange('${lo.low} to ${hi.low}');
}
