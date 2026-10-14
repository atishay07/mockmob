import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/domain.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../model/recap_variant.dart';
import '../result_nav.dart';
import '../sheet/paper.dart';
import 'card_page.dart';

/// Card 3 (spec 5.6.3): one chapter to start with, from the observed chapter breakdown of this
/// mock (never from a forecast). Every claim carries its evidence: the counts, and the question
/// tiles that open those exact answers.
class FirstFixCard extends StatelessWidget {
  const FirstFixCard({super.key, required this.model, required this.onNext, required this.onBack});

  final RecapModel model;
  final VoidCallback onNext;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final m = model;
    final leader = m.chapters.leader;
    final lower = m.variant == RecapVariant.lower;
    final blanksOnly = m.chapters.leaderIsBlanksOnly;

    final String title;
    final List<Widget> evidence;
    final List<(int, BubbleState)> tiles;
    if (leader != null && blanksOnly) {
      title = ResultCopy.startWithBlanks(leader.chapter);
      evidence = [
        if (!m.isHeld) ...[_Cost(stat: leader, missed: m.breakdown.lost), const SizedBox(height: MmSpace.s16)],
        _Line(ResultCopy.blanksEvidence(leader.unattempted, leader.questions)),
      ];
      tiles = [for (final n in leader.blankNumbers) (n, BubbleState.blank)];
    } else if (leader != null) {
      title = ResultCopy.startWith(leader.chapter);
      evidence = [
        if (!m.isHeld) ...[_Cost(stat: leader, missed: m.breakdown.lost), const SizedBox(height: MmSpace.s16)],
        _Line(ResultCopy.costMost),
        const SizedBox(height: MmSpace.s12),
        _Counts(stat: leader),
        // The way into the reason sits with the claim it explains, flush with the text above.
        Align(
          alignment: Alignment.centerLeft,
          child: Transform.translate(
            offset: const Offset(-16, 0),
            child: KeyButton.quiet(label: ResultCopy.whyThis, onPressed: () => _why(context, leader)),
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

    return RecapCardPage(
      onNext: onNext,
      onBack: onBack,
      topPadding: lower ? MmSpace.s32 : MmSpace.s8,
      // One Mobi per recap, and it lives on card 4.
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
        if (tiles.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s4),
          Align(
            alignment: Alignment.centerLeft,
            child: ShowMePill(
              semanticsLabel: ResultCopy.showMeQuestions,
              marks: [for (final (_, s) in tiles.take(3)) s],
              onTap: () => ResultNav.toFullResult(context, m.attemptId, question: tiles.first.$1),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
        ] else
          const SizedBox(height: MmSpace.s16),
        ...evidence,
        if (tiles.isNotEmpty) ...[
          SizedBox(height: leader != null && !blanksOnly ? MmSpace.s8 : MmSpace.s24),
          Text(
            leader == null ? ResultCopy.yourWrongAnswers : ResultCopy.yourAnswersHere,
            style: context.mmType.label.copyWith(color: context.mmColors.ink2),
          ),
          const SizedBox(height: MmSpace.s8),
          // Six to a row across the full width, so no number is left alone on a row of its own
          // unless the count says so. Fewer when six would leave a tile under 48 dp wide (a
          // 360 dp phone), because the tile is the control that opens that exact answer.
          LayoutBuilder(
            builder: (context, constraints) {
              // The chapter's own strip of the answer sheet: its question numbers over their
              // bubbles, printed on the same charcoal paper as the sheet on card 1.
              final inner = constraints.maxWidth - 2 * _stripPad;
              final columns = firstFixTileColumns(inner);
              final width = (inner - (columns - 1) * _tileGap) / columns;
              return NightObject(
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    borderRadius: BorderRadius.all(Radius.circular(10)),
                    boxShadow: [BoxShadow(color: Color(0x4D000000), blurRadius: 22, offset: Offset(4, 10), spreadRadius: -8)],
                  ),
                  child: PaperFace(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(_stripPad, MmSpace.s16, _stripPad, _stripPad),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Where these answers sit on the whole paper, before the answers themselves.
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                            child: PaperMap(questions: m.cells.length, marks: tiles),
                          ),
                          const SizedBox(height: MmSpace.s8),
                          Wrap(
                            spacing: _tileGap,
                            runSpacing: MmSpace.s4,
                            children: [
                              for (final (n, s) in tiles)
                                _QuestionTile(
                                  number: n,
                                  state: s,
                                  width: width,
                                  onTap: () => ResultNav.toFullResult(context, m.attemptId, question: n),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ],
    );
  }

  void _why(BuildContext context, ChapterStat stat) {
    showMmSheet<void>(
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
/// (the book belongs to Today). The headline starts 24 dp under the story bar.
class _Header extends StatelessWidget {
  const _Header({required this.subjectId});

  final String subjectId;

  @override
  Widget build(BuildContext context) {
    final light = SubjectLight.forSubject(subjectId == 'gat' ? 'general_test' : subjectId);
    return SizedBox(
      height: MmSpace.s24,
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

/// Wrong and not attempted always shown apart, each with its own bubble.
class _Counts extends StatelessWidget {
  const _Counts({required this.stat});

  final ChapterStat stat;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    Widget cell(BubbleState? s, int n, String label) => Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (s != null) ...[Bubble(state: s, size: 12, animate: false), const SizedBox(width: 6)],
              Text('$n', style: type.figureCompact.copyWith(fontSize: 34, height: 1)),
            ],
          ),
          const SizedBox(height: 2),
          Text(label, style: type.caption.copyWith(color: colors.ink3)),
        ],
      ),
    );
    return Semantics(
      label: ResultCopy.chapterCounts(stat.questions, stat.correct, stat.wrong, stat.unattempted),
      excludeSemantics: true,
      child: Row(
        children: [
          cell(null, stat.questions, 'questions'),
          cell(BubbleState.filled, stat.correct, 'correct'),
          cell(BubbleState.wrong, stat.wrong, 'wrong'),
          cell(BubbleState.blank, stat.unattempted, 'not attempted'),
        ],
      ),
    );
  }
}

/// How many question tiles fit on a row of [maxWidth]: six when each is at least 48 dp wide
/// (the touch target minimum), otherwise as many as keep that width, never fewer than one.
int firstFixTileColumns(double maxWidth) {
  for (var n = 6; n > 1; n--) {
    if ((maxWidth - (n - 1) * _tileGap) / n >= 48) return n;
  }
  return 1;
}

const double _stripPad = 8;
const double _tileGap = 4;

/// The whole paper as one line of ticks, question 1 at the left and the last at the right, with
/// the chapter's answers to look at raised and inked (wrong in coral, blank as an open dash), so
/// the student sees whether they cluster or are spread through the paper. Observed positions only.
class PaperMap extends StatelessWidget {
  const PaperMap({super.key, required this.questions, required this.marks});

  final int questions;
  final List<(int, BubbleState)> marks;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final scale = type.caption.copyWith(color: colors.ink3, fontSize: 11, height: 1.2);
    return ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          RepaintBoundary(
            child: SizedBox(
              height: 22,
              child: CustomPaint(painter: _PaperMapPainter(questions: questions, marks: marks, colors: colors)),
            ),
          ),
          const SizedBox(height: MmSpace.s4),
          Row(
            children: [
              Text('1', style: scale),
              const Spacer(),
              Text('$questions', style: scale),
            ],
          ),
        ],
      ),
    );
  }
}

class _PaperMapPainter extends CustomPainter {
  _PaperMapPainter({required this.questions, required this.marks, required this.colors});

  final int questions;
  final List<(int, BubbleState)> marks;
  final MmColors colors;

  @override
  void paint(Canvas canvas, Size size) {
    if (questions <= 0) return;
    final base = size.height - 1;
    final step = questions == 1 ? 0.0 : size.width / (questions - 1);
    double x(int n) => questions == 1 ? size.width / 2 : (n - 1) * step;
    canvas.drawRect(Rect.fromLTWH(0, base - 0.5, size.width, 1), Paint()..color = colors.line);
    final tick = Paint()..color = colors.ink4;
    for (var n = 1; n <= questions; n++) {
      canvas.drawRect(Rect.fromLTWH(x(n) - 0.5, base - 5, 1, 5), tick);
    }
    for (final (n, s) in marks) {
      if (n < 1 || n > questions) continue;
      final cx = x(n);
      final r = Rect.fromLTWH(cx - 1.5, 2, 3, base - 2);
      if (s == BubbleState.wrong) {
        canvas.drawRRect(RRect.fromRectAndRadius(r, const Radius.circular(1.5)), Paint()..color = colors.wrongMark);
        canvas.drawCircle(Offset(cx, 3), 3, Paint()..color = colors.wrongMark);
      } else {
        final dash = Paint()..color = colors.ink2;
        for (var y = 2.0; y < base - 1; y += 4) {
          canvas.drawRect(Rect.fromLTWH(cx - 0.75, y, 1.5, 2), dash);
        }
        canvas.drawCircle(
          Offset(cx, 3),
          2.6,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.2
            ..color = colors.ink2,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_PaperMapPainter old) => old.questions != questions || old.colors != colors || old.marks != marks;
}

/// One question on the chapter strip: its number over its bubble, 72 dp tall and at least 48 dp
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
            Text('$number', style: type.caption.copyWith(color: colors.ink3, fontWeight: FontWeight.w600, height: 1.1)),
            const SizedBox(height: 5),
            Bubble(state: state, size: 32, animate: false),
          ],
        ),
      ),
    );
  }
}

/// How much this chapter cost, against everything missed in the mock: the chapter's marks below
/// full (wrong x 6 + blank x 5, the rule "Why this?" explains) beside the mock's missed marks,
/// and a meter of the missed marks with this chapter's share lit. Both observed, never a forecast.
class _Cost extends StatefulWidget {
  const _Cost({required this.stat, required this.missed});

  final ChapterStat stat;
  final int missed;

  @override
  State<_Cost> createState() => _CostState();
}

class _CostState extends State<_Cost> with SingleTickerProviderStateMixin {
  late final AnimationController _fill = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
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
      _wait = Timer(const Duration(milliseconds: 260), () {
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
      label: ResultCopy.costLabel(cost, missed),
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: MonumentalNumber(value: '$cost', unit: ResultCopy.costUnit(missed), style: type.figure, roll: false),
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          RepaintBoundary(
            child: SizedBox(
              height: 8,
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
      for (var x = 3.0; x < w; x += 5) {
        canvas.drawCircle(Offset(x, size.height / 2), 1, dot);
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
