import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../model/recap_variant.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// Mobi on a recap card, with a small script of what it does and when (Duolingo-style presence
/// without a chat bubble): it settles into its [pose]'s own act, breathes and blinks on its own,
/// and then does at most two things:
///
///  * [lookAt] a key: after [thinkFor] of thinking it turns and points at that widget (card 3
///    points at the printed strip of answers);
///  * says a [line] as a plain line of text beside it, bobbing while the line arrives.
///
/// It cheers only when [pose] is a cheer, which the card chooses only for a higher result; it
/// stands proud only for a milestone (the first full mock) and nods encouragement after a lower
/// or held result. Under reduced motion Mobi holds its pose and the line is simply there.
class RecapMobi extends StatefulWidget {
  const RecapMobi({
    super.key,
    required this.pose,
    this.size = 96,
    this.line,
    this.lookAt,
    this.thinkFor = const Duration(milliseconds: 1500),
    this.cheerAfter,
    this.controller,
  });

  final MobiPose pose;
  final double size;

  /// A single plain line, to the right of Mobi.
  final String? line;

  /// The widget Mobi points at after thinking, if any.
  final GlobalKey? lookAt;
  final Duration thinkFor;

  /// Plays one cheer after this long (a higher result, once the figure has landed). Never under
  /// reduced motion.
  final Duration? cheerAfter;

  /// Drives this Mobi from outside (card 2 glances at the ribbon the student picks). When given,
  /// the caller owns it and disposes it.
  final MobiController? controller;

  /// The pose that plays [act] when Mobi appears. The reaction table speaks in acts, the Mobi
  /// widget in poses.
  static MobiPose poseFor(MobiAct act) => switch (act) {
    MobiAct.proud => MobiPose.proud,
    MobiAct.cheer || MobiAct.celebrate => MobiPose.cheer,
    MobiAct.encourage => MobiPose.encourage,
    MobiAct.sleepy => MobiPose.sleepy,
    MobiAct.sleep => MobiPose.sleepy,
    _ => MobiPose.rest,
  };

  /// The pose for [reaction], null (no Mobi) when there is none.
  static MobiPose? poseOf(RecapReaction? reaction) => reaction == null ? null : poseFor(reaction.act);

  @override
  State<RecapMobi> createState() => _RecapMobiState();
}

class _RecapMobiState extends State<RecapMobi> {
  /// The earliest Mobi starts talking its line.
  static const Duration _talkAfter = Duration(milliseconds: 650);

  late final MobiController _controller = widget.controller ?? MobiController();
  Timer? _beat;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final reduced = Motion.reduced(context);
    if (widget.lookAt != null) {
      // Thinking first; a held pose under reduced motion goes straight to the point.
      _beat = Timer(reduced ? const Duration(milliseconds: 80) : widget.thinkFor, _point);
    } else if (widget.cheerAfter != null && !reduced) {
      _beat = Timer(widget.cheerAfter!, () {
        if (mounted) _controller.play(MobiAct.cheer);
      });
    } else if (widget.line != null && !reduced) {
      // Mobi finishes its arrival act first (a proud stretch or an encouraging nod is the
      // moment), then talks the line in.
      final act = Duration(milliseconds: (MobiMoves.duration(widget.pose.act) * 1000).round());
      _beat = Timer(act > _talkAfter ? act : _talkAfter, () {
        if (mounted) _controller.say(widget.line!);
      });
    }
  }

  void _point() {
    if (!mounted) return;
    final key = widget.lookAt;
    if (key != null) _controller.pointAtWidget(key);
  }

  @override
  void dispose() {
    _beat?.cancel();
    if (widget.controller == null) _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final line = widget.line;
    final mobi = Mobi(pose: widget.lookAt != null ? MobiPose.think : widget.pose, size: widget.size, controller: _controller);
    if (line == null) return mobi;
    final colors = context.mmColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        mobi,
        const SizedBox(width: MmSpace.s8),
        Flexible(
          child: Text(line, style: context.mmType.labelLarge.copyWith(color: colors.ink2, height: 1.3)),
        ),
      ],
    );
  }
}
