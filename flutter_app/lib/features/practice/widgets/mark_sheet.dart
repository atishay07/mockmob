import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/copy/formatters.dart' show formatSignedNumber, plural;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../result/model/time_decisions.dart' show spentLabel;
import '../../result/widgets/finish_reveal.dart' show MarkerCircle;
import 'finish_ceremony.dart' show FinishCeremony, StampPainter;

/// The mark sheet of a finished practice (20 Oct, owner K7: "a proper reveal of the mark sheet"): one paper that is
/// set down and stamped as saved, then marked bubble by bubble while its tally and its score add up on CUET marking,
/// then the score lands and is circled. These are its parts; [FinishStage] runs them.
///
/// The beats, after the submit the server acknowledged:
/// 1. The sheet is set down and stamped ([SheetBeats.seal], 520 ms): it rises 12 dp, the paper stamp lands on it out of
///    a small turn (a light haptic as it touches) and "Your paper is saved." comes in beside it.
/// 2. The marking: the bubbles ink in paper order; under them the tally counts what is inked (+5 each right, -1 each
///    wrong, 0 each not attempted) and the score is the sum of what is inked, so every number is true at every frame.
/// 3. The score lands (the stamp of the figure, a medium haptic) and the marker circles it.
/// 4. After it ([SheetBeats.after]): the time and the accuracy, Mobi's line, the marks by chapter and Mobi's read.
abstract final class SheetBeats {
  /// The sheet is set down and stamped as saved, before any mark is shown.
  static const Duration seal = Duration(milliseconds: 520);

  /// Inside [seal]: the card rises over its first half, the stamp lands from [stampFrom] (touching down at
  /// [stampLand], where the light haptic is) and the words come in from [wordsFrom].
  static const double cardEnd = 0.5;
  static const double stampFrom = 0.22;
  static const double stampLand = 0.62;
  static const double wordsFrom = 0.42;

  /// From the landing of the score to the end of the moment.
  static const Duration after = Duration(milliseconds: _ms);
  static const int _ms = 1100;

  /// The marker's loop round the score ends here.
  static const double circleEnd = 420 / _ms;

  /// The facts under the sheet, the chapters and the read come in from these points, each block [gap] after the last
  /// and rising over [span].
  static const double factsAt = 60 / _ms;
  static const double chaptersAt = 240 / _ms;
  static const double readAt = 380 / _ms;
  static const double span = 280 / _ms;
  static const double gap = 90 / _ms;

  /// Block [i]'s own 0 to 1 at [t] of [after], starting at [at].
  static double beat(double t, double at, [int i = 0]) => Motion.glide.transform(((t - at - i * gap) / span).clamp(0.0, 1.0));

  /// The seal's own sub-beats, 0 to 1, at [t] of [seal].
  static double card(double t) => Motion.glide.transform((t / cardEnd).clamp(0.0, 1.0));
  static double stamp(double t) => ((t - stampFrom) / (1 - stampFrom)).clamp(0.0, 1.0);
  static double words(double t) => Motion.glide.transform(((t - wordsFrom) / (1 - wordsFrom)).clamp(0.0, 1.0));
}

/// What one answer is worth on CUET marking: +5 right, -1 wrong (a repaired wrong answer was still wrong on the paper),
/// 0 not attempted.
int worthOf(QuestionCell c) => switch (c) {
  QuestionCell.right => 5,
  QuestionCell.wrong || QuestionCell.repaired => -1,
  QuestionCell.blank || QuestionCell.changed => 0,
};

/// The sheet's bubble for one answer, as the tally draws it.
BubbleState bubbleOf(QuestionCell c) => switch (c) {
  QuestionCell.right => BubbleState.filled,
  QuestionCell.wrong || QuestionCell.repaired => BubbleState.wrong,
  QuestionCell.blank || QuestionCell.changed => BubbleState.blank,
};

/// The marks of the first [inked] answers of [cells]: the score the sheet shows while it is marked.
int marksOf(List<QuestionCell> cells, int inked) {
  var m = 0;
  for (var i = 0; i < cells.length && i < inked; i++) {
    m += worthOf(cells[i]);
  }
  return m;
}

/// The lowest and highest score the sheet passes through while it is marked, and its end: the score's box is as wide
/// as the widest of them from the first frame, so nothing beside it moves while it adds up.
List<int> marksExtremes(List<QuestionCell> cells, int finalMarks) {
  var lo = 0, hi = 0, m = 0;
  for (final c in cells) {
    m += worthOf(c);
    lo = math.min(lo, m);
    hi = math.max(hi, m);
  }
  return [lo, hi, finalMarks];
}

/// The words of the mark sheet, read aloud before they were written (R6).
abstract final class SheetCopy {
  /// The head, straight after the submit once the server's acknowledgement is held here, and on a result opened again.
  static const String saved = 'Your paper is saved.';

  /// The head on a fresh result whose acknowledgement is not held on this phone: never a claim before it is true.
  static const String marked = 'Your paper is marked.';

  /// "Accountancy practice, 10 questions on Goodwill."
  static String paper({required String? subject, required int questions, String? chapter}) {
    final what = subject == null ? 'Practice' : '$subject practice';
    return chapter == null ? '$what, ${plural(questions, 'question')}.' : '$what, ${plural(questions, 'question')} on $chapter.';
  }

  /// "of 50 marks"
  static String outOf(int max) => 'of $max marks';

  /// "You scored 27 of 50 marks."
  static String scored(int marks, int max) => 'You scored ${formatSignedNumber(marks)} of $max marks.';

  static const String accuracyNone = 'answered';
  static String accuracyNote(int answered) => answered == 1 ? 'right of the 1 you answered' : 'right of the $answered you answered';
  static String answeredNote(int total) => 'answered, of $total';
  static String timeNote(int perQuestionSec) => 'about ${spentLabel(perQuestionSec)} a question';

  /// What TalkBack reads for the facts.
  static String factsSpoken({required int right, required int answered, required int total, Duration? spent, int timed = 0}) {
    final accuracy = answered == 0 ? 'Nothing answered of $total.' : '${(100 * right / answered).round()}% right of the $answered you answered.';
    if (spent == null || timed == 0) return accuracy;
    return '$accuracy Time ${spentLabel(spent.inSeconds)}, ${timeNote((spent.inSeconds / timed).round())}.';
  }

  static const String chaptersHead = 'Marks by chapter';

  /// "2 right, 1 wrong, 1 not attempted"
  static String chapterCounts(int right, int wrong, int blank) =>
      [if (right > 0) '$right right', if (wrong > 0) '$wrong wrong', if (blank > 0) '$blank not attempted'].join(', ');

  /// "Goodwill: 9 of 20 marks. 2 right, 1 wrong, 1 not attempted."
  static String chapterSpoken(ChapterMark c) =>
      '${c.name}: ${formatSignedNumber(c.scored)} of ${c.max} marks. ${chapterCounts(c.right, c.wrong, c.blank)}.';
}

TextStyle _tabular(TextStyle s) => s.copyWith(fontFeatures: const [FontFeature.tabularFigures()]);

/// The paper stamp ("saved"), pressed onto the sheet: it lands from 1.35x out of a small turn on the emphasized curve and
/// rests a little tilted, as a real stamp does. [t] runs 0 to 1 once; the room is held at 0 so nothing moves.
class SheetStamp extends StatelessWidget {
  const SheetStamp({super.key, required this.t, this.size = 48});

  /// The scalloped paper seal with a tick (the Mob parcel's own stamp art, spec 5.7).
  static const String asset = 'assets/art/stamp-seal.webp';

  final double t;
  final double size;

  /// The art at the size it is drawn ([size] dp at the screen's density): the stage decodes it before the stamp lands.
  static ImageProvider provider(BuildContext context, {double size = 48}) =>
      ResizeImage(const AssetImage(asset), width: (size * MediaQuery.devicePixelRatioOf(context)).round());

  @override
  Widget build(BuildContext context) {
    if (t <= 0) return SizedBox.square(dimension: size);
    final e = Motion.emphasized.transform(t.clamp(0.0, 1.0));
    final scale = 1.35 - 0.35 * e;
    final turn = -0.12 - 0.42 * (1 - e);
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: Opacity(
          opacity: (t / 0.3).clamp(0.0, 1.0),
          child: Transform(
            alignment: Alignment.center,
            transform: Matrix4.rotationZ(turn)..scaleByDouble(scale, scale, 1, 1),
            child: Image(
              image: provider(context, size: size),
              width: size,
              height: size,
              filterQuality: FilterQuality.medium,
              errorBuilder: (context, _, _) => _CodeStamp(size: size),
            ),
          ),
        ),
      ),
    );
  }
}

/// If the stamp art is missing: a volt square with a tick, drawn in code.
class _CodeStamp extends StatelessWidget {
  const _CodeStamp({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(color: colors.volt, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(size * 0.16))),
      child: SizedBox.square(dimension: size, child: Icon(Icons.check_rounded, size: size * 0.6, color: colors.voltInk)),
    );
  }
}

/// The head of the sheet: the stamp, "Your paper is saved." and what the paper was and when it was recorded. [seal] is
/// the seal beat (0 to 1); a sheet with no acknowledgement held here has no stamp and says "Your paper is marked.".
class SavedHead extends StatelessWidget {
  const SavedHead({super.key, required this.title, required this.detail, required this.stamped, required this.seal});

  final String title;
  final String? detail;
  final bool stamped;
  final Animation<double> seal;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final words = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(header: true, child: Text(title, key: const ValueKey('sheet-saved'), style: type.title.copyWith(color: colors.ink))),
        if (detail != null) ...[
          const SizedBox(height: 2),
          Text(detail!, style: type.small.copyWith(color: colors.ink2)),
        ],
      ],
    );
    return AnimatedBuilder(
      animation: seal,
      child: words,
      builder: (context, words) {
        final w = SheetBeats.words(seal.value);
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (stamped) ...[
              Padding(padding: const EdgeInsets.only(top: 2), child: SheetStamp(t: SheetBeats.stamp(seal.value))),
              const SizedBox(width: MmSpace.s12),
            ],
            Expanded(
              child: Opacity(
                opacity: w,
                child: Transform.translate(offset: Offset(0, 6 * (1 - w)), child: words),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// The score on the sheet: "27 of 50 marks". While the sheet is marked it is the sum of what is inked; it lands with the
/// stamp of the figure ([stamp], with the ring and the burst behind it for a good set) and the marker circles it
/// ([circle]). The figure sits in a box as wide as the widest value it passes through ([extremes]), right-aligned in
/// tabular figures, so "of 50 marks" never moves.
class SheetScore extends StatelessWidget {
  const SheetScore({
    super.key,
    required this.value,
    required this.max,
    required this.extremes,
    required this.stamp,
    required this.circle,
    required this.circleColor,
    required this.burst,
    required this.landed,
    this.figureKey,
  });

  final int value;
  final int max;
  final List<int> extremes;
  final Animation<double> stamp;
  final Animation<double> circle;
  final Color circleColor;

  /// The ring and the shards behind the figure as it lands (a good set with Celebrations on Full).
  final bool burst;

  /// The score has landed: TalkBack hears it once, as a live region.
  final bool landed;
  final Key? figureKey;

  static const EdgeInsets _ringPad = EdgeInsets.fromLTRB(8, 2, 10, 4);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = _tabular(type.figureHero.copyWith(fontSize: 72, height: 0.95, color: colors.ink));
    final scaler = MediaQuery.textScalerOf(context);
    var widest = 0.0;
    for (final v in extremes) {
      final p = TextPainter(text: TextSpan(text: formatSignedNumber(v), style: style), textDirection: TextDirection.ltr, textScaler: scaler)
        ..layout();
      widest = math.max(widest, p.width);
      p.dispose();
    }
    final figure = SizedBox(
      width: widest,
      child: Text(
        formatSignedNumber(value),
        key: figureKey,
        style: style,
        textAlign: TextAlign.right,
        maxLines: 1,
        softWrap: false,
        overflow: TextOverflow.visible,
      ),
    );
    final ringed = MarkerCircle(progress: circle, color: circleColor, child: Padding(padding: _ringPad, child: figure));
    final stamped = AnimatedBuilder(
      animation: stamp,
      child: ringed,
      builder: (context, child) => Transform.scale(scale: FinishCeremony.figureScale(stamp.value), child: child),
    );
    return Semantics(
      container: true,
      liveRegion: landed,
      label: SheetCopy.scored(value, max),
      excludeSemantics: true,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: IgnorePointer(
              child: RepaintBoundary(
                child: CustomPaint(painter: StampPainter(stamp: stamp, colors: colors, burst: burst, centerX: _ringPad.left + widest / 2)),
              ),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              stamped,
              const SizedBox(width: MmSpace.s8),
              Flexible(child: Text(SheetCopy.outOf(max), style: type.title.copyWith(color: colors.ink2), maxLines: 2)),
            ],
          ),
        ],
      ),
    );
  }
}

/// The facts under the sheet, from this paper's own record: how much of what was answered was right, and the time with
/// the time a question when the phone timed it (else how many were answered). Nothing is shown that is not known.
class SheetFacts extends StatelessWidget {
  const SheetFacts({super.key, required this.right, required this.answered, required this.total, this.spent, this.timed = 0});

  final int right;
  final int answered;
  final int total;

  /// Time on the questions, summed from the phone's own timing; null when it was not recorded.
  final Duration? spent;

  /// Questions the phone timed.
  final int timed;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final value = _tabular(type.figureCompact.copyWith(fontSize: 28, height: 1.05, color: colors.ink));
    final note = type.caption.copyWith(color: colors.ink3);
    Widget cell(String v, String n, Key key) => Column(
      key: key,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(v, style: value, maxLines: 1),
        const SizedBox(height: 2),
        Text(n, style: note),
      ],
    );
    final first = answered == 0
        ? cell('0', SheetCopy.answeredNote(total), const ValueKey('sheet-answered'))
        : cell('${(100 * right / answered).round()}%', SheetCopy.accuracyNote(answered), const ValueKey('sheet-accuracy'));
    final s = spent;
    final second = s != null && timed > 0
        ? cell(spentLabel(s.inSeconds), SheetCopy.timeNote((s.inSeconds / timed).round()), const ValueKey('sheet-time'))
        : answered == 0
            ? null
            : cell('$answered', SheetCopy.answeredNote(total), const ValueKey('sheet-answered'));
    return Semantics(
      container: true,
      label: SheetCopy.factsSpoken(right: right, answered: answered, total: total, spent: s, timed: timed),
      excludeSemantics: true,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: first),
            if (second != null) ...[
              VerticalDivider(width: 1, thickness: 1, color: colors.line),
              const SizedBox(width: MmSpace.s16),
              Expanded(child: second),
            ],
          ],
        ),
      ),
    );
  }
}

/// One chapter of the paper: its questions and what they earned on CUET marking.
@immutable
class ChapterMark {
  const ChapterMark({required this.name, required this.right, required this.wrong, required this.blank});

  final String name;
  final int right;
  final int wrong;
  final int blank;

  int get questions => right + wrong + blank;
  int get scored => right * 5 - wrong;
  int get max => questions * 5;
  int get missed => max - scored;

  @override
  bool operator ==(Object other) =>
      other is ChapterMark && other.name == name && other.right == right && other.wrong == wrong && other.blank == blank;

  @override
  int get hashCode => Object.hash(name, right, wrong, blank);
}

/// The paper's chapters with their marks, the chapter that missed the most first; chapters that missed the same marks
/// keep the paper's order (no tie is broken by a claim: the rows show the numbers). [rows] is each answer's chapter and
/// cell in paper order;
/// answers with no chapter on record are left out.
List<ChapterMark> chapterMarksOf(Iterable<(String?, QuestionCell)> rows) {
  final order = <String>[];
  final counts = <String, List<int>>{};
  for (final (chapter, cell) in rows) {
    final name = chapter?.trim() ?? '';
    if (name.isEmpty) continue;
    final c = counts.putIfAbsent(name, () {
      order.add(name);
      return [0, 0, 0];
    });
    switch (worthOf(cell)) {
      case 5:
        c[0]++;
      case -1:
        c[1]++;
      default:
        c[2]++;
    }
  }
  final out = [
    for (final n in order) ChapterMark(name: n, right: counts[n]![0], wrong: counts[n]![1], blank: counts[n]![2]),
  ];
  final index = {for (var i = 0; i < order.length; i++) order[i]: i};
  out.sort((a, b) {
    final byMissed = b.missed.compareTo(a.missed);
    return byMissed != 0 ? byMissed : index[a.name]!.compareTo(index[b.name]!);
  });
  return out;
}

/// "Marks by chapter": each chapter of the paper with what it earned of what it could, a bar of the share earned, and
/// its counts. The rows rise in on [t] from [at], [SheetBeats.gap] apart. At most [maxRows]; the rest are one line.
class ChapterMarksBlock extends StatelessWidget {
  const ChapterMarksBlock({super.key, required this.chapters, required this.t, this.at = SheetBeats.chaptersAt, this.maxRows = 5});

  final List<ChapterMark> chapters;
  final Animation<double> t;
  final double at;
  final int maxRows;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = chapters.take(maxRows).toList();
    final rest = chapters.skip(maxRows).toList();
    final value = _tabular(type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w700));
    return AnimatedBuilder(
      key: const ValueKey('sheet-chapters'),
      animation: t,
      builder: (context, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Opacity(
            opacity: SheetBeats.beat(t.value, at),
            child: Semantics(header: true, child: Text(SheetCopy.chaptersHead, style: type.cardTitle.copyWith(fontSize: 16, color: colors.ink))),
          ),
          const SizedBox(height: MmSpace.s4),
          for (var i = 0; i < shown.length; i++)
            _rise(
              SheetBeats.beat(t.value, at, i),
              Semantics(
                container: true,
                label: SheetCopy.chapterSpoken(shown[i]),
                excludeSemantics: true,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
                  decoration: i == 0 ? null : BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Expanded(
                            child: Text(shown[i].name, style: type.body.copyWith(color: colors.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
                          ),
                          const SizedBox(width: MmSpace.s12),
                          Text(formatSignedNumber(shown[i].scored), style: value),
                          Text(' of ${shown[i].max}', style: _tabular(type.small.copyWith(color: colors.ink3))),
                        ],
                      ),
                      const SizedBox(height: MmSpace.s6),
                      _ShareBar(share: shown[i].max == 0 ? 0 : (shown[i].scored / shown[i].max).clamp(0.0, 1.0)),
                      const SizedBox(height: MmSpace.s4),
                      Text(SheetCopy.chapterCounts(shown[i].right, shown[i].wrong, shown[i].blank), style: type.caption.copyWith(color: colors.ink3)),
                    ],
                  ),
                ),
              ),
            ),
          if (rest.isNotEmpty)
            Opacity(
              opacity: SheetBeats.beat(t.value, at, shown.length),
              child: Padding(
                padding: const EdgeInsets.only(top: MmSpace.s4),
                child: Text(
                  'and ${plural(rest.length, 'more chapter')}, ${rest.fold(0, (s, c) => s + c.scored)} of ${rest.fold(0, (s, c) => s + c.max)} marks',
                  style: type.small.copyWith(color: colors.ink3),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// A 4 dp track with the share earned inked in volt (olive on Daylight, so it reads on paper).
class _ShareBar extends StatelessWidget {
  const _ShareBar({required this.share});

  final double share;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: SizedBox(
        height: 4,
        child: CustomPaint(painter: _SharePainter(share: share, fill: colors.isNight ? colors.volt : colors.accentText, track: colors.line)),
      ),
    );
  }
}

class _SharePainter extends CustomPainter {
  const _SharePainter({required this.share, required this.fill, required this.track});

  final double share;
  final Color fill;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Radius.circular(size.height / 2);
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, r), Paint()..color = track);
    final w = size.width * share;
    if (w <= 0.5) return;
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, math.max(w, size.height), size.height), r), Paint()..color = fill);
  }

  @override
  bool shouldRepaint(_SharePainter old) => old.share != share || old.fill != fill || old.track != track;
}

// A row still rising cannot be tapped (L-30).
Widget _rise(double v, Widget child) => IgnorePointer(
  ignoring: v < 0.99,
  child: Opacity(
    opacity: v,
    child: Transform.translate(offset: Offset(0, 8 * (1 - v)), child: child),
  ),
);
