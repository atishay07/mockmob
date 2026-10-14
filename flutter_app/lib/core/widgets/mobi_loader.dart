import 'dart:async';

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/theme.dart';
import 'mobi.dart';

/// The designed loading state of a screen or a large slot: nothing for the first 300 ms (a fast
/// load never flashes), then the living Mobi thinking, and after a second a one-line [status]
/// fading in under it. Under reduced motion Mobi holds still. TalkBack hears [status] once, when Mobi
/// appears.
///
/// Keep `MmSpinner` for in-flight work inside keys and inline rows.
class MobiLoader extends StatefulWidget {
  const MobiLoader({
    super.key,
    this.status = 'Getting this ready',
    this.size = 72,
    this.delay = appearAfter,
    this.statusDelay = statusAfter,
  });

  /// One short line, said only for waits over [statusDelay].
  final String status;

  /// Mobi's height in dp.
  final double size;
  final Duration delay;
  final Duration statusDelay;

  static const Duration appearAfter = Duration(milliseconds: 300);
  static const Duration statusAfter = Duration(seconds: 1);

  @override
  State<MobiLoader> createState() => _MobiLoaderState();
}

class _MobiLoaderState extends State<MobiLoader> {
  Timer? _appear;
  Timer? _say;
  bool _shown = false;
  bool _saying = false;

  @override
  void initState() {
    super.initState();
    _appear = Timer(widget.delay, () {
      if (mounted) setState(() => _shown = true);
    });
    _say = Timer(widget.statusDelay, () {
      if (mounted) setState(() => _saying = true);
    });
  }

  @override
  void dispose() {
    _appear?.cancel();
    _say?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_shown) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      liveRegion: true,
      label: widget.status,
      excludeSemantics: true,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s24),
          // A centred column: the line is always laid out (only its opacity changes), so Mobi
          // sits in the middle from the first frame and never moves when the line appears.
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Mobi(pose: MobiPose.think, size: widget.size),
              AnimatedOpacity(
                opacity: _saying ? 1 : 0,
                duration: Motion.of(context, Motion.ui),
                child: Padding(
                  padding: const EdgeInsets.only(top: MmSpace.s12),
                  child: Text(
                    widget.status,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                    style: type.body.copyWith(color: colors.ink2),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
