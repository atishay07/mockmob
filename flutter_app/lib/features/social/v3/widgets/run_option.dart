// One answer option of the run (spec 5.3 R1 to R3, 5.6 M4, M5, M5b). It looks like today's runner
// option (features/runner/widgets/answer_option.dart: a raised card at the key radius, a hairline
// edge, at least 56 dp, a lettered bubble on the left and the text beside it, the 16 dp gaps), but
// it is a separate widget: the runner's option has no lock-in, right or "not this one" states, and
// this run must never import the runner's logic (spec 5.8).
//
// Everything is drawn from the parameters (no controllers in here), so the screen's timelines
// and the frame goldens drive it exactly:
// - [press] 0 to 1: the 100 ms press to 0.96 on a pick;
// - [lock] 0 to 1 over 160 ms: the paper clip drops 8 dp onto the corner (snappy 140) and, when
//   [dimmed], the option fades to 60%;
// - [fbMs]: ms since the server answered: the right tint (200), the tick (from 120, drawIn 450) and
//   "+5" floating 12 dp (from 160, 700); or the wrong surface and border (200) with "-1" in ink2.
// A "not this one" never marks any other option (F1): only your own pick changes.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../copy_v3.dart';
import 'run_paper.dart';

enum RunOptionLook { idle, picked, locked, right, wrong }

class RunOption extends StatelessWidget {
  /// The tick's pen stroke over drawIn (450 ms): a gentle sine in-out, so it draws visibly the whole way.
  static const Curve tickCurve = Curves.easeInOutSine;

  const RunOption({
    super.key,
    required this.letter,
    required this.text,
    this.look = RunOptionLook.idle,
    this.dimmed = false,
    this.press = 0,
    this.lock = 0,
    this.fbMs = 0,
    this.reduced = false,
    this.delta,
    this.onTap,
  });

  final String letter;
  final String text;
  final RunOptionLook look;
  final bool dimmed;
  final double press;
  final double lock;
  final double fbMs;
  final bool reduced;

  /// The server's mark change for this answer (`AnswerResult.delta`), shown as "+5" or "-1".
  final int? delta;
  final VoidCallback? onTap;

  static const double minHeight = 56;
  static const double gap = 8;

  bool get _sunk => look != RunOptionLook.idle;
  bool get _clipped => look == RunOptionLook.locked || look == RunOptionLook.right || look == RunOptionLook.wrong;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final paper = RunPaper.of(context);

    // Feedback colours (200 ms; 120 in reduced motion).
    final tintLen = reduced ? 120.0 : 200.0;
    final fb = (look == RunOptionLook.right || look == RunOptionLook.wrong) ? (fbMs / tintLen).clamp(0.0, 1.0) : 0.0;
    final goodFace = Color.alphaBlend(colors.goodText.withValues(alpha: colors.isNight ? 0.13 : 0.12), colors.raised);
    final goodEdge = colors.goodText.withValues(alpha: 0.75);

    var face = colors.raised;
    var edge = colors.line;
    var edgeW = 1.0;
    var bubbleFill = Colors.transparent;
    var bubbleRing = colors.lineStrong;
    var letterInk = colors.ink2;
    switch (look) {
      case RunOptionLook.idle:
        break;
      case RunOptionLook.picked:
      case RunOptionLook.locked:
        edge = colors.ink;
        edgeW = 1.5;
        bubbleFill = colors.ink;
        bubbleRing = colors.ink;
        letterInk = colors.ground;
      case RunOptionLook.right:
        face = Color.lerp(colors.raised, goodFace, fb)!;
        edge = Color.lerp(colors.ink, goodEdge, fb)!;
        edgeW = 1.5;
        bubbleFill = Color.lerp(colors.ink, colors.goodText, fb)!;
        bubbleRing = bubbleFill;
        letterInk = colors.ground;
      case RunOptionLook.wrong:
        // Calm, never a red mark (walk M10): in Day the wrong surface is a light wash over the paper
        // and the border a muted line; Night keeps its deep surface.
        final night = colors.isNight;
        final wrongFace = night ? colors.wrongSurface : Color.alphaBlend(colors.wrongSurface.withValues(alpha: 0.45), colors.raised);
        final wrongEdge = night ? colors.wrongBorder : colors.wrongBorder.withValues(alpha: 0.55);
        face = Color.lerp(colors.raised, wrongFace, fb)!;
        edge = Color.lerp(colors.ink, wrongEdge, fb)!;
        edgeW = 1.5;
        bubbleFill = Color.lerp(colors.ink, night ? colors.wrongBorder : colors.wrongBorder.withValues(alpha: 0.8), fb)!;
        bubbleRing = bubbleFill;
        letterInk = Color.lerp(colors.ground, colors.isNight ? colors.wrongText : colors.raised, fb)!;
    }

    final scaler = MediaQuery.textScalerOf(context);
    final bubble = math.max(32.0, scaler.scale(14) + 12);

    // The trailing mark: the tick and "+5", or "-1".
    Widget? trailing;
    if (look == RunOptionLook.right) {
      final tickStart = reduced ? 0.0 : 120.0;
      final tickLen = reduced ? 120.0 : Motion.drawIn.inMilliseconds.toDouble();
      final tick = ((fbMs - tickStart) / tickLen).clamp(0.0, 1.0);
      // A steady pen stroke over the whole 450 ms (walk M5: a steep in-out read as a 150 ms flick).
      final drawn = reduced ? tick : RunOption.tickCurve.transform(tick);
      final floatT = ((fbMs - 160) / 700).clamp(0.0, 1.0);
      trailing = SizedBox(
        width: 28,
        height: 24,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(child: CustomPaint(painter: DrawnTickPainter(progress: AlwaysStoppedAnimation(drawn), colour: colors.goodText))),
            if (!reduced && delta != null && floatT > 0 && floatT < 1)
              Positioned(
                right: 30,
                top: 2 - 12 * Motion.out.transform(floatT),
                child: Opacity(
                  opacity: (1 - floatT).clamp(0.0, 1.0),
                  child: Text(MobV3Copy.delta(delta!), style: type.labelLarge.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
                ),
              ),
          ],
        ),
      );
    } else if (look == RunOptionLook.wrong && delta != null) {
      trailing = Opacity(
        opacity: fb,
        child: Text(MobV3Copy.delta(delta!), style: type.labelLarge.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
      );
    }

    final sink = _sunk ? 2.0 : 0.0;
    final shape = RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll);
    final card = Padding(
      // The face sits 2 dp above its lip; a pick sinks it onto the lip.
      padding: EdgeInsets.only(top: sink, bottom: 2 - sink),
      child: DecoratedBox(
        position: DecorationPosition.foreground,
        decoration: ShapeDecoration(shape: RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: edge, width: edgeW))),
        child: ClipPath(
          clipper: ShapeBorderClipper(shape: shape),
          child: ColoredBox(
            color: face,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: minHeight),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s16, MmSpace.s12),
                child: Row(
                  children: [
                    SizedBox.square(
                      dimension: bubble,
                      child: DecoratedBox(
                        decoration: ShapeDecoration(color: bubbleFill, shape: CircleBorder(side: BorderSide(color: bubbleRing, width: 2))),
                        child: Center(
                          child: Text(letter, style: type.label.copyWith(fontSize: 14, height: 1, fontWeight: FontWeight.w700, color: letterInk)),
                        ),
                      ),
                    ),
                    const SizedBox(width: MmSpace.s16),
                    Expanded(
                      child: Text(text, style: type.body.copyWith(color: colors.ink, fontWeight: look == RunOptionLook.idle ? FontWeight.w500 : FontWeight.w600)),
                    ),
                    if (trailing != null) ...[const SizedBox(width: MmSpace.s8), trailing],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );

    // The lip under the face (the runner's key depth, in the option lip token).
    final lipped = Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          top: 2,
          child: DecoratedBox(decoration: ShapeDecoration(color: colors.optionLip, shape: shape)),
        ),
        card,
      ],
    );

    // Lock-in: the clip drops 8 dp onto the top right corner on snappy (140 of the 160).
    final clipP = _clipped ? (reduced ? (lock > 0 ? 1.0 : 0.0) : Motion.out.transform((lock * 160 / 140).clamp(0.0, 1.0))) : 0.0;
    final dim = dimmed ? 1 - 0.4 * (reduced ? (lock > 0 ? 1.0 : 0.0) : lock.clamp(0.0, 1.0)) : 1.0;

    Widget out = Stack(
      clipBehavior: Clip.none,
      children: [
        lipped,
        if (clipP > 0)
          Positioned(
            right: 18,
            top: -10 - 8 * (1 - clipP),
            width: 14,
            height: 30,
            child: Opacity(
              opacity: clipP.clamp(0.0, 1.0),
              child: CustomPaint(painter: PaperClipPainter(steel: paper.clip, shine: paper.clipShine)),
            ),
          ),
      ],
    );
    out = Transform.scale(scale: 1 - 0.04 * press.clamp(0.0, 1.0), child: out);
    if (dim < 1) out = Opacity(opacity: dim, child: out);

    final state = switch (look) {
      RunOptionLook.picked => MobV3Copy.optionPicked,
      RunOptionLook.locked => MobV3Copy.optionLocked,
      RunOptionLook.right => MobV3Copy.optionRight,
      RunOptionLook.wrong => MobV3Copy.optionWrong,
      RunOptionLook.idle => null,
    };
    return Semantics(
      container: true,
      button: onTap != null,
      inMutuallyExclusiveGroup: true,
      selected: look != RunOptionLook.idle,
      enabled: onTap != null,
      label: state == null ? MobV3Copy.optionLabel(letter, text) : '${MobV3Copy.optionLabel(letter, text)}, $state',
      onTap: onTap,
      excludeSemantics: true,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: out),
    );
  }
}
