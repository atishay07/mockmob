import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/auth_state.dart';
import '../../haptics/haptics.dart';
import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../materials/light_field.dart';
import 'brand_logo.dart';
import 'logo_geometry.g.dart';

/// The brand opening's timeline, in milliseconds from the first Flutter frame. Pure functions of
/// time and screen size, so tests and the lab can freeze any moment.
///
/// 0 to 500: the "mo" holds exactly where the system splash drew it; Mobi blinks once (150) and
/// the empty answer-bubble eye inks from its centre (320 to 520, a light haptic at 400).
/// 500 to 1000: the view eases out to the whole word while "mock" unfolds from behind the m,
/// nearest letter first, each clipped by its neighbour and carried by a spring, and the b rises
/// out of the baseline. The word ends centred. Mobi glances toward the word (860).
/// 1000 to 1200: the opening fades over the first screen. If the app is not ready yet, the word
/// holds and Mobi blinks now and then until it is (never a spinner), at most [maxMs].
abstract final class OpeningTimeline {
  static const double blinkAt = 150;
  static const double inkAt = 320;
  static const double inkMs = 200;
  static const double hapticAt = 400;
  static const double expandAt = 500;
  static const double cameraMs = 500;
  static const double firstLetterAt = 520;
  static const double stagger = 40;
  static const double riseAt = 540;
  static const double glanceAt = 860;
  static const double glanceMs = 120;

  /// The composed word; the hand-off may start here.
  static const double settledAt = 1000;
  static const double fadeMs = 200;

  /// Waiting on the app: the glance returns, then a blink every [idleBlinkEvery].
  static const double idleReturnAt = 1300;
  static const double idleFirstBlinkAt = 1900;
  static const double idleBlinkEvery = 2800;

  /// The longest the opening waits for the app; then it hands off to the splash route, which
  /// shows the same word.
  static const double maxMs = 8000;

  /// Under reduced motion: a crossfade from "mo" to the word.
  static const double reducedMs = 200;

  /// The Android 12+ splash draws the 108-unit `splash_mo` drawable 288 dp square (an icon with no
  /// icon background); `launch_background.xml` uses the same size before Android 12. Keep in step
  /// with SPLASH_ICON_DP in tool/make_icons.py.
  static const double splashIconDp = 288;

  /// Side of the splash square on [screen]: [splashIconDp], scaled down only in a box smaller
  /// than a phone (the lab's previews).
  static double splashSide(Size screen) => splashIconDp * math.min(1.0, math.min(screen.width, screen.height) / 320);

  /// The word's em at the end: 60% of the width, at most 48 dp.
  static double finalEm(Size screen) => math.min(48.0, screen.width * 0.6 / (LogoGeometry.wordBounds.width / 1000));

  static final SpringSimulation _spring = SpringSimulation(Springs.settle, 1, 0, 0);

  /// What is left of a spring's travel [ms] after it started (1 before it starts).
  static double springLeft(double ms) => ms <= 0 ? 1 : (ms >= 1400 ? 0 : _spring.x(ms / 1000));

  static double _span(double t, double a, double ms) => ((t - a) / ms).clamp(0.0, 1.0);

  static double blinkAmount(double t, double at) {
    final u = t - at;
    if (u <= 0 || u >= 160) return 0;
    return u < 60 ? Motion.inOut.transform(u / 60) : 1 - Motion.inOut.transform((u - 60) / 100);
  }

  /// Camera progress, 0 at the "mo" to 1 at the word.
  static double camera(double t) => Motion.emphasized.transform(_span(t, expandAt, cameraMs));

  /// The lamp coming up with the word, 0 to 1.
  static double lamp(double t) => Motion.glide.transform(_span(t, expandAt, cameraMs));

  static Rect _viewFor(Offset focus, double dpPerUnit, Size size) =>
      Rect.fromCenter(center: focus, width: size.width / dpPerUnit, height: size.height / dpPerUnit);

  /// The view that puts the "mo" exactly where the system splash drew it.
  static Rect moView(Size size) {
    final crop = LogoGeometry.adaptiveIconCrop;
    return _viewFor(crop.center, splashSide(size) / crop.width, size);
  }

  /// The view that centres the word at [finalEm].
  static Rect wordView(Size size) =>
      _viewFor(LogoGeometry.wordBounds.center, finalEm(size) / LogoGeometry.unitsPerEm, size);

  static Rect _cameraView(double c, Size size) {
    final crop = LogoGeometry.adaptiveIconCrop;
    final s0 = splashSide(size) / crop.width;
    final s1 = finalEm(size) / LogoGeometry.unitsPerEm;
    final s = s0 * math.pow(s1 / s0, c);
    final focus = Offset.lerp(crop.center, LogoGeometry.wordBounds.center, c)!;
    return _viewFor(focus, s.toDouble(), size);
  }

  static final Map<int, LogoLetter> _byIndex = {for (final l in LogoGeometry.letters) l.index: l};
  static const double _far = 1e6;

  /// How far past its clip edge a hidden letter waits, so no anti-aliased sliver shows.
  static const double _hidden = 40;

  /// Letters before the "mo", nearest first, and letters after Mobi, nearest first.
  static List<int> get _before => [for (var i = LogoGeometry.mobiIndex - 2; i >= 0; i--) i];
  static List<int> get _after => [for (var i = LogoGeometry.mobiIndex + 1; i < LogoGeometry.word.length; i++) i];

  static double _leftInk(int index) {
    if (index == LogoGeometry.mobiIndex) return LogoGeometry.mobiSmall.x + LogoGeometry.mobiSmall.bounds.left;
    final l = _byIndex[index]!;
    return l.x + l.bounds.left;
  }

  static double _rightInk(int index) {
    if (index == LogoGeometry.mobiIndex) return LogoGeometry.mobiSmall.x + LogoGeometry.mobiSmall.bounds.right;
    final l = _byIndex[index]!;
    return l.x + l.bounds.right;
  }

  /// The pose at [t] ms on a [size] screen.
  static LogoPose poseAt(double t, Size size) {
    final glyphs = List<LogoGlyphPose>.filled(LogoGeometry.word.length, LogoGlyphPose.rest);

    // "mock" unfolds leftwards: every letter starts stacked under the m of "mo" and shows only
    // left of its right neighbour's current left edge, so each slides out from behind the next.
    final before = _before;
    final home = _leftInk(LogoGeometry.mobiIndex - 1);
    for (var k = 0; k < before.length; k++) {
      final i = before[k];
      final n = i + 1;
      final edge = _leftInk(n) + glyphs[n].offset.dx;
      final start = home - _leftInk(i) + _hidden;
      final dx = start * springLeft(t - (firstLetterAt + k * stagger));
      glyphs[i] = LogoGlyphPose(offset: Offset(dx, 0), clip: Rect.fromLTRB(-_far, -_far, edge, _far));
    }

    // After Mobi: one letter rises out of the baseline (B's "b"); several unfold rightwards from
    // behind Mobi (A's "ckmob").
    final after = _after;
    if (after.length == 1) {
      final j = after.single;
      final l = _byIndex[j]!;
      final dy = (l.bounds.height + _hidden) * springLeft(t - riseAt);
      glyphs[j] = LogoGlyphPose(offset: Offset(0, dy), clip: Rect.fromLTRB(-_far, -_far, _far, LogoGeometry.mobiOvershoot));
    } else {
      for (var k = 0; k < after.length; k++) {
        final j = after[k];
        final n = j - 1;
        final edge = _rightInk(n) + glyphs[n].offset.dx;
        final start = _rightInk(LogoGeometry.mobiIndex) - _rightInk(j) - _hidden;
        final dx = start * springLeft(t - (firstLetterAt + k * stagger));
        glyphs[j] = LogoGlyphPose(offset: Offset(dx, 0), clip: Rect.fromLTRB(edge, -_far, _far, _far));
      }
    }

    final c = camera(t);
    final inkDone = t >= inkAt + inkMs;
    return LogoPose(
      view: _cameraView(c, size),
      glyphs: glyphs,
      mobi: MobiFacePose(
        // The full master (the splash's ring eye and flap cut) until the word is half out.
        detail: c < 0.5 ? LogoDetail.full : LogoDetail.small,
        blink: blinkAmount(t, blinkAt) + _idleBlink(t),
        ink: Motion.glide.transform(_span(t, inkAt, inkMs)),
        eyesToSmall: inkDone ? c : null,
        look: Offset(_look(t), 0),
      ),
    );
  }

  static double _look(double t) {
    if (t < idleReturnAt) return -0.8 * Motion.out.transform(_span(t, glanceAt, glanceMs));
    return -0.8 * (1 - Motion.out.transform(_span(t, idleReturnAt, 160)));
  }

  static double _idleBlink(double t) {
    if (t < idleFirstBlinkAt) return 0;
    final phase = (t - idleFirstBlinkAt) % idleBlinkEvery;
    return blinkAmount(phase, 0.001);
  }

  /// The static "mo" of the first frame (what the system splash shows).
  static LogoPose moPose(Size size) => poseAt(0, size);

  /// The static word of the last frame (what the splash route shows).
  static LogoPose wordPose(Size size) => LogoPose(
        view: wordView(size),
        mobi: const MobiFacePose(detail: LogoDetail.small),
      );
}

/// The one brand opening, on every cold start: it continues the system splash's "mo", grows into
/// "mockmob", and hands off to the first screen. It covers the app until it is done, then
/// removes itself ([onDone]); tap to skip. Under reduced motion the "mo" crossfades to the word.
///
/// [ready] says the first screen is known (auth resolved). [progress] (0 to 1 of the first
/// 1000 ms) freezes the timeline, for goldens and the lab.
class BrandOpening extends ConsumerStatefulWidget {
  const BrandOpening({super.key, required this.onDone, this.ready = true, this.progress});

  final VoidCallback onDone;
  final bool ready;
  final double? progress;

  @override
  ConsumerState<BrandOpening> createState() => _BrandOpeningState();
}

class _BrandOpeningState extends ConsumerState<BrandOpening> with TickerProviderStateMixin {
  late final AnimationController _clock = AnimationController(
    vsync: this,
    upperBound: OpeningTimeline.maxMs,
    duration: const Duration(milliseconds: 8000),
    animationBehavior: AnimationBehavior.preserve,
  );
  late final AnimationController _fade = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: OpeningTimeline.fadeMs.round()),
    animationBehavior: AnimationBehavior.preserve,
  );
  late final Animation<double> _shown = ReverseAnimation(CurvedAnimation(parent: _fade, curve: Motion.exit));

  bool _reduced = false;
  bool _started = false;
  bool _buzzed = false;
  bool _done = false;
  double? _readyAt;

  double get _t => widget.progress != null ? widget.progress!.clamp(0.0, 1.0) * OpeningTimeline.settledAt : _clock.value;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started || widget.progress != null) return;
    _started = true;
    _reduced = Motion.reduced(context);
    if (_reduced) _fade.duration = Motion.reducedFade;
    if (widget.ready) _readyAt = 0;
    _clock.addListener(_tick);
    _clock.forward();
    _fade.addStatusListener((s) {
      if (s == AnimationStatus.completed) _finish();
    });
  }

  @override
  void didUpdateWidget(BrandOpening old) {
    super.didUpdateWidget(old);
    if (widget.ready && _readyAt == null && widget.progress == null) {
      _readyAt = _clock.value;
      _tick();
    }
  }

  double get _settledAt => _reduced ? OpeningTimeline.reducedMs : OpeningTimeline.settledAt;

  void _tick() {
    final t = _clock.value;
    // Once, as the bubble eye inks (a skip sets _buzzed, so a skipped opening stays quiet).
    if (!_reduced && !_buzzed && t >= OpeningTimeline.hapticAt) {
      _buzzed = true;
      unawaited(ref.read(hapticsProvider).light().catchError((Object _) {}));
    }
    if (_fade.isAnimating || _fade.isCompleted) return;
    final readyAt = _readyAt;
    // A late "ready" waits a moment more, so the first screen's own entrance has landed.
    final canGo = readyAt != null && t >= _settledAt && (readyAt < _settledAt - 150 || t - readyAt >= 150);
    if (canGo || t >= OpeningTimeline.maxMs) _fade.forward();
  }

  /// A tap: hand off now if the app is ready, else jump to the composed word and wait there.
  void _skip() {
    if (_done || widget.progress != null) return;
    _buzzed = true;
    if (_readyAt != null) {
      _fade.forward();
    } else if (_clock.value < _settledAt) {
      _clock.value = _settledAt;
      _clock.forward();
    }
  }

  void _finish() {
    if (_done || !mounted) return;
    _done = true;
    _clock.stop();
    widget.onDone();
  }

  @override
  void dispose() {
    _clock.dispose();
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = MmColors.dark;
    final Animation<double> lamp = _reduced ? kAlwaysCompleteAnimation : _clock.drive(_ByTime(OpeningTimeline.lamp));
    return Theme(
      data: buildTheme(Brightness.dark),
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Color(0x00000000),
          statusBarIconBrightness: Brightness.light,
          systemNavigationBarColor: Color(0x00000000),
          systemNavigationBarIconBrightness: Brightness.light,
          systemStatusBarContrastEnforced: false,
          systemNavigationBarContrastEnforced: false,
        ),
        child: Semantics(
          label: 'MockMob',
          hint: 'Tap to skip',
          onTap: _skip,
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: _skip,
            child: FadeTransition(
              opacity: _shown,
              child: RepaintBoundary(
                child: ColoredBox(
                  color: dark.ground,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      FadeTransition(
                        opacity: widget.progress != null ? AlwaysStoppedAnimation(OpeningTimeline.lamp(_t)) : lamp,
                        child: Builder(builder: (context) => LightField.lamp(context, strength: 0.7)),
                      ),
                      CustomPaint(
                        painter: _OpeningPainter(
                          clock: _clock,
                          time: () => _t,
                          reduced: _reduced && widget.progress == null,
                          devicePixelRatio: MediaQuery.devicePixelRatioOf(context),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ByTime extends Animatable<double> {
  const _ByTime(this.f);

  final double Function(double t) f;

  @override
  double transform(double t) => f(t);
}

class _OpeningPainter extends CustomPainter {
  _OpeningPainter({required Listenable clock, required this.time, required this.reduced, required this.devicePixelRatio})
      : super(repaint: clock);

  final double Function() time;
  final bool reduced;
  final double devicePixelRatio;

  static final Paint _layer = Paint();

  void _paint(Canvas canvas, Size size, LogoPose pose) => BrandLogoPainter.paintPose(
        canvas,
        size,
        pose,
        form: BrandLogoForm.wordmark,
        letterColor: LogoGeometry.warmWhite,
        devicePixelRatio: devicePixelRatio,
      );

  @override
  void paint(Canvas canvas, Size size) {
    final t = time();
    if (!reduced) {
      _paint(canvas, size, OpeningTimeline.poseAt(t, size));
      return;
    }
    final k = Motion.glide.transform((t / OpeningTimeline.reducedMs).clamp(0.0, 1.0));
    if (k < 1) {
      canvas.saveLayer(null, _layer..color = Color.fromRGBO(0, 0, 0, 1 - k));
      _paint(canvas, size, OpeningTimeline.moPose(size));
      canvas.restore();
    }
    if (k > 0) {
      canvas.saveLayer(null, _layer..color = Color.fromRGBO(0, 0, 0, k));
      _paint(canvas, size, OpeningTimeline.wordPose(size));
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_OpeningPainter old) => old.reduced != reduced || old.devicePixelRatio != devicePixelRatio;
}

/// Lays the brand opening over the app on every cold start and removes it when it is done. The
/// app underneath builds and routes as usual; it is hidden from screen readers until then.
class BrandOpeningHost extends ConsumerStatefulWidget {
  const BrandOpeningHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<BrandOpeningHost> createState() => _BrandOpeningHostState();
}

class _BrandOpeningHostState extends ConsumerState<BrandOpeningHost> {
  bool _showing = true;

  @override
  Widget build(BuildContext context) {
    final ready = ref.watch(authSnapshotProvider.select((a) => a.status != AuthStatus.unknown));
    return Stack(
      fit: StackFit.expand,
      children: [
        ExcludeSemantics(excluding: _showing, child: widget.child),
        if (_showing) BrandOpening(ready: ready, onDone: () => setState(() => _showing = false)),
      ],
    );
  }
}
