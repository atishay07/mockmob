import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'copy.dart';
import 'model/paper_reel_model.dart';

export 'model/paper_reel_model.dart';
export 'widgets/reel_entries.dart';

/// "Play your paper back" (owner item D29, the same engine as the meaningful replay of D17).
///
/// The student's own answer sheet plays question by question: each bubble lights right or wrong as
/// it is reached, the score counts up with it, and the reel holds on the real moments the server
/// recorded (a right answer changed to wrong, a long stall). It then lands on the chapter where the
/// most marks went and ends on one next move. About 20 seconds.
///
/// - **Skip** is one tap and jumps to the end state.
/// - **Reduced motion** shows the end state at once.
/// - Night stays subtle: tinted fills and hairline rings, no glow.
class PaperReel extends StatefulWidget {
  const PaperReel({super.key, required this.model, required this.onNextMove, required this.onClose, this.autoplay = true});

  final PaperReelModel model;

  /// The one closing key: repair the costliest chapter, go through the misses, or the next mock.
  final ValueChanged<ReelNextMove> onNextMove;

  /// Skip at the end ("Done"), or the system back.
  final VoidCallback onClose;

  /// Starts playing on open (false holds the first frame; tests seek by hand).
  final bool autoplay;

  /// Opens the reel full screen over the current route.
  static Future<void> open(BuildContext context, {required PaperReelModel model, required ValueChanged<ReelNextMove> onNextMove}) {
    return Navigator.of(context).push(PageRouteBuilder<void>(
      opaque: true,
      transitionDuration: const Duration(milliseconds: 280),
      reverseTransitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (context, _, _) => Scaffold(
        backgroundColor: context.mmColors.ground,
        body: SafeArea(
          child: PaperReel(
            model: model,
            onClose: () => Navigator.of(context).maybePop(),
            onNextMove: (m) {
              Navigator.of(context).maybePop();
              onNextMove(m);
            },
          ),
        ),
      ),
      transitionsBuilder: (context, a, _, child) => FadeTransition(opacity: CurvedAnimation(parent: a, curve: Curves.easeOut), child: child),
    ));
  }

  @override
  State<PaperReel> createState() => PaperReelState();
}

class PaperReelState extends State<PaperReel> with SingleTickerProviderStateMixin {
  late final AnimationController _clock;
  bool _started = false;

  PaperReelModel get _m => widget.model;

  @override
  void initState() {
    super.initState();
    _clock = AnimationController(vsync: this, duration: Duration(milliseconds: _m.totalMs));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (MediaQuery.disableAnimationsOf(context)) {
      _clock.value = 1;
    } else if (widget.autoplay) {
      _clock.forward();
    }
  }

  @override
  void dispose() {
    _clock.dispose();
    super.dispose();
  }

  /// Shows the reel [ms] milliseconds in (goldens and tests).
  @visibleForTesting
  void seekMs(int ms) {
    _clock.stop();
    _clock.value = (ms / _m.totalMs).clamp(0.0, 1.0);
  }

  void _skip() {
    if (_clock.value >= 1) {
      widget.onClose();
      return;
    }
    _clock.stop();
    _clock.value = 1;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _clock,
      builder: (context, _) {
        final frame = _m.frameAt(_clock.value * _m.totalMs);
        return _ReelBody(model: _m, frame: frame, onSkip: _skip, onNextMove: widget.onNextMove);
      },
    );
  }
}

class _ReelBody extends StatelessWidget {
  const _ReelBody({required this.model, required this.frame, required this.onSkip, required this.onNextMove});

  final PaperReelModel model;
  final ReelFrame frame;
  final VoidCallback onSkip;
  final ValueChanged<ReelNextMove> onNextMove;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chapterIn = switch (frame.phase) {
      ReelPhase.chapter => Curves.easeOutCubic.transform((frame.phaseT * 2.2).clamp(0.0, 1.0)),
      ReelPhase.end => 1.0,
      _ => 0.0,
    };
    final endIn = frame.isEnd ? Curves.easeOutCubic.transform((frame.phaseT * 2.5).clamp(0.0, 1.0)) : 0.0;
    final introIn = frame.phase == ReelPhase.intro ? Curves.easeOut.transform(frame.phaseT) : 1.0;

    return Semantics(
      container: true,
      label: frame.isEnd ? ReelCopy.semantics(model.finalMarks, model.maxMarks, model.chapter?.name) : null,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: Text(ReelCopy.kicker, style: type.label.copyWith(color: colors.ink3))),
                KeyButton.quiet(
                  key: const ValueKey('reel-skip'),
                  label: frame.isEnd ? ReelCopy.done : ReelCopy.skip,
                  onPressed: onSkip,
                ),
              ],
            ),
            const SizedBox(height: MmSpace.s12),
            Opacity(
              opacity: introIn,
              child: _Score(marks: frame.marks, max: model.maxMarks),
            ),
            const SizedBox(height: MmSpace.s20),
            _Sheet(model: model, frame: frame),
            const SizedBox(height: MmSpace.s16),
            _Ticker(model: model, frame: frame),
            const SizedBox(height: MmSpace.s16),
            Opacity(
              opacity: chapterIn,
              child: Transform.translate(offset: Offset(0, 12 * (1 - chapterIn)), child: _ChapterCard(model: model)),
            ),
            const SizedBox(height: MmSpace.s16),
            IgnorePointer(
              ignoring: endIn < 0.5,
              child: Opacity(
                opacity: endIn,
                child: KeyButton(
                  key: const ValueKey('reel-next-move'),
                  label: model.nextMove.label,
                  onPressed: () => onNextMove(model.nextMove),
                ),
              ),
            ),
            const Spacer(),
          ],
        ),
      ),
    );
  }
}

class _Score extends StatelessWidget {
  const _Score({required this.marks, required this.max});

  final int marks;
  final int max;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text('$marks', key: const ValueKey('reel-marks'), style: type.figure.copyWith(color: colors.ink)),
        const SizedBox(width: MmSpace.s8),
        Text('${ReelCopy.outOf(max)} ${ReelCopy.marks}', style: type.body.copyWith(color: colors.ink3)),
      ],
    );
  }
}

/// The answer sheet: one bubble per question, ten to a row.
class _Sheet extends StatelessWidget {
  const _Sheet({required this.model, required this.frame});

  final PaperReelModel model;
  final ReelFrame frame;

  @override
  Widget build(BuildContext context) {
    final n = model.questions.length;
    final perRow = n < 10 ? n : 10;
    return LayoutBuilder(builder: (context, box) {
      final cell = box.maxWidth / perRow;
      final d = (cell - 8).clamp(16.0, 30.0);
      final rows = (n / perRow).ceil();
      return SizedBox(
        height: rows * cell,
        child: Stack(
          children: [
            for (var i = 0; i < n; i++)
              Positioned(
                left: (i % perRow) * cell,
                top: (i ~/ perRow) * cell,
                width: cell,
                height: cell,
                child: Center(child: _Bubble(q: model.questions[i], d: d, state: _stateOf(i))),
              ),
          ],
        ),
      );
    });
  }

  ({bool lit, double ink, bool focus, bool moment}) _stateOf(int i) {
    final lit = i < frame.revealed;
    final current = frame.current == i;
    final ink = !lit
        ? 0.0
        : current && frame.phase == ReelPhase.sheet
            ? Curves.easeOut.transform((frame.phaseT * 2.5).clamp(0.0, 1.0))
            : 1.0;
    return (lit: lit, ink: ink, focus: current, moment: frame.moment?.index == i);
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.q, required this.d, required this.state});

  final ReelQuestion q;
  final double d;
  final ({bool lit, double ink, bool focus, bool moment}) state;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final night = colors.isNight;
    final tone = switch (q.result) {
      ReelResult.right => colors.goodText,
      ReelResult.wrong => colors.wrongMark,
      ReelResult.blank => colors.ink3,
      ReelResult.held => colors.lamp,
    };
    final t = state.ink;
    final fillAlpha = q.result == ReelResult.blank ? 0.0 : (night ? 0.20 : 0.16);
    final fill = Color.lerp(Colors.transparent, tone.withValues(alpha: fillAlpha), t)!;
    final border = Color.lerp(colors.line, tone.withValues(alpha: night ? 0.7 : 0.85), t)!;
    final numColor = Color.lerp(colors.ink4, q.result == ReelResult.wrong ? colors.wrongText : tone, t)!;
    final scale = state.moment ? 1.18 : (state.focus ? 1.08 : 1.0);
    return Transform.scale(
      scale: scale,
      child: Container(
        width: d,
        height: d,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: fill,
          border: Border.all(color: border, width: state.moment ? 1.6 : 1.1),
        ),
        foregroundDecoration: state.moment
            ? BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.ink.withValues(alpha: 0.55), width: 1), )
            : null,
        alignment: Alignment.center,
        child: Text(
          '${q.number}',
          style: context.mmType.small.copyWith(fontSize: d < 24 ? 9 : 11, height: 1, color: numColor, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

/// Under the sheet: the question in focus, or the moment held on, or the tally at rest.
class _Ticker extends StatelessWidget {
  const _Ticker({required this.model, required this.frame});

  final PaperReelModel model;
  final ReelFrame frame;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    Widget child;
    final moment = frame.moment;
    if (moment != null) {
      final tone = moment.kind == ReelMomentKind.stall ? colors.lamp : colors.wrongMark;
      child = Row(
        key: ValueKey('moment-${moment.index}'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(width: 3, height: 40, margin: const EdgeInsets.only(right: MmSpace.s12, top: 2), decoration: BoxDecoration(color: tone, borderRadius: MmRadius.smallAll)),
          Expanded(child: Text(moment.line, style: type.subhead.copyWith(color: colors.ink), maxLines: 2)),
        ],
      );
    } else if (frame.current != null) {
      final q = model.questions[frame.current!];
      child = Row(
        key: const ValueKey('ticker'),
        children: [
          Expanded(child: Text(ReelCopy.ticker(q.number, q.chapter), style: type.body.copyWith(color: colors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis)),
          if (q.timeSec != null) Text(ReelCopy.duration(q.timeSec!), style: type.label.copyWith(color: colors.ink3)),
        ],
      );
    } else if (frame.phase == ReelPhase.intro) {
      child = const SizedBox.shrink(key: ValueKey('intro'));
    } else {
      child = Text(
        ReelCopy.tally(model.right, model.wrong, model.blank),
        key: const ValueKey('tally'),
        style: type.body.copyWith(color: colors.ink2),
      );
    }
    return Semantics(
      liveRegion: moment != null,
      child: SizedBox(
        height: 52,
        child: Align(
          alignment: Alignment.centerLeft,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: child,
          ),
        ),
      ),
    );
  }
}

class _ChapterCard extends StatelessWidget {
  const _ChapterCard({required this.model});

  final PaperReelModel model;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = model.chapter;
    return Container(
      padding: const EdgeInsets.all(MmSpace.s16),
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: MmRadius.panelAll,
        border: Border.all(color: colors.line),
      ),
      child: c == null
          ? Text(ReelCopy.noChapter, style: type.subhead.copyWith(color: colors.ink))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ReelCopy.chapterKicker, style: type.label.copyWith(color: colors.ink3)),
                const SizedBox(height: MmSpace.s4),
                Text(c.name, style: type.title.copyWith(color: colors.ink), maxLines: 2, overflow: TextOverflow.ellipsis),
                const SizedBox(height: MmSpace.s8),
                Text(ReelCopy.chapterLine(c.lost, c.max, c.wrong, c.blank), style: type.body.copyWith(color: colors.ink2)),
              ],
            ),
    );
  }
}
