import 'dart:math' as math;
import 'dart:ui' show FontFeature, PathMetric;

import 'package:flutter/material.dart';

import '../../../core/copy/formatters.dart' show formatSignedNumber;
import '../../../core/theme/theme.dart';
import '../model/next_move.dart' show ChapterCost;

/// The second half of the finish moment (20 Oct, owner I13, G22, D108): after the sheet has inked
/// and the figure has stamped, the marks are shown being added up, line by line, the way a paper
/// is marked: what the right answers earned (+5 each), what the wrong ones took off (-1 each), what
/// the questions not attempted gave (0), and under a rule the total, counted up and circled by the
/// marker's pen. Then where the marks went, chapter by chapter, with ties said as ties. Every band
/// gets the whole of it (a great set, a poor one, a sheet left blank): the moment is the paper
/// being marked, not a prize for a good score.
///
/// The beats are fractions of one controller, [FinishBeats.after] long, that the stage starts once
/// the figure has landed. A skip runs that controller to its end in [FinishBeats.skip]; reduced
/// motion and a result opened again show the end state at once.
abstract final class FinishBeats {
  /// From the landing of the figure to the end of the moment.
  static const Duration after = Duration(milliseconds: 2100);

  /// A skip lands the end state in this long, never a jump cut.
  static const Duration skip = Duration(milliseconds: 200);

  /// Each ledger row rises in over this share of [after] (about 300 ms), 140 ms apart.
  static const double rowSpan = 300 / 2100;
  static const double rowGap = 140 / 2100;

  /// The total's line starts here (after the three rows), and counts up on its own clock.
  static const double totalAt = 560 / 2100;

  /// The chapters come in from here, 100 ms apart.
  static const double chaptersAt = 1300 / 2100;
  static const double chapterGap = 100 / 2100;

  /// Row [i]'s own 0 to 1 at [t] of [after].
  static double row(double t, int i) => Curves.easeOut.transform(((t - i * rowGap) / rowSpan).clamp(0.0, 1.0));

  /// Chapter row [i]'s own 0 to 1 at [t].
  static double chapter(double t, int i) => Curves.easeOut.transform(((t - chaptersAt - i * chapterGap) / rowSpan).clamp(0.0, 1.0));
}

/// The words of the ledger and the chapters, read aloud before they were written.
abstract final class FinishRevealCopy {
  static const String ledgerHead = 'How your marks add up';
  static String rightLabel(int n) => '$n right';
  static String wrongLabel(int n) => '$n wrong';
  static String blankLabel(int n) => '$n not attempted';
  static const String rightRule = '+5 each';
  static const String wrongRule = '−1 each';
  static const String blankRule = '0 each';

  static const String chaptersHead = 'Where the marks went';
  static const String lostHead = 'Marks lost';
  static const String tied = 'Tied';

  /// "and 3 more chapters, 11 marks" under the first rows.
  static String more(int chapters, int marks) => 'and $chapters more ${chapters == 1 ? 'chapter' : 'chapters'}, $marks marks';

  /// What TalkBack reads for one chapter row: "Ray Optics, tied first, 6 marks lost".
  static String chapterSpoken(FinishChapter c) =>
      '${c.name}, ${c.tied ? 'tied ' : ''}${_ordinal(c.rank)}, ${c.lost} marks lost';

  /// What TalkBack reads for the ledger.
  static String ledgerSpoken(int right, int wrong, int blank) =>
      '${rightLabel(right)}, plus ${right * 5}. ${wrongLabel(wrong)}, minus $wrong. ${blankLabel(blank)}, 0.';

  static String _ordinal(int n) => switch (n) {
    1 => 'first',
    2 => 'second',
    3 => 'third',
    4 => 'fourth',
    5 => 'fifth',
    _ => 'number $n',
  };
}

/// One chapter in "Where the marks went": its competition rank (1 + the chapters that lost strictly
/// more), whether another chapter lost the same marks, and the marks it lost (6 per wrong answer,
/// 5 per question not attempted).
@immutable
class FinishChapter {
  const FinishChapter({required this.name, required this.lost, required this.rank, required this.tied, this.wrong = 0, this.blank = 0});

  final String name;
  final int lost;
  final int rank;
  final bool tied;
  final int wrong;
  final int blank;

  @override
  bool operator ==(Object other) =>
      other is FinishChapter && other.name == name && other.lost == lost && other.rank == rank && other.tied == tied;

  @override
  int get hashCode => Object.hash(name, lost, rank, tied);
}

/// The chapters that lost marks, ranked honestly: equal marks share a rank and are marked tied, so
/// "the costliest" is never one name picked out of a tie (owner I14). [ranked] is
/// `rankedChapterCosts`, most marks first.
List<FinishChapter> finishChaptersOf(List<ChapterCost> ranked) => [
  for (final c in ranked)
    FinishChapter(
      name: c.chapter,
      lost: c.marks,
      rank: 1 + ranked.where((o) => o.marks > c.marks).length,
      tied: ranked.where((o) => o.marks == c.marks).length > 1,
      wrong: c.wrong,
      blank: c.blank,
    ),
];

TextStyle _tabular(TextStyle s) => s.copyWith(fontFeatures: const [FontFeature.tabularFigures()]);

/// The marks added up, row by row: "7 right, +5 each, +35", "2 wrong, -1 each, -2", "1 not
/// attempted, 0 each, 0". Each row rises in and its value counts up from 0 in tabular figures, so
/// the column never jitters. [t] is the stage's after-landing controller; [footer] (the completion
/// line with its circled total) sits under the rule.
class FinishLedger extends StatelessWidget {
  const FinishLedger({super.key, required this.right, required this.wrong, required this.blank, required this.t, required this.footer, this.sheet});

  /// The student's sheet, inking, at the top of the same card: the paper and its marking are one thing.
  final Widget? sheet;

  final int right;
  final int wrong;
  final int blank;
  final Animation<double> t;
  final Widget footer;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = type.body.copyWith(color: colors.ink);
    final rule = _tabular(type.small.copyWith(color: colors.ink3));
    final value = _tabular(type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w700));
    final rows = <(String, String, int, Color)>[
      (FinishRevealCopy.rightLabel(right), FinishRevealCopy.rightRule, right * 5, colors.ink),
      (FinishRevealCopy.wrongLabel(wrong), FinishRevealCopy.wrongRule, -wrong, wrong > 0 ? colors.wrongText : colors.ink),
      (FinishRevealCopy.blankLabel(blank), FinishRevealCopy.blankRule, 0, colors.ink2),
    ];
    // The value column is as wide as its widest final value, so nothing moves while the values count.
    final scaler = MediaQuery.textScalerOf(context);
    var valueWidth = 0.0;
    for (final r in rows) {
      final p = TextPainter(text: TextSpan(text: _signedPlus(r.$3), style: value), textDirection: TextDirection.ltr, textScaler: scaler)
        ..layout();
      valueWidth = math.max(valueWidth, p.width);
      p.dispose();
    }

    return DecoratedBox(
      key: const ValueKey('finish-ledger'),
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedSuperellipseBorder(borderRadius: MmRadius.panelAll, side: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s16),
        child: AnimatedBuilder(
          animation: t,
          child: sheet,
          builder: (context, sheet) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (sheet != null) ...[sheet, const SizedBox(height: MmSpace.s16)],
              // The head and the marking scheme (+5, -1, 0 each) are printed on the paper from the start, as on a real
              // mark sheet: what is being added up is clear before the marks arrive, and the card is never an empty box.
              Text(FinishRevealCopy.ledgerHead, style: type.caption.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s8),
              Semantics(
                container: true,
                label: FinishRevealCopy.ledgerSpoken(right, wrong, blank),
                excludeSemantics: true,
                child: Column(
                  children: [
                    for (var i = 0; i < rows.length; i++)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Expanded(
                                child: _rise(
                                  FinishBeats.row(t.value, i),
                                  Text(rows[i].$1, style: label, maxLines: 1, overflow: TextOverflow.ellipsis),
                                ),
                              ),
                              Text(rows[i].$2, style: rule),
                              const SizedBox(width: MmSpace.s16),
                              _rise(FinishBeats.row(t.value, i), SizedBox(
                                width: valueWidth,
                                child: Text(
                                  _signedPlus((rows[i].$3 * FinishBeats.row(t.value, i)).round()),
                                  key: ValueKey('ledger-value-$i'),
                                  style: value.copyWith(color: rows[i].$4),
                                  textAlign: TextAlign.right,
                                  maxLines: 1,
                                  softWrap: false,
                                ),
                              )),
                            ],
                          ),
                        ),
                  ],
                ),
              ),
              const SizedBox(height: MmSpace.s8),
              // The rule under the column, drawn left to right as the total arrives.
              Align(
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: Curves.easeOut.transform(((t.value - FinishBeats.totalAt + 0.08) / 0.12).clamp(0.0, 1.0)),
                  child: Container(height: 1, color: colors.lineStrong),
                ),
              ),
              const SizedBox(height: MmSpace.s12),
              footer,
            ],
          ),
        ),
      ),
    );
  }
}

/// "+35", "−2", "0": a sign on every non-zero value, as a marker writes them in the margin.
String _signedPlus(int v) => v > 0 ? '+$v' : formatSignedNumber(v);

Widget _rise(double v, Widget child) => Opacity(
  opacity: v,
  child: Transform.translate(offset: Offset(0, 8 * (1 - v)), child: child),
);

/// "Where the marks went": the chapters that lost marks, ranked, with ties sharing a rank and marked
/// "Tied". At most [maxRows]; the rest are one line. Shown only when two or more chapters lost marks
/// (with one, the ledger has already said everything).
class FinishChapters extends StatelessWidget {
  const FinishChapters({super.key, required this.chapters, required this.t, this.maxRows = 4});

  final List<FinishChapter> chapters;
  final Animation<double> t;
  final int maxRows;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = chapters.take(maxRows).toList();
    final rest = chapters.skip(maxRows).toList();
    final value = _tabular(type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w700));
    final rank = _tabular(type.small.copyWith(color: colors.ink3, fontWeight: FontWeight.w600));
    return AnimatedBuilder(
      key: const ValueKey('finish-chapters'),
      animation: t,
      builder: (context, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Opacity(
            opacity: FinishBeats.chapter(t.value, 0),
            child: Row(
              children: [
                Expanded(child: Text(FinishRevealCopy.chaptersHead, style: type.caption.copyWith(color: colors.ink2))),
                Text(FinishRevealCopy.lostHead, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s4),
          for (var i = 0; i < shown.length; i++)
            _rise(
              FinishBeats.chapter(t.value, i),
              Semantics(
                container: true,
                label: FinishRevealCopy.chapterSpoken(shown[i]),
                excludeSemantics: true,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
                  child: Row(
                    children: [
                      SizedBox(width: 22, child: Text('${shown[i].rank}', style: rank)),
                      Expanded(
                        child: Text(shown[i].name, style: type.body.copyWith(color: colors.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                      if (shown[i].tied) ...[
                        const SizedBox(width: MmSpace.s8),
                        _TiedTag(),
                      ],
                      const SizedBox(width: MmSpace.s12),
                      Text('${shown[i].lost}', style: value),
                    ],
                  ),
                ),
              ),
            ),
          if (rest.isNotEmpty)
            Opacity(
              opacity: FinishBeats.chapter(t.value, shown.length),
              child: Container(
                padding: const EdgeInsets.only(top: 8),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
                child: Text(
                  FinishRevealCopy.more(rest.length, rest.fold(0, (s, c) => s + c.lost)),
                  style: type.small.copyWith(color: colors.ink3),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _TiedTag extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: colors.lineStrong))),
      child: Text(FinishRevealCopy.tied, style: type.small.copyWith(color: colors.ink2, fontWeight: FontWeight.w600, height: 1.2)),
    );
  }
}

/// The marker's ring around the total: a hand-drawn loop (slightly tilted, a little open where the
/// pen lifted) that draws itself over [progress] 0 to 1. Painted outside its child's box.
class MarkerCircle extends StatelessWidget {
  const MarkerCircle({super.key, required this.progress, required this.color, required this.child});

  final Animation<double> progress;
  final Color color;
  final Widget child;

  @override
  Widget build(BuildContext context) => CustomPaint(
    foregroundPainter: _MarkerPainter(progress: progress, color: color),
    child: child,
  );
}

class _MarkerPainter extends CustomPainter {
  _MarkerPainter({required this.progress, required this.color}) : super(repaint: progress);

  final Animation<double> progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = progress.value;
    if (p <= 0) return;
    final c = size.center(Offset.zero);
    final rx = size.width / 2 + 1;
    final ry = size.height / 2 + 2;
    // A loop of a little more than a full turn, starting top right, tilted by 6 degrees: a pen, not a compass.
    final path = Path();
    const turns = 1.08;
    const steps = 64;
    const tilt = -6 * math.pi / 180;
    for (var i = 0; i <= steps; i++) {
      final a = -math.pi / 3 - 2 * math.pi * turns * i / steps;
      // The loop widens a touch as it goes, so the overlap reads as one stroke.
      final grow = 1 + 0.06 * i / steps;
      final x = rx * grow * math.cos(a);
      final y = ry * grow * math.sin(a);
      final pt = c + Offset(x * math.cos(tilt) - y * math.sin(tilt), x * math.sin(tilt) + y * math.cos(tilt));
      if (i == 0) {
        path.moveTo(pt.dx, pt.dy);
      } else {
        path.lineTo(pt.dx, pt.dy);
      }
    }
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..color = color;
    for (final PathMetric m in path.computeMetrics()) {
      canvas.drawPath(m.extractPath(0, m.length * p.clamp(0.0, 1.0)), paint);
    }
  }

  @override
  bool shouldRepaint(_MarkerPainter old) => old.progress != progress || old.color != color;
}
