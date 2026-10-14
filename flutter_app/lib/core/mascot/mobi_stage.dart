import 'package:flutter/material.dart';

import '../theme/theme.dart';
import 'mobi_acts.dart';
import 'mobi_bubble.dart';
import 'mobi_character.dart';
import 'mobi_controller.dart';
import 'mobi_figure.dart';
import 'mobi_palette.dart';
import 'mobi_tap_cycle.dart';

/// Mobi for the welcome and the big moments: the character on a soft pool of lamp light, with
/// its speech bubble above. Pass [say] for a line said on arrival, or drive it with [controller]
/// (`say`, `play`, `lookAt`, `pointAt`). A tap makes Mobi react.
class MobiStage extends StatefulWidget {
  const MobiStage({
    super.key,
    this.controller,
    this.size = 160,
    this.entrance = MobiAct.hello,
    this.say,
    this.sayLive = false,
    this.lamp = true,
    this.interactive = true,
    this.bubbleWidth = 260,
    this.semanticLabel,
    this.seed = 7,
    this.bubble = true,
    this.tapCycle,
    this.followPointer = false,
  });

  /// What repeated taps play (see [MobiCharacter.tapCycle]).
  final MobiTapCycle? tapCycle;

  /// The eyes follow the finger or pointer (see [MobiCharacter.followPointer]).
  final bool followPointer;

  final MobiController? controller;

  /// Mobi's height in dp.
  final double size;
  final MobiAct entrance;

  /// A line Mobi says when it appears (and again whenever it changes).
  final String? say;
  final bool sayLive;

  /// The pool of lamp light under Mobi.
  final bool lamp;
  final bool interactive;
  final double bubbleWidth;
  final String? semanticLabel;
  final int seed;

  /// Draw the speech bubble above Mobi. Off when the screen places the line itself (the welcome
  /// sets it beside the painted room's sheet); Mobi still talks while the line is up.
  final bool bubble;

  @override
  State<MobiStage> createState() => _MobiStageState();
}

class _MobiStageState extends State<MobiStage> {
  MobiController? _own;
  MobiController get _controller => widget.controller ?? (_own ??= MobiController());

  @override
  void initState() {
    super.initState();
    final line = widget.say;
    if (line != null) _controller.say(line, live: widget.sayLive);
  }

  @override
  void didUpdateWidget(MobiStage old) {
    super.didUpdateWidget(old);
    final line = widget.say;
    if (line != null && line != old.say) _controller.say(line, live: widget.sayLive);
  }

  @override
  void dispose() {
    _own?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final night = context.mmColors.isNight;
    final palette = MobiPalette.of(night: night);
    final width = MobiFigure.widthFor(widget.size);
    final character = MobiCharacter(
      controller: _controller,
      size: widget.size,
      entrance: widget.entrance,
      semanticLabel: widget.semanticLabel,
      interactive: widget.interactive,
      seed: widget.seed,
      tapCycle: widget.tapCycle,
      followPointer: widget.followPointer,
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.bubble)
          ValueListenableBuilder<MobiSpeech?>(
            valueListenable: _controller.speech,
            builder: (context, speech, _) => speech == null
              ? const SizedBox.shrink()
              : Padding(
                  padding: const EdgeInsets.only(bottom: MmSpace.s4),
                  child: MobiBubble(key: ValueKey(speech.id), speech: speech, maxWidth: widget.bubbleWidth),
                ),
        ),
        SizedBox(
          width: width * 1.5,
          height: widget.size,
          child: Stack(
            alignment: Alignment.bottomCenter,
            clipBehavior: Clip.none,
            children: [
              if (widget.lamp)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: -widget.size * 0.06,
                  height: widget.size * 0.26,
                  child: IgnorePointer(child: CustomPaint(painter: _PoolPainter(palette.pool, alpha: palette.poolAlpha))),
                ),
              character,
            ],
          ),
        ),
      ],
    );
  }
}

/// A soft ellipse of warm lamp light on the floor.
class _PoolPainter extends CustomPainter {
  const _PoolPainter(this.color, {required this.alpha});

  final Color color;
  final double alpha;

  @override
  void paint(Canvas canvas, Size size) {
    final a = alpha;
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(1, size.height / size.width);
    final r = size.width / 2;
    canvas.drawCircle(
      Offset.zero,
      r,
      Paint()
        ..shader = RadialGradient(colors: [
          color.withValues(alpha: a),
          color.withValues(alpha: a * 0.35),
          color.withValues(alpha: 0),
        ], stops: const [0, 0.5, 1])
            .createShader(Rect.fromCircle(center: Offset.zero, radius: r)),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_PoolPainter old) => old.color != color || old.alpha != alpha;
}
