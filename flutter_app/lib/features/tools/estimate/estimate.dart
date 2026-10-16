// The student's estimate: raw marks out of 1000 with a named source, set against one college's
// Round 1 cutoff. It replaces the old typed score field in the Colleges area: nothing ever asks for a
// score the student does not have; without an estimate the screens show cutoffs alone.
// Pure: tested without a phone.

/// Where the estimate came from. The words on screen always name it.
enum EstimateSource { mocks, projection, typed }

class Estimate {
  const Estimate({required this.source, required this.low, required this.high, this.at, this.papers = const []});

  final EstimateSource source;

  /// 0..1000.
  final double low;

  /// >= [low]; equal to it for a single figure.
  final double high;

  /// The newest mock counted, the projection's time, or when it was typed (null when unknown).
  final DateTime? at;

  /// From mocks only: each of the four papers DU counts with its newest full mock, out of 250.
  final List<({String id, int marks})> papers;

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

enum Verdict { clears, within, below, noSeat }

/// The estimate against one cutoff [cutoff] (Round 1, 2026, for the category): clears when the
/// low end reaches it (by how much), within when only the high end does, below otherwise (by how
/// much); a college with no Round 1 seat for the category has no cutoff.
({Verdict v, double by}) verdictFor(Estimate e, double? cutoff) {
  if (cutoff == null) return (v: Verdict.noSeat, by: 0);
  if (e.low >= cutoff) return (v: Verdict.clears, by: e.low - cutoff);
  if (e.high >= cutoff) return (v: Verdict.within, by: 0);
  return (v: Verdict.below, by: cutoff - e.high);
}

/// One decimal, without a trailing ".0" ("612", "907.5").
String estimateFigure(double v) {
  final r = (v * 10).round() / 10;
  return r == r.roundToDouble() ? r.toStringAsFixed(0) : r.toStringAsFixed(1);
}

/// "588 to 640" or "612".
String estimateRange(Estimate e) => e.isPoint ? estimateFigure(e.low) : '${estimateFigure(e.low)} to ${estimateFigure(e.high)}';

/// The verdict in words, always with real figures.
String verdictWords(({Verdict v, double by}) r) => switch (r.v) {
      Verdict.clears => 'Clears by ${estimateFigure(r.by)}',
      Verdict.within => 'Within your range',
      Verdict.below => 'Needs ${estimateFigure(r.by)} more',
      Verdict.noSeat => 'No Round 1 seat for this category',
    };
