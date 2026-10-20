import 'dart:math' as math;
import 'dart:ui' show FontFeature, PathMetric;

import 'package:flutter/material.dart';

import 'package:lucide_icons_flutter/lucide_icons.dart' show LucideIcons;

import '../../../core/copy/formatters.dart' show formatSignedNumber;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart' show KeyButton;

import '../model/next_move.dart' show ChapterCost;
import '../model/paper_read.dart';

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
  static const Duration after = Duration(milliseconds: _ms);
  static const int _ms = 2400;

  /// A skip lands the end state in this long, never a jump cut.
  static const Duration skip = Duration(milliseconds: 200);

  /// Each ledger row rises in over this share of [after] (about 300 ms), 140 ms apart.
  static const double rowSpan = 300 / _ms;
  static const double rowGap = 140 / _ms;

  /// The total's line starts here (after the three rows), and counts up on its own clock.
  static const double totalAt = 560 / _ms;

  /// The read of the paper comes in from here, its blocks 120 ms apart.
  static const double chaptersAt = 1500 / _ms;
  static const double chapterGap = 100 / _ms;
  static const double blockGap = 120 / _ms;

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

  static const String chaptersHead = 'Marks lost by chapter';
  static const String lostHead = 'Marks';
  static const String tied = 'Tied';

  /// "and 3 more chapters, 11 marks" under the first rows.
  static String more(int chapters, int marks) => 'and $chapters more ${chapters == 1 ? 'chapter' : 'chapters'}, $marks marks';

  /// What TalkBack reads for one chapter row: "Ray Optics, tied first, 6 marks missed".
  static String chapterSpoken(FinishChapter c) =>
      '${c.name}, ${c.tied ? 'tied ' : ''}${_ordinal(c.rank)}, ${c.lost} marks missed';

  /// Over the read's chapter figures: marks a chapter did not earn (6 for a wrong answer, 5 for a blank), never a
  /// deduction, so never written with a minus (app-finish F1: the ledger above takes off only 1 per wrong answer).
  static const String missedHead = 'Marks missed';

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

/// How many of [chapters] show under a cap of [maxRows]: the cap, then any rows tied with the last one shown.
int shownCount(List<FinishChapter> chapters, int maxRows) {
  var n = maxRows.clamp(0, chapters.length);
  while (n > 0 && n < chapters.length && chapters[n].rank == chapters[n - 1].rank) {
    n++;
  }
  return n;
}

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
  const FinishChapters({super.key, required this.chapters, required this.t, this.maxRows = 4, this.lead, this.leadDetail});

  /// Under [lead], for a tie: "Together they cost 24 of the 30 marks you missed."
  final String? leadDetail;

  /// The one sentence over the rows (the v12 line, ties said as ties): "Ray Optics and Electromagnetic Induction each
  /// cost you 6 marks." or "Share Capital cost 29 of the 122 marks you missed."
  final String? lead;

  final List<FinishChapter> chapters;
  final Animation<double> t;
  final int maxRows;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // A tie is never cut in two: the rows go on while the next shares the last shown rank.
    final cut = shownCount(chapters, maxRows);
    final shown = chapters.take(cut).toList();
    final rest = chapters.skip(cut).toList();
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
          if (lead != null) ...[
            const SizedBox(height: MmSpace.s8),
            Opacity(
              opacity: FinishBeats.chapter(t.value, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(lead!, style: type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w600)),
                  if (leadDetail != null) ...[
                    const SizedBox(height: 2),
                    Text(leadDetail!, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s8),
          ] else
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

/// Mobi's read of the paper, the moment's last beat (20 Oct, owner: "it doesn't do the SWOT analysis, it is very
/// basic"): one card, four short blocks, written on the phone from this paper's own numbers (free, no model call).
/// Strengths; Weaknesses (the chapters that lost marks, ranked, ties said and marked, and changed answers that cost
/// marks); the Opportunity (the marks within reach, as this paper's arithmetic, with one "Fix these" key that opens
/// the repair of exactly those answers); Threats (only when the numbers show one). The blocks rise in 120 ms apart on
/// [t]. Mobi is on the screen once, over the paper; the card carries Mobi's name, not a second Mobi. An NTA paper has
/// no Mobi ([plain]): the same read under a plain heading.
class PaperReadCard extends StatelessWidget {
  const PaperReadCard({
    super.key,
    required this.read,
    required this.t,
    this.maxChapters = 3,
    this.lead,
    this.leadDetail,
    this.onFix,
    this.plain = false,
    this.at,
  });

  final PaperRead read;
  final Animation<double> t;
  final int maxChapters;

  /// Over the chapters: the v12 line, ties said as ties ("Goodwill and Admission of a partner each cost you 6 marks.").
  final String? lead;

  /// Under [lead] for a tie: "Together they cost 12 of the 12 marks you missed."
  final String? leadDetail;

  /// Opens the repair of [PaperRead.fixQids]; null hides the key (nothing repairable, keys held).
  final VoidCallback? onFix;

  /// No Mobi (NTA): the heading is the student's own.
  final bool plain;

  /// Where on [t] the first block starts (the practice moment's [FinishBeats.chaptersAt] by default).
  final double? at;

  /// Block [i]'s own 0 to 1 at [v], starting at [from].
  static double beat(double v, int i, {double? from}) => Curves.easeOut.transform(
    ((v - (from ?? FinishBeats.chaptersAt) - i * FinishBeats.blockGap) / FinishBeats.rowSpan).clamp(0.0, 1.0),
  );

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final body = type.body.copyWith(color: colors.ink);
    final r = read;
    final fixCount = r.fixQids.length;
    final blocks = <Widget>[
      if (r.strengths.isNotEmpty)
        _ReadBlock(icon: LucideIcons.trendingUp, label: PaperReadCopy.strengths, tint: colors.goodText, children: [
          for (final s in r.strengths) Text(s, style: body),
        ]),
      _ReadBlock(icon: LucideIcons.trendingDown, label: PaperReadCopy.weaknesses, tint: colors.wrongText, children: [
        if (lead != null && r.leakChapters.length >= 2) ...[
          Text(lead!, style: body.copyWith(fontWeight: FontWeight.w600)),
          if (leadDetail != null) Text(leadDetail!, style: type.small.copyWith(color: colors.ink2)),
        ],
        if (r.leakChapters.length >= 2) _ChapterTable(chapters: r.leakChapters, maxRows: maxChapters),
        for (final s in r.leaks) Text(s, style: body),
      ]),
      _ReadBlock(icon: LucideIcons.target, label: PaperReadCopy.opportunity, tint: colors.accentText, children: [
        Text(r.reach, key: const ValueKey('paper-read-reach'), style: body.copyWith(fontWeight: FontWeight.w600)),
        if (r.reachNote != null) Text(r.reachNote!, style: type.small.copyWith(color: colors.ink2)),
        if (onFix != null && fixCount > 0) ...[
          const SizedBox(height: MmSpace.s4),
          Row(
            children: [
              KeyButton.secondary(
                key: const ValueKey('paper-read-fix'),
                label: PaperReadCopy.fixKey(fixCount),
                semanticsLabel: PaperReadCopy.fixSpoken(fixCount, r.fixChapter),
                expanded: false,
                minHeight: 44,
                onPressed: onFix,
              ),
              const SizedBox(width: MmSpace.s12),
              Flexible(
                child: ExcludeSemantics(child: Text(PaperReadCopy.fixNote(fixCount), style: type.small.copyWith(color: colors.ink3))),
              ),
            ],
          ),
        ],
      ]),
      if (r.risks.isNotEmpty)
        _ReadBlock(icon: LucideIcons.triangleAlert, label: PaperReadCopy.risks, tint: colors.warnText, children: [
          for (final s in r.risks) Text(s, style: body),
        ]),
    ];
    return DecoratedBox(
      key: const ValueKey('paper-read'),
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedSuperellipseBorder(borderRadius: MmRadius.panelAll, side: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s4),
        child: AnimatedBuilder(
          animation: t,
          builder: (context, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Opacity(
                opacity: beat(t.value, 0, from: at),
                child: Semantics(
                  header: true,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        child: Text(
                          plain ? PaperReadCopy.titlePlain : PaperReadCopy.title,
                          style: type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w700),
                        ),
                      ),
                      if (!plain) Text(PaperReadCopy.free, style: type.small.copyWith(color: colors.ink3)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: MmSpace.s4),
              for (var i = 0; i < blocks.length; i++)
                _rise(
                  beat(t.value, i, from: at),
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
                    decoration: i == 0 ? null : BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
                    child: blocks[i],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReadBlock extends StatelessWidget {
  const _ReadBlock({required this.icon, required this.label, required this.tint, required this.children});

  final IconData icon;
  final String label;
  final Color tint;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              ExcludeSemantics(child: Icon(icon, size: 16, color: tint)),
              const SizedBox(width: MmSpace.s8),
              Text(label, style: type.small.copyWith(color: colors.ink2, fontWeight: FontWeight.w700, letterSpacing: 0.2)),
            ],
          ),
          const SizedBox(height: MmSpace.s6),
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(height: MmSpace.s4),
            children[i],
          ],
        ],
      ),
    );
  }
}

/// The chapters that lost marks inside the Weaknesses block: rank, name, "Tied" when shared, marks lost.
class _ChapterTable extends StatelessWidget {
  const _ChapterTable({required this.chapters, required this.maxRows});

  final List<FinishChapter> chapters;
  final int maxRows;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // A tie is never cut in two: the rows go on while the next shares the last shown rank.
    final cut = shownCount(chapters, maxRows);
    final shown = chapters.take(cut).toList();
    final rest = chapters.skip(cut).toList();
    final value = _tabular(type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w700));
    final rank = _tabular(type.small.copyWith(color: colors.ink3, fontWeight: FontWeight.w600));
    return Column(
      key: const ValueKey('finish-chapters'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: ExcludeSemantics(child: Text(FinishRevealCopy.missedHead, style: type.caption.copyWith(color: colors.ink3))),
        ),
        for (final c in shown)
          Semantics(
            container: true,
            label: FinishRevealCopy.chapterSpoken(c),
            excludeSemantics: true,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  SizedBox(width: 20, child: Text('${c.rank}', style: rank)),
                  Expanded(child: Text(c.name, style: type.body.copyWith(color: colors.ink), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  if (c.tied) ...[const SizedBox(width: MmSpace.s8), _TiedTag()],
                  const SizedBox(width: MmSpace.s12),
                  Text('${c.lost}', style: value),
                ],
              ),
            ),
          ),
        if (rest.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(left: 20, top: 2),
            child: Text(FinishRevealCopy.more(rest.length, rest.fold(0, (s, c) => s + c.lost)), style: type.small.copyWith(color: colors.ink3)),
          ),
      ],
    );
  }
}
