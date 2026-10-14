import 'package:flutter/material.dart';

import '../mascot/mascot.dart';
import '../theme/theme.dart';
import 'art/mm_art.dart';
import 'materials/fake_glass.dart';

export '../mascot/mascot.dart';

/// Mobi's poses. Each maps to an act of the living character ([act]); the seven warm renders in
/// `assets/art/` remain as the raster fallback ([Mobi.rasterFallback]), each falling back in turn
/// to the original flat artwork in `assets/mobi/`.
///
/// The older pose names are kept so existing screens compile; they map onto the new renders.
/// New poses go at the end so each existing pose keeps its idle seed.
/// Mobi never shows a sad pose and is never in the runner or on a sealed sheet.
enum MobiPose {
  greet(MmArt.mobiGreet, 'greeting'),
  point(MmArt.mobiPoint, 'pointing'),
  think(MmArt.mobiThink, 'thinking'),
  cheer(MmArt.mobiCheer, 'celebrating'),
  rest(MmArt.mobiRest, 'idle'),
  sleepy(MmArt.mobiSleepy, 'idle'),
  read(MmArt.mobiRead, 'attentive'),
  attentive(MmArt.mobiGreet, 'attentive'),
  celebrating(MmArt.mobiCheer, 'celebrating'),
  encouraging(MmArt.mobiPoint, 'encouraging'),
  greeting(MmArt.mobiGreet, 'greeting'),
  idle(MmArt.mobiGreet, 'idle'),
  pointing(MmArt.mobiPoint, 'pointing'),
  thinking(MmArt.mobiThink, 'thinking'),

  /// A server-acknowledged milestone: stretches tall, mittens on hips, chin up.
  proud(MmArt.mobiCheer, 'celebrating'),

  /// After a wrong answer or a lower result: a small nod forward, never sad.
  encourage(MmArt.mobiPoint, 'encouraging'),

  /// While the student types to Mobi: leans in with the antenna up.
  listen(MmArt.mobiRead, 'attentive'),

  /// Waiting on the server or the AI: the loading loop (think stays for a setback).
  loading(MmArt.mobiThink, 'thinking');

  const MobiPose(this.art, this._legacy);

  /// The warm render.
  final MmArt art;
  final String _legacy;

  /// The render's asset path.
  String get asset => art.asset;

  /// The original flat artwork, used when the render is missing.
  String get legacyAsset => 'assets/mobi/$_legacy.webp';

  /// What the living Mobi does for this pose when it appears.
  MobiAct get act => switch (this) {
        greet || greeting => MobiAct.hello,
        point || pointing || encouraging => MobiAct.point,
        think || thinking => MobiAct.think,
        cheer || celebrating => MobiAct.cheer,
        rest => MobiAct.rest,
        sleepy => MobiAct.sleepy,
        read => MobiAct.read,
        attentive || idle => MobiAct.appear,
        proud => MobiAct.proud,
        encourage => MobiAct.encourage,
        listen => MobiAct.listen,
        loading => MobiAct.loading,
      };
}

/// The entrance motion older call sites ask for. The living Mobi plays its pose's own act; this
/// only picks the rise-in for poses without one (see [Mobi.motion]).
enum MobiMotion {
  /// Static pose.
  none,

  /// 420 ms settle: rises 6 dp into place and grows from 0.96 to 1.
  settle,

  /// 400 ms hop.
  hop,

  /// 420 ms lean of 5 degrees toward what Mobi points at (to the right), then holds.
  tilt,
}

/// Mobi, the companion at the human moments: welcome, onboarding guide moments, empty states,
/// return after a gap, late night, celebrations. It may [say] one short line in a speech
/// bubble, never evaluative of the person.
///
/// Mobi is a living vector character ([MobiCharacter]): it plays its [pose]'s act when it appears
/// (a wave for greet, a hop for cheer, sitting down for rest...), then breathes, blinks and sways
/// its antenna. Pass a [controller] to make it act, talk, look or point later. Under reduced
/// motion it holds the pose still. The old raster poses remain behind [rasterFallback].
class Mobi extends StatefulWidget {
  const Mobi({
    super.key,
    this.pose = MobiPose.greet,
    this.size = 96,
    this.motion = MobiMotion.none,
    this.semanticLabel,
    this.say,
    this.sayLive = false,
    this.controller,
    this.interactive = false,
    this.entrance,
  });

  final MobiPose pose;

  /// Height in dp.
  final double size;

  /// Kept for older call sites. [MobiMotion.none] skips the plain rise-in for poses without an
  /// act of their own; every pose still plays its own act when it appears.
  final MobiMotion motion;

  /// Mobi is decoration and is excluded from semantics unless a label is given.
  final String? semanticLabel;

  /// One short line in a speech bubble beside Mobi, typed in while Mobi talks.
  final String? say;

  /// Announce [say] when it changes (a line that answers the student's own choice).
  final bool sayLive;

  /// Drives Mobi after it appears.
  final MobiController? controller;

  /// A tap makes Mobi react.
  final bool interactive;

  /// The act played on appearing, in place of the [pose]'s own. For the time of day pass
  /// `MobiMoments.entranceAt(now)` with the injected clock: sleepy from 11 PM, asleep from 1 AM
  /// to 5 AM. A Mobi that was sleepy or asleep plays [MobiAct.wake] once when this moves past
  /// the late-night window.
  final MobiAct? entrance;

  static const Duration settleDuration = Duration(milliseconds: 420);
  static const Duration hopDuration = Duration(milliseconds: 400);

  /// Build with `--dart-define=MOBI_RASTER=true` to show the old warm renders instead of the
  /// living character.
  static const bool rasterFallback = bool.fromEnvironment('MOBI_RASTER');

  @override
  State<Mobi> createState() => _MobiState();
}

class _MobiState extends State<Mobi> {
  MobiController? _own;
  MobiController get _controller => widget.controller ?? (_own ??= MobiController());

  @override
  void initState() {
    super.initState();
    final line = widget.say;
    if (line != null) _controller.say(line, live: widget.sayLive);
  }

  @override
  void didUpdateWidget(Mobi old) {
    super.didUpdateWidget(old);
    final line = widget.say;
    if (line != null && line != old.say) _controller.say(line, live: widget.sayLive);
  }

  @override
  void dispose() {
    _own?.dispose();
    super.dispose();
  }

  MobiAct get _entrance {
    final override = widget.entrance;
    if (override != null) return override;
    final act = widget.pose.act;
    if (act == MobiAct.appear && widget.motion == MobiMotion.none) return MobiAct.idle;
    if (act == MobiAct.appear && widget.motion == MobiMotion.hop) return MobiAct.cheer;
    if (act == MobiAct.appear && widget.motion == MobiMotion.tilt) return MobiAct.point;
    return act;
  }

  @override
  Widget build(BuildContext context) {
    final Widget body = Mobi.rasterFallback
        ? _RasterMobi(pose: widget.pose, size: widget.size, semanticLabel: widget.semanticLabel)
        : MobiCharacter(
            controller: _controller,
            size: widget.size,
            entrance: _entrance,
            semanticLabel: widget.semanticLabel,
            interactive: widget.interactive,
            seed: 7 + widget.pose.index * 13,
            // Small Mobis (rows, headers) paint lite detail; MobiCharacter picks it by size.
          );

    if (widget.say == null) return body;
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        body,
        const SizedBox(width: MmSpace.s4),
        Flexible(
          child: ValueListenableBuilder<MobiSpeech?>(
            valueListenable: _controller.speech,
            builder: (context, speech, _) => speech == null
                ? const SizedBox.shrink()
                : MobiBubble(key: ValueKey(speech.id), speech: speech, tail: MobiTail.left, maxWidth: 250),
          ),
        ),
      ],
    );
  }
}

/// The old warm render of a pose, kept as a fallback.
class _RasterMobi extends StatelessWidget {
  const _RasterMobi({required this.pose, required this.size, this.semanticLabel});

  final MobiPose pose;
  final double size;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final legacy = Image.asset(
      pose.legacyAsset,
      height: size,
      fit: BoxFit.contain,
      cacheHeight: (size * dpr).round(),
      excludeFromSemantics: true,
      errorBuilder: (context, error, stack) => SizedBox.square(dimension: size),
    );
    return RepaintBoundary(child: ArtImage(pose.art, height: size, placeholder: legacy, semanticLabel: semanticLabel));
  }
}

/// Mobi's one short line: a small smoked-glass bubble with a tail toward Mobi. Read in place
/// with the screen; a [live] line (one that changes after the student acts, such as the worry
/// step) is announced when it changes.
class MobiLine extends StatelessWidget {
  const MobiLine(this.text, {super.key, this.live = false});

  final String text;
  final bool live;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const radius = BorderRadius.only(
      topLeft: Radius.circular(6),
      topRight: Radius.circular(18),
      bottomLeft: Radius.circular(18),
      bottomRight: Radius.circular(18),
    );
    return Semantics(
      liveRegion: live,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 240),
        child: FakeGlass(
          borderRadius: radius,
          opacity: colors.isNight ? 0.86 : 0.92,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12 + 2, vertical: MmSpace.s8 + 2),
            child: Text(text, style: type.labelLarge.copyWith(fontSize: 14, height: 19 / 14, color: colors.ink)),
          ),
        ),
      ),
    );
  }
}
