import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../haptics/haptics.dart';
import '../../motion/motion.dart';
import '../../storage/storage_providers.dart';
import '../../theme/theme.dart';
import '../materials/grain.dart';
import '../art/mm_art.dart';
import '../materials/light_field.dart';
import 'mark.dart';
import 'wordmark.dart';

/// True until the cold open has played once on this phone.
final shouldPlayColdOpenProvider = FutureProvider<bool>((ref) async {
  try {
    return !await ref.read(appPrefsProvider).coldOpenSeen();
  } on Object {
    return false;
  }
});

/// Records that the cold open has played, so it never plays again.
Future<void> markColdOpenSeen(WidgetRef ref) async {
  try {
    await ref.read(appPrefsProvider).setColdOpenSeen(true);
  } on Object {
    // A convenience; at worst it plays once more.
  }
}

/// The first-launch cold open (brief section 11, step 1), 1.4 s: in a dark room with the desk
/// lamp just on, a volt hairline draws across, the mark's bubble inks, and the wordmark rises
/// into place. Tap anywhere to skip. Under reduced motion it is a short fade of the final frame.
/// [onDone] fires once, when it ends or is skipped. The onboarding flow decides when to show it
/// (see [shouldPlayColdOpenProvider]).
class ColdOpen extends ConsumerStatefulWidget {
  const ColdOpen({super.key, required this.onDone, this.progress});

  final VoidCallback onDone;

  /// Freezes the timeline at a point (0 to 1), for goldens and the lab.
  final double? progress;

  @override
  ConsumerState<ColdOpen> createState() => _ColdOpenState();
}

class _ColdOpenState extends ConsumerState<ColdOpen> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: Motion.coldOpen);
  bool _done = false;
  bool _reduced = false;
  bool _ticked = false;
  Timer? _hold;

  bool _precached = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _precacheWelcome();
    if (widget.progress != null || _t.isAnimating || _t.value > 0) return;
    _reduced = Motion.reduced(context);
    if (_reduced) {
      _t.duration = Motion.crossFade;
      _t.forward().whenComplete(() => _hold = Timer(const Duration(milliseconds: 700), _finish));
    } else {
      _t.addListener(_haptic);
      _t.forward().whenComplete(_finish);
    }
  }

  /// Decodes the welcome's desk scene and Mobi during the 1.4 s open, at the exact sizes the
  /// welcome draws them, so they are on screen with its first frame instead of popping in.
  void _precacheWelcome() {
    if (_precached || widget.progress != null) return;
    _precached = true;
    final size = MediaQuery.sizeOf(context);
    final dpr = MediaQuery.devicePixelRatioOf(context);
    void warm(ImageProvider provider) => unawaited(precacheImage(provider, context, onError: (_, _) {}));
    warm(ResizeImage(AssetImage(MmArt.heroDesk.asset), width: (size.width * dpr).round()));
    warm(ResizeImage(AssetImage(MmArt.mobiGreet.asset), height: (116 * dpr).round()));
  }

  void _haptic() {
    if (!_ticked && _t.value >= 0.42) {
      _ticked = true;
      ref.read(hapticsProvider).light();
    }
  }

  void _finish() {
    if (_done || !mounted) return;
    _done = true;
    widget.onDone();
  }

  @override
  void dispose() {
    _hold?.cancel();
    _t.dispose();
    super.dispose();
  }

  double _span(double t, double a, double b) => ((t - a) / (b - a)).clamp(0.0, 1.0);

  @override
  Widget build(BuildContext context) {
    final colors = MmColors.dark;
    return Theme(
      data: buildTheme(Brightness.dark),
      child: Semantics(
        label: 'MockMob',
        button: true,
        hint: 'Tap to skip',
        onTap: _finish,
        excludeSemantics: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _finish,
          child: ColoredBox(
            color: colors.ground,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AnimatedBuilder(
                  animation: _t,
                  builder: (context, _) {
                    final t = widget.progress ?? _t.value;
                    final lamp = _reduced ? 1.0 : Motion.glide.transform(_span(t, 0, 0.6));
                    return LightField(pools: [
                      LightPool(color: colors.lamp.withValues(alpha: 0.2 * lamp), center: const Alignment(-1.1, -1.1), radius: 1.1),
                      LightPool(color: colors.voltGlow.withValues(alpha: colors.voltGlow.a * 0.7 * lamp), center: const Alignment(0, -0.06), radius: 0.2),
                    ]);
                  },
                ),
                const Grain(),
                Center(child: AnimatedBuilder(animation: _t, builder: (context, _) => _composition(widget.progress ?? _t.value))),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _composition(double t) {
    if (_reduced && widget.progress == null) {
      return FadeTransition(opacity: _t, child: const _Final());
    }
    final line = Motion.glide.transform(_span(t, 0, 0.36));
    final ink = _span(t, 0.3, 0.55);
    final markIn = Motion.emphasized.transform(_span(t, 0.22, 0.5));
    final rise = Motion.emphasized.transform(_span(t, 0.5, 0.86));
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Opacity(
          opacity: markIn,
          child: Transform.scale(scale: 0.9 + 0.1 * markIn, child: MmMark(size: 72, ink: ink, edge: line)),
        ),
        const SizedBox(height: 28),
        SizedBox(
          height: 48,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Opacity(
                opacity: rise,
                child: Transform.translate(
                  offset: Offset(0, 14 * (1 - rise)),
                  child: Wordmark(height: 40, hairline: rise >= 1 ? 1 : 0),
                ),
              ),
              if (rise < 1)
                Opacity(
                  opacity: 1 - rise,
                  child: CustomPaint(size: const Size(180, 2), painter: _Hairline(line, MmColors.dark.volt)),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Final extends StatelessWidget {
  const _Final();

  @override
  Widget build(BuildContext context) {
    return const Column(
      mainAxisSize: MainAxisSize.min,
      children: [MmMark(size: 72), SizedBox(height: 28), SizedBox(height: 48, child: Center(child: Wordmark(height: 40)))],
    );
  }
}

class _Hairline extends CustomPainter {
  const _Hairline(this.progress, this.color);

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;
    canvas.drawLine(
      Offset(0, size.height / 2),
      Offset(size.width * progress, size.height / 2),
      Paint()
        ..strokeWidth = 1.5
        ..strokeCap = StrokeCap.round
        ..shader = LinearGradient(colors: [color.withValues(alpha: 0), color]).createShader(Offset.zero & size),
    );
  }

  @override
  bool shouldRepaint(_Hairline old) => old.progress != progress || old.color != color;
}
