import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/domain/domain.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../model/recap_variant.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;
import '../result_nav.dart';
import '../widgets/evidence_link.dart';
import '../widgets/result_space.dart';
import 'card_page.dart';
import 'recap_mobi.dart';

/// Card 3 (spec 5.6.3): one chapter to start with, from the observed chapter breakdown of this
/// mock (never from a forecast). Every claim carries its evidence: the cost figure, and the
/// ruler of the paper with this chapter's answers under it, each opening that exact answer. Mobi
/// thinks about it beside the two links, then points down at the ruler. The ruler and its answers
/// sit on the card itself: no panel.
class FirstFixCard extends ConsumerStatefulWidget {
  const FirstFixCard({super.key, required this.model, required this.onNext, required this.onBack});

  final RecapModel model;
  final VoidCallback onNext;
  final VoidCallback onBack;

  @override
  ConsumerState<FirstFixCard> createState() => _FirstFixCardState();
}

class _FirstFixCardState extends ConsumerState<FirstFixCard> {
  final GlobalKey _strip = GlobalKey();

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    final onNext = widget.onNext;
    final leader = m.chapters.leader;
    final lower = m.variant == RecapVariant.lower;
    final blanksOnly = m.chapters.leaderIsBlanksOnly;
    // The cost figure rolls (T1) unless the result is calm or Celebrations is Off (words only).
    final roll = m.variant.celebratory && ref.watch(celebrationModeProvider) != CelebrationMode.off;

    final String title;
    final List<Widget> evidence;
    final List<(int, BubbleState)> tiles;
    if (leader != null && blanksOnly) {
      title = ResultCopy.startWithBlanks(leader.chapter);
      evidence = [
        if (!m.isHeld) ...[_Cost(stat: leader, missed: m.breakdown.lost, max: m.breakdown.max, roll: roll), const SizedBox(height: MmSpace.s12)],
        _Line(ResultCopy.blanksEvidence(leader.unattempted, leader.questions)),
      ];
      tiles = [for (final n in leader.blankNumbers) (n, BubbleState.blank)];
    } else if (leader != null) {
      title = ResultCopy.startWith(leader.chapter);
      evidence = [
        if (!m.isHeld) ...[_Cost(stat: leader, missed: m.breakdown.lost, max: m.breakdown.max, roll: roll), const SizedBox(height: MmSpace.s12)],
        _Line(ResultCopy.costMost),
        const SizedBox(height: MmSpace.s4),
        // The four counts, once, in one line: they are the evidence, not a second figure.
        Semantics(
          container: true,
          child: Text(
            ResultCopy.chapterCounts(leader.questions, leader.correct, leader.wrong, leader.unattempted),
            style: context.mmType.small.copyWith(color: context.mmColors.ink3),
          ),
        ),
      ];
      tiles = [
        ...[for (final n in leader.wrongNumbers) (n, BubbleState.wrong)],
        ...[for (final n in leader.blankNumbers) (n, BubbleState.blank)],
      ]..sort((a, b) => a.$1.compareTo(b.$1));
    } else if (m.chapters.wrongNumbers.isNotEmpty) {
      title = ResultCopy.startWithWrong;
      evidence = [_Line(ResultCopy.wrongByNumber(m.chapters.wrongNumbers.length))];
      tiles = [for (final n in m.chapters.wrongNumbers) (n, BubbleState.wrong)];
    } else {
      title = ResultCopy.nothingToFix;
      evidence = [_Line(ResultCopy.everyAnswerRight)];
      tiles = const [];
    }

    // The primary key always carries on to card 4, so the recap never dead-ends here. Blanks are
    // not mistakes to repair, so there is no repair to choose: card 4 is "what is recorded", and
    // practising the chapter is a quiet second key that leaves the recap.
    final primary = KeyButton(
      label: blanksOnly || tiles.isEmpty ? ResultCopy.nextWhatsNext : ResultCopy.nextChoose,
      onPressed: onNext,
    );
    final practise = switch ((leader, blanksOnly)) {
      (final l?, true) => KeyButton.quiet(
        label: ResultCopy.practiseChapter,
        onPressed: () => context.go(ResultNav.practiseChapter(m, l.chapter)),
      ),
      _ => null,
    };

    final showWhy = leader != null && !blanksOnly;
    // Mobi shares the row of links, on the right, where it can point down at the ruler. At large
    // text the row needs the width, so Mobi leaves (nothing ever sits under the keys for it).
    final largeText = MediaQuery.textScalerOf(context).scale(14) / 14 > 1.15;
    return RecapCardPage(
      onNext: onNext,
      onBack: widget.onBack,
      topPadding: lower ? MmSpace.s32 : MmSpace.s8,
      footer: practise == null
          ? primary
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                primary,
                Wrap(alignment: WrapAlignment.center, children: [practise]),
              ],
            ),
      children: [
        _Header(subjectId: m.subjectId),
        Semantics(header: true, child: Text(title, style: context.mmType.moment)),
        const SizedBox(height: MmSpace.s4),
        if (tiles.isNotEmpty)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Both links are flush with the 20 dp gutter and 48 dp tall, in the same slot at
              // every text size.
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    EvidenceLink(
                      label: ResultCopy.seeQuestions(tiles.length),
                      onTap: () => ResultNav.toFullResult(context, m.attemptId, question: tiles.first.$1),
                    ),
                    if (showWhy) EvidenceLink(label: ResultCopy.whyThis, icon: LucideIcons.info, onTap: () => _why(context, leader)),
                  ],
                ),
              ),
              if (!largeText) ...[
                const SizedBox(width: MmSpace.s12),
                RecapMobi(
                  pose: MobiPose.think,
                  size: ResultSpace.mobi,
                  lookAt: _strip,
                  // The point lands as the last stem does: the ruler starts RulerTimeline.start after
                  // the card, and Mobi has thought for as long as the ruler takes to stand.
                  thinkFor: RulerTimeline.pointAt(tiles.length),
                ),
              ],
            ],
          )
        else
          const SizedBox(height: MmSpace.s12),
        const SizedBox(height: MmSpace.s4),
        ...evidence,
        if (tiles.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s24),
          _AnswerRuler(
            key: _strip,
            label: leader == null ? ResultCopy.yourWrongAnswers : ResultCopy.yourAnswersHere,
            questions: m.cells.length,
            tiles: tiles,
            onOpen: (n) => ResultNav.toFullResult(context, m.attemptId, question: n),
          ),
        ],
      ],
    );
  }

  /// The sheet's future completes when it closes, so the row it rose from stays lit until then.
  Future<void> _why(BuildContext context, ChapterStat stat) {
    return showMmSheet<void>(
      context: context,
      title: ResultCopy.whyTitle,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s24),
        child: Text(ResultCopy.whyBody(stat.wrong, stat.unattempted), style: context.mmType.body),
      ),
    );
  }
}

/// The subject's light, pooled softly behind the top of the card: environment only, no object
/// (the book belongs to Today). The headline starts 24 dp under the story bar (8 of padding and
/// 16 here), the same line as on every other card.
class _Header extends StatelessWidget {
  const _Header({required this.subjectId});

  final String subjectId;

  @override
  Widget build(BuildContext context) {
    final light = SubjectLight.forSubject(subjectId == 'gat' ? 'general_test' : subjectId);
    return SizedBox(
      height: MmSpace.s16,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          if (light != null)
            Positioned(
              right: -60,
              top: -80,
              width: 280,
              height: 240,
              child: IgnorePointer(
                child: LightField(
                  pools: [LightPool(color: light.of(Theme.of(context).brightness), center: Alignment.center, radius: 0.5, strength: 0.8)],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(text, style: context.mmType.body.copyWith(color: context.mmColors.ink2));
}

/// How many question tiles fit on a row of [maxWidth]: six when each is at least 48 dp wide
/// (the touch target minimum), otherwise as many as keep that width, never fewer than one.
int firstFixTileColumns(double maxWidth) {
  for (var n = 6; n > 1; n--) {
    if ((maxWidth - (n - 1) * _tileGap) / n >= 48) return n;
  }
  return 1;
}

const double _tileGap = 4;

/// Where the answer chips stand, one under each stem of the ruler. Each wants to be centred under
/// its own stem; the stems of neighbouring questions are closer together than a 48 dp target is
/// wide, so the chips are eased apart (never closer than [gap] between centres) and kept inside
/// [minX]..[maxX]. Null when they cannot all fit on one line: the caller wraps them instead.
List<double>? chipCenters(List<double> desired, {required double minX, required double maxX, double gap = 50}) {
  if (desired.isEmpty) return const [];
  final c = [...desired];
  c[0] = c[0].clamp(minX, maxX);
  for (var i = 1; i < c.length; i++) {
    if (c[i] < c[i - 1] + gap) c[i] = c[i - 1] + gap;
  }
  if (c.last > maxX) c[c.length - 1] = maxX;
  for (var i = c.length - 2; i >= 0; i--) {
    if (c[i] > c[i + 1] - gap) c[i] = c[i + 1] - gap;
  }
  return c.first < minX - 0.01 ? null : c;
}

/// The chapter's answers on the card itself, no panel: the whole paper as one ruler (question 1 at
/// the left, the last at the right) with this chapter's answers standing on it, wrong in coral and
/// blank as an open dash, so the student sees whether they cluster or spread. Under it, one chip
/// per answer, number over bubble, each under its own stem on a thin leader and each opening that
/// exact answer. Observed positions only. When there are too many to stand in one line the chips
/// wrap into rows instead (and the leaders go).
class _AnswerRuler extends StatefulWidget {
  const _AnswerRuler({super.key, required this.label, required this.questions, required this.tiles, required this.onOpen});

  final String label;
  final int questions;
  final List<(int, BubbleState)> tiles;
  final ValueChanged<int> onOpen;

  @override
  State<_AnswerRuler> createState() => _AnswerRulerState();

  static const double _inset = 6;
  static const double _chip = 48;
  static const double _rulerHeight = _mapHeight + 26;
  static const double _chipHeight = 72;

}

class _AnswerRulerState extends State<_AnswerRuler> with SingleTickerProviderStateMixin {
  late final AnimationController _draw;
  Timer? _wait;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _draw = AnimationController(vsync: this, duration: Duration(milliseconds: RulerTimeline.total(widget.tiles.length)));
  }

  @override
  void didUpdateWidget(_AnswerRuler old) {
    super.didUpdateWidget(old);
    // More or fewer stems than before: the timeline's length follows.
    if (old.tiles.length != widget.tiles.length) _draw.duration = Duration(milliseconds: RulerTimeline.total(widget.tiles.length));
  }

  String get label => widget.label;
  int get questions => widget.questions;
  List<(int, BubbleState)> get tiles => widget.tiles;
  ValueChanged<int> get onOpen => widget.onOpen;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _draw.value = 1;
    } else {
      // After the card's own blocks have arrived.
      _wait = Timer(const Duration(milliseconds: RulerTimeline.start), () {
        if (mounted) _draw.forward();
      });
    }
  }

  @override
  void dispose() {
    _wait?.cancel();
    _draw.dispose();
    super.dispose();
  }

  static const double _inset = _AnswerRuler._inset;
  static const double _chip = _AnswerRuler._chip;
  static const double _rulerHeight = _AnswerRuler._rulerHeight;
  static const double _chipHeight = _AnswerRuler._chipHeight;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The label is real text at a readable contrast, with the paper's extent on the right.
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(child: Text(label, style: type.small.copyWith(color: colors.ink2))),
            const SizedBox(width: MmSpace.s12),
            ExcludeSemantics(child: Text(ResultCopy.range(questions), style: type.caption.copyWith(color: colors.ink3))),
          ],
        ),
        const SizedBox(height: MmSpace.s12),
        LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            double x(int n) => questions <= 1 ? width / 2 : _inset + (n - 1) * (width - 2 * _inset) / (questions - 1);
            final centers = chipCenters(
              [for (final (n, _) in tiles) x(n)],
              minX: _chip / 2,
              maxX: width - _chip / 2,
              gap: _chip + 2,
            );
            if (centers == null) return _Wrapped(width: width, questions: questions, tiles: tiles, onOpen: onOpen, draw: _draw);
            return SizedBox(
              height: _rulerHeight + _chipHeight,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    left: 0,
                    right: 0,
                    top: 0,
                    height: _rulerHeight,
                    child: ExcludeSemantics(
                      child: RepaintBoundary(
                        child: CustomPaint(
                          painter: _RulerPainter(questions: questions, marks: tiles, chipCenters: centers, colors: colors, inset: _inset, draw: _draw),
                        ),
                      ),
                    ),
                  ),
                  for (var i = 0; i < tiles.length; i++)
                    Positioned(
                      left: centers[i] - _chip / 2,
                      top: _rulerHeight,
                      width: _chip,
                      height: _chipHeight,
                      child: _ChipDrop(
                        draw: _draw,
                        index: i,
                        count: tiles.length,
                        child: _QuestionTile(number: tiles[i].$1, state: tiles[i].$2, width: _chip, onTap: () => onOpen(tiles[i].$1)),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

/// The fallback: the ruler alone, then the chips wrapped six to a row (fewer where six would leave
/// a chip under 48 dp wide).
class _Wrapped extends StatelessWidget {
  const _Wrapped({required this.width, required this.questions, required this.tiles, required this.onOpen, required this.draw});

  final double width;
  final int questions;
  final List<(int, BubbleState)> tiles;
  final ValueChanged<int> onOpen;
  final Animation<double> draw;

  @override
  Widget build(BuildContext context) {
    final columns = firstFixTileColumns(width);
    final tile = (width - (columns - 1) * _tileGap) / columns;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: _mapHeight,
          child: ExcludeSemantics(
            child: RepaintBoundary(
              child: CustomPaint(
                painter: _RulerPainter(questions: questions, marks: tiles, chipCenters: null, colors: context.mmColors, inset: _AnswerRuler._inset, draw: draw),
              ),
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        Wrap(
          spacing: _tileGap,
          runSpacing: MmSpace.s4,
          children: [
            for (var i = 0; i < tiles.length; i++)
              _ChipDrop(
                draw: draw,
                index: i,
                count: tiles.length,
                child: _QuestionTile(number: tiles[i].$1, state: tiles[i].$2, width: tile, onTap: () => onOpen(tiles[i].$1)),
              ),
          ],
        ),
      ],
    );
  }
}

const double _mapHeight = 44;

class _RulerPainter extends CustomPainter {
  _RulerPainter({required this.questions, required this.marks, required this.chipCenters, required this.colors, required this.inset, required this.draw})
    : super(repaint: draw);

  /// 0 to 1 over RulerTimeline.total: the baseline draws, then each stem rises in paper order.
  final Animation<double> draw;

  final int questions;
  final List<(int, BubbleState)> marks;

  /// Where each mark's chip stands (same order as [marks]), for the leaders; null draws none.
  final List<double>? chipCenters;
  final MmColors colors;
  final double inset;

  @override
  void paint(Canvas canvas, Size size) {
    if (questions <= 0) return;
    final base = _mapHeight - 1;
    final span = size.width - 2 * inset;
    final step = questions == 1 ? 0.0 : span / (questions - 1);
    double x(int n) => questions == 1 ? size.width / 2 : inset + (n - 1) * step;
    final ms = draw.value * RulerTimeline.total(marks.length);
    // The ruler draws left to right: the baseline and its ticks are clipped to how far it has run.
    final reach = inset + span * RulerTimeline.baseline(ms);
    canvas.save();
    canvas.clipRect(Rect.fromLTRB(0, 0, reach, size.height));
    canvas.drawRect(Rect.fromLTWH(inset, base - 0.5, span, 1), Paint()..color = colors.line);
    final tick = Paint()..color = colors.ink4;
    for (var n = 1; n <= questions; n++) {
      canvas.drawRect(Rect.fromLTWH(x(n) - 0.5, base - 7, 1, 7), tick);
    }
    canvas.restore();
    const head = 5.0;
    final leaders = chipCenters;
    for (var i = 0; i < marks.length; i++) {
      final (n, s) = marks[i];
      if (n < 1 || n > questions) continue;
      final cx = x(n);
      final wrong = s == BubbleState.wrong;
      final ink = wrong ? colors.wrongMark : colors.ink2;
      // The stem rises from the baseline in its turn (paper order): its head is where the top
      // of the stem has got to.
      final rise = RulerTimeline.stem(ms, i, marks.length);
      if (rise <= 0) continue;
      final top = base - (base - head - 1) * rise;
      canvas.save();
      canvas.clipRect(Rect.fromLTRB(cx - 8, top - head - 2, cx + 8, base + 1));
      if (wrong) {
        canvas.drawRRect(
          RRect.fromRectAndRadius(Rect.fromLTWH(cx - 1.5, top, 3, base - top), const Radius.circular(1.5)),
          Paint()..color = colors.wrongMark,
        );
        canvas.drawCircle(Offset(cx, top), head, Paint()..color = colors.wrongMark);
      } else {
        // A blank is a stem with a gap in it, ending in an open bubble.
        final dash = Paint()..color = colors.ink2;
        for (var y = top + 5; y < base - 1; y += 5) {
          canvas.drawRect(Rect.fromLTWH(cx - 0.75, y, 1.5, 3), dash);
        }
        canvas.drawCircle(
          Offset(cx, top),
          head - 0.6,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.4
            ..color = colors.ink2,
        );
      }
      canvas.restore();
      final fade = RulerTimeline.chip(ms, i, marks.length);
      if (leaders != null && fade > 0) {
        // From the foot of the stem to the chip's number: one thin line that eases sideways.
        const end = _AnswerRuler._rulerHeight + 4;
        const mid = (_mapHeight + end) / 2;
        canvas.drawPath(
          Path()
            ..moveTo(cx, base + 1)
            ..cubicTo(cx, mid, leaders[i], mid, leaders[i], end),
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1
            ..color = ink.withValues(alpha: 0.55 * fade),
        );
      }
    }
  }

  @override
  bool shouldRepaint(_RulerPainter old) =>
      old.questions != questions ||
      old.colors != colors ||
      old.marks != marks ||
      old.chipCenters != chipCenters ||
      old.inset != inset ||
      old.draw != draw;
}

/// One question on the chapter's ruler: its number over its bubble, 72 dp tall and at least 48 dp
/// wide, opening that exact answer.
class _QuestionTile extends StatelessWidget {
  const _QuestionTile({required this.number, required this.state, required this.onTap, this.width = 52});

  final int number;
  final BubbleState state;
  final VoidCallback onTap;
  final double width;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final word = state == BubbleState.wrong ? ResultCopy.statusWrong.toLowerCase() : ResultCopy.statusBlank.toLowerCase();
    return MmPressable(
      onTap: onTap,
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.9,
      haptic: MmPressHaptic.light,
      semanticsLabel: ResultCopy.questionTile(number, word),
      builder: (context, pressed, _) => AnimatedContainer(
        duration: Motion.of(context, Motion.press),
        width: width,
        height: 72,
        decoration: BoxDecoration(
          color: pressed ? colors.raised2 : const Color(0x00000000),
          borderRadius: MmRadius.smallAll,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('$number', style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600, height: 1.1)),
            const SizedBox(height: 6),
            Bubble(state: state, size: 40, animate: false),
          ],
        ),
      ),
    );
  }
}

/// How much this chapter cost, against everything missed in the mock: the chapter's marks below
/// full (wrong x 6 + blank x 5, the rule "Why this?" explains) beside the mock's missed marks,
/// and a meter of the missed marks with this chapter's share lit. Both observed, never a forecast.
/// The figure is the card's hero.
class _Cost extends StatefulWidget {
  const _Cost({required this.stat, required this.missed, required this.max, required this.roll});

  final ChapterStat stat;
  final int missed;

  /// What the paper holds: a negative score makes [missed] exceed it, and the words then drop the denominator.
  final int max;

  /// The figure counts up (celebratory results only; a lower result is simply shown).
  final bool roll;

  @override
  State<_Cost> createState() => _CostState();
}

class _CostState extends State<_Cost> with SingleTickerProviderStateMixin {
  /// The block's own arrival on the card (its stagger turn plus most of its rise): the figure and
  /// the meter start together after it.
  static const Duration settle = Duration(milliseconds: 360);

  late final AnimationController _fill = AnimationController(vsync: this, duration: ResultMotion.meter);
  late final Animation<double> _curve = CurvedAnimation(parent: _fill, curve: Motion.emphasized);
  Timer? _wait;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _fill.value = 1;
    } else {
      _wait = Timer(settle, () {
        if (mounted) _fill.forward();
      });
    }
  }

  @override
  void dispose() {
    _wait?.cancel();
    _fill.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final cost = widget.stat.marksLost;
    final missed = widget.missed;
    final share = missed <= 0 ? 0.0 : (cost / missed).clamp(0.0, 1.0);
    final blanks = widget.stat.wrong == 0;
    return Semantics(
      container: true,
      label: ResultCopy.costLabel(cost, missed, max: widget.max),
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              // The figure rolls once its block has risen into place, landing with the meter.
              child: MonumentalNumber(
                value: '$cost',
                unit: ResultCopy.costUnit(missed, max: widget.max, cost: cost),
                style: type.figureHero,
                roll: widget.roll,
                delay: _CostState.settle,
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          RepaintBoundary(
            child: SizedBox(
              height: 10,
              width: double.infinity,
              child: CustomPaint(
                painter: _SharePainter(share: share, fill: _curve, colors: colors, blanks: blanks),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SharePainter extends CustomPainter {
  _SharePainter({required this.share, required this.fill, required this.colors, required this.blanks}) : super(repaint: fill);

  final double share;
  final Animation<double> fill;
  final MmColors colors;
  final bool blanks;

  @override
  void paint(Canvas canvas, Size size) {
    final r = Radius.circular(size.height / 2);
    final whole = RRect.fromRectAndRadius(Offset.zero & size, r);
    canvas.drawRRect(whole, Paint()..color = colors.sunken);
    canvas.drawRRect(
      whole.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = colors.line,
    );
    final w = size.width * share * fill.value;
    if (w <= 0.5) return;
    final rect = Rect.fromLTWH(0, 0, w, size.height);
    canvas.save();
    canvas.clipRRect(RRect.fromRectAndRadius(rect, r));
    if (blanks) {
      canvas.drawRect(rect, Paint()..color = colors.ink3.withValues(alpha: 0.35));
      final dot = Paint()..color = colors.ink2;
      for (var x = 4.0; x < w; x += 6) {
        canvas.drawCircle(Offset(x, size.height / 2), 1.2, dot);
      }
    } else {
      canvas.drawRect(
        rect,
        Paint()..shader = LinearGradient(colors: [Color.lerp(colors.wrongMark, Colors.black, 0.2)!, colors.wrongMark]).createShader(rect),
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SharePainter old) => old.share != share || old.fill != fill || old.colors != colors || old.blanks != blanks;
}

/// When each part of the ruler happens, in milliseconds from the moment it starts drawing: the
/// baseline runs left to right (baselineMs), then the stems rise in paper order, each starting
/// a little after the one before, and under each stem its chip drops in as the stem lands. Mobi's
/// point is timed to the last stem (pointAt). Pure, so the order can be tested.
abstract final class RulerTimeline {
  /// How long after the card arrives the ruler starts (the card's blocks have landed).
  static const int start = 420;
  static const int baselineMs = 480;
  static const int stemMs = 260;
  static const int chipMs = 260;
  static const int stemsFrom = 160;

  /// The gap between one stem's start and the next, so a few stems take about half a second and
  /// a dozen do not drag.
  static int step(int count) => count <= 1 ? 0 : (480 ~/ (count - 1)).clamp(28, 90);

  static int stemStart(int i, int count) => stemsFrom + i * step(count);
  static int stemEnd(int i, int count) => stemStart(i, count) + stemMs;

  /// The whole thing, in milliseconds.
  static int total(int count) {
    final last = count <= 0 ? 0 : stemEnd(count - 1, count) + chipMs ~/ 2 + chipMs;
    return last < baselineMs ? baselineMs : last;
  }

  /// Mobi has thought for this long when the last stem lands (from the card's arrival).
  static Duration pointAt(int count) => Duration(milliseconds: start + (count <= 0 ? baselineMs : stemEnd(count - 1, count)));

  /// How far the baseline has run, 0 to 1.
  static double baseline(double ms) => Motion.emphasized.transform((ms / baselineMs).clamp(0.0, 1.0));

  /// How far stem [i] has risen, 0 to 1.
  static double stem(double ms, int i, int count) => Motion.emphasized.transform(((ms - stemStart(i, count)) / stemMs).clamp(0.0, 1.0));

  /// How far chip [i] has dropped in, 0 to 1: it starts when its stem is halfway.
  static double chip(double ms, int i, int count) =>
      Motion.emphasized.transform(((ms - stemStart(i, count) - stemMs ~/ 2) / chipMs).clamp(0.0, 1.0));
}

/// A chip dropping in under its stem: fades in and falls 10 dp into place as the stem lands.
class _ChipDrop extends StatelessWidget {
  const _ChipDrop({required this.draw, required this.index, required this.count, required this.child});

  final Animation<double> draw;
  final int index;
  final int count;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: draw,
      child: child,
      builder: (context, child) {
        if (draw.value >= 1) return child!;
        final t = RulerTimeline.chip(draw.value * RulerTimeline.total(count), index, count);
        // Not yet in: it cannot be tapped before it is there.
        return IgnorePointer(
          ignoring: t < 0.6,
          child: Opacity(
            opacity: t,
            child: Transform.translate(offset: Offset(0, -10 * (1 - t)), child: child),
          ),
        );
      },
    );
  }
}
