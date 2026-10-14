import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
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

/// The brand opening's timeline, in milliseconds from the moment the "mo" is on the glass (the
/// system splash has lifted off it). Pure functions of time and screen size, so tests and the lab
/// can freeze any moment.
///
/// 0 to 500: the "mo" holds exactly where the system splash drew it; Mobi blinks once (150) and
/// the empty answer-bubble eye inks from its centre (320 to 520, a light haptic at 400).
/// 500 to 1000: the view eases out to the whole word while the other letters unfold out of the
/// "mo" like a folded strip of paper opening: "mock" leftwards from the m, the b rightwards from
/// Mobi, each letter on a hinge at the edge it shares with its neighbour, nearest first, carried
/// by a spring. The word ends centred. Mobi glances toward the word (860).
/// 850: the first screen starts painting under the still-opaque opening.
/// 1000 to 1280: the hand-off. The word fades out first (120 ms), then the ground lifts off the
/// first screen (80 to 280). If the app is not ready yet, the word holds and Mobi blinks now and
/// then until it is (never a spinner), at most [maxMs].
abstract final class OpeningTimeline {
  static const double blinkAt = 150;
  static const double inkAt = 320;
  static const double inkMs = 200;
  static const double hapticAt = 400;
  static const double expandAt = 500;
  static const double cameraMs = 500;
  static const double firstLetterAt = 520;
  static const double stagger = 40;
  static const double glanceAt = 860;
  static const double glanceMs = 120;

  /// The composed word; the hand-off may start here.
  static const double settledAt = 1000;

  /// The first screen paints under the opaque opening this long before the fade, so its first
  /// (and most expensive) frame is not one of the fade's.
  static const double prepaintLead = 150;

  /// The hand-off: the word fades out over [wordOutMs], then the ground lifts from
  /// [groundOutFrom] to [fadeMs], so the word never overlaps the first screen.
  static const double fadeMs = 280;
  static const double wordOutMs = 120;
  static const double groundOutFrom = 80;

  /// A letter stays invisible until it is [letterShowFrom] open (on the device a sliver read as
  /// a stray bar beside the "mo"), then fades in until it is [letterFadeOpen] open.
  static const double letterShowFrom = 0.12;
  static const double letterFadeOpen = 0.45;

  /// The flap cut fills in (the full master becomes the small one) over this long, centred on
  /// the moment Mobi crosses [LogoGeometry.fullFromMobiPx] physical pixels.
  static const double detailSwapMs = 60;

  /// Waiting on the app: the glance returns, then a blink every [idleBlinkEvery].
  static const double idleReturnAt = 1300;
  static const double idleFirstBlinkAt = 1900;
  static const double idleBlinkEvery = 2800;

  /// The longest the opening waits for the app; then it hands off to the splash route, which
  /// shows the same word.
  static const double maxMs = 8000;

  /// Under reduced motion: the "mo" fades out, then the word fades in; no unfolding, no blink.
  static const double reducedMs = 200;
  static const double reducedFadeMs = 160;

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

  /// The pull-back: a soft start, then a long settle into the word. The scale is interpolated
  /// on a log scale, so a front-loaded curve (like [Motion.emphasized]) read on the device as a
  /// cut from "mo" to the small word in one or two frames.
  static const Cubic pullBack = Cubic(0.5, 0, 0.15, 1);

  /// Camera progress, 0 at the "mo" to 1 at the word.
  static double camera(double t) => pullBack.transform(_span(t, expandAt, cameraMs));

  /// The lamp coming up with the word, 0 to 1.
  static double lamp(double t) => Motion.glide.transform(_span(t, expandAt, cameraMs));

  /// Under reduced motion the lamp comes up with the crossfade, so the first frame is still the
  /// flat ground of the system splash.
  static double reducedLamp(double t) => Motion.glide.transform(_span(t, 0, reducedMs));

  static Rect _viewFor(Offset focus, double dpPerUnit, Size size) =>
      Rect.fromCenter(center: focus, width: size.width / dpPerUnit, height: size.height / dpPerUnit);

  static double _moScale(Size size) => splashSide(size) / LogoGeometry.adaptiveIconCrop.width;
  static double _wordScale(Size size) => finalEm(size) / LogoGeometry.unitsPerEm;

  /// The view that puts the "mo" exactly where the system splash drew it.
  static Rect moView(Size size) => _viewFor(LogoGeometry.adaptiveIconCrop.center, _moScale(size), size);

  /// The view that centres the word at [finalEm].
  static Rect wordView(Size size) => _viewFor(LogoGeometry.wordBounds.center, _wordScale(size), size);

  static Rect _cameraView(double c, Size size) {
    final s0 = _moScale(size);
    final s = s0 * math.pow(_wordScale(size) / s0, c);
    final focus = Offset.lerp(LogoGeometry.adaptiveIconCrop.center, LogoGeometry.wordBounds.center, c)!;
    return _viewFor(focus, s.toDouble(), size);
  }

  static final Map<int, LogoLetter> _byIndex = {for (final l in LogoGeometry.letters) l.index: l};

  /// Letters before the "mo", nearest first, and letters after Mobi, nearest first. Which o is
  /// Mobi is the geometry's one setting ([LogoGeometry.mobiIndex]); everything here follows it.
  static final List<int> _before = [for (var i = LogoGeometry.mobiIndex - 2; i >= 0; i--) i];
  static final List<int> _after = [for (var i = LogoGeometry.mobiIndex + 1; i < LogoGeometry.word.length; i++) i];

  /// Mobi glances toward the rest of the word: left when Mobi ends it (B), right when it starts
  /// it (A).
  static final double _toward = LogoGeometry.mobiIndex * 2 >= LogoGeometry.word.length ? -1 : 1;

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

  /// How far open the [k]th letter out from the "mo" is at [t], 0 to 1.
  static double letterOpen(double t, int k) => (1 - springLeft(t - (firstLetterAt + k * stagger))).clamp(0.0, 1.0);

  static const LogoGlyphPose _folded = LogoGlyphPose(opacity: 0, scaleX: 0);

  static LogoGlyphPose _unfold(double open, {required double dx, required double hingeX}) {
    if (open <= 0) return _folded;
    if (open >= 1 && dx.abs() < 1e-6) return LogoGlyphPose.rest;
    return LogoGlyphPose(
      offset: Offset(dx, 0),
      scaleX: open,
      hingeX: hingeX,
      opacity: ((open - letterShowFrom) / (letterFadeOpen - letterShowFrom)).clamp(0.0, 1.0),
    );
  }

  /// The pose at [t] ms on a [size] screen painted at [devicePixelRatio].
  static LogoPose poseAt(double t, Size size, {double devicePixelRatio = 2}) {
    final glyphs = List<LogoGlyphPose>.filled(LogoGeometry.word.length, LogoGlyphPose.rest);

    // Leftwards from the m of "mo". Each letter's slot (its ink plus the gap to its right
    // neighbour) is scaled about the hinge it shares with that neighbour, and the hinge rides on
    // the neighbour's current left edge, so the letters open out one from the next and a letter
    // is only ever narrowed, never cut.
    var edge = _leftInk(LogoGeometry.mobiIndex - 1);
    for (var k = 0; k < _before.length; k++) {
      final i = _before[k];
      final hinge = _leftInk(i + 1);
      final open = letterOpen(t, k);
      glyphs[i] = _unfold(open, dx: edge - hinge, hingeX: hinge - _byIndex[i]!.x);
      edge -= (hinge - _leftInk(i)) * open;
    }

    // Rightwards from Mobi, the mirror image (B's "b"; A's "ckmob").
    edge = _rightInk(LogoGeometry.mobiIndex);
    for (var k = 0; k < _after.length; k++) {
      final j = _after[k];
      final hinge = _rightInk(j - 1);
      final open = letterOpen(t, k);
      glyphs[j] = _unfold(open, dx: edge - hinge, hingeX: hinge - _byIndex[j]!.x);
      edge += (_rightInk(j) - hinge) * open;
    }

    final c = camera(t);
    final inkDone = t >= inkAt + inkMs;
    final swapAt = detailSwapAt(size, devicePixelRatio);
    final toSmall = _span(t, swapAt - detailSwapMs / 2, detailSwapMs);
    return LogoPose(
      view: _cameraView(c, size),
      glyphs: glyphs,
      mobi: MobiFacePose(
        // The full master (the splash's ring eye and flap cut) while Mobi is drawn large enough
        // for it, then the flap cut fills in over [detailSwapMs].
        detail: toSmall < 0.5 ? LogoDetail.full : LogoDetail.small,
        bodyToSmall: toSmall,
        blink: blinkAmount(t, blinkAt) + _idleBlink(t),
        ink: Motion.glide.transform(_span(t, inkAt, inkMs)),
        eyesToSmall: inkDone ? c : null,
        look: Offset(_look(t), 0),
      ),
    );
  }

  static Size? _swapSize;
  static double _swapDpr = 0;
  static double _swapAt = 0;

  /// When Mobi, shrinking with the camera, crosses [LogoGeometry.fullFromMobiPx] physical pixels
  /// (the detail threshold of the static logo), never before the ink has landed.
  static double detailSwapAt(Size size, double devicePixelRatio) {
    if (size == _swapSize && devicePixelRatio == _swapDpr) return _swapAt;
    final px0 = LogoGeometry.mobiHeight * _moScale(size) * devicePixelRatio;
    final px1 = LogoGeometry.mobiHeight * _wordScale(size) * devicePixelRatio;
    const threshold = LogoGeometry.fullFromMobiPx;
    final double c;
    if (px0 <= threshold) {
      c = 0;
    } else if (px1 >= threshold) {
      // A word still large enough for the full master (a tablet): swap as it lands, as the
      // splash route's word is the small master.
      c = 1;
    } else {
      c = math.log(threshold / px0) / math.log(px1 / px0);
    }
    var lo = expandAt, hi = expandAt + cameraMs;
    for (var i = 0; i < 24; i++) {
      final mid = (lo + hi) / 2;
      if (camera(mid) < c) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    _swapSize = size;
    _swapDpr = devicePixelRatio;
    return _swapAt = math.max(hi, inkAt + inkMs + detailSwapMs / 2);
  }

  static double _look(double t) {
    if (t < idleReturnAt) return 0.8 * _toward * Motion.out.transform(_span(t, glanceAt, glanceMs));
    return 0.8 * _toward * (1 - Motion.out.transform(_span(t, idleReturnAt, 160)));
  }

  static double _idleBlink(double t) {
    if (t < idleFirstBlinkAt) return 0;
    final phase = (t - idleFirstBlinkAt) % idleBlinkEvery;
    return blinkAmount(phase, 0.001);
  }

  /// The static "mo" of the first frame (what the system splash shows).
  static LogoPose moPose(Size size, {double devicePixelRatio = 2}) => poseAt(0, size, devicePixelRatio: devicePixelRatio);

  /// The static word of the last frame (what the splash route shows).
  static LogoPose wordPose(Size size) => LogoPose(
        view: wordView(size),
        mobi: const MobiFacePose(detail: LogoDetail.small),
      );
}

/// Tells the opening when its first frame is on the glass: the first Flutter frame has been
/// drawn under the Android system splash, and Android has lifted the splash off it (a short fade
/// in `MainActivity`, over a "mo" that matches it). The opening's clock starts then, so the hold,
/// the blink and the ink all play where the student can see them.
///
/// On a slow start (a debug build on a 2 GB phone drew its first frame after 5.9 s) the "mo"
/// simply holds under the splash for as long as that takes; nothing of the opening is spent
/// out of sight.
abstract final class OpeningGlass {
  static const MethodChannel _channel = MethodChannel('in.mockmob.app/splash');

  /// How long the opening waits for Android to answer once it has asked. Android answers after
  /// its 150 ms fade, or after 600 ms when no splash came; this is only a net for a channel
  /// that never answers.
  static const Duration answerCap = Duration(seconds: 4);

  static bool get _android => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  /// A widget test never rasterizes a frame, so [wait] would wait for one for good; a test that
  /// goes through [wait] sets this to skip that wait.
  @visibleForTesting
  static bool debugFirstFrameDrawn = false;

  /// Completes when the "mo" is on the glass. True when nothing is left over it: Android answered
  /// that its splash is faded off, or there is no Android splash. False when Android never
  /// answered, so its splash may still be up and the hand-off must take it off at once.
  static Future<bool> wait() async {
    final binding = WidgetsBinding.instance;
    if (!debugFirstFrameDrawn && !binding.firstFrameRasterized) await binding.waitUntilFirstFrameRasterized;
    // One more frame, so the "mo" under the splash is a settled one.
    await binding.endOfFrame;
    if (!_android) return true;
    return release();
  }

  /// Asks Android to fade the splash off the "mo"; completes once it has (true), or after [cap]
  /// or on a missing channel (false: start now, but Android has not said its splash is gone).
  @visibleForTesting
  static Future<bool> release({Duration cap = answerCap}) async {
    try {
      await _channel.invokeMethod<bool>('release').timeout(cap);
      return true;
    } on Object {
      // No channel (an older build), or no answer in time.
      return false;
    }
  }

  /// Takes the splash off at once, with no fade. Only for a hand-off that starts before Android
  /// said the splash was gone, so its "mo" is never faded over the first screen.
  static Future<void> liftNow() async {
    if (!_android) return;
    try {
      await _channel.invokeMethod<bool>('release', false).timeout(answerCap);
    } on Object {
      // Nothing to lift.
    }
  }
}

/// The one brand opening, on every cold start: it continues the system splash's "mo", grows into
/// "mockmob", and hands off to the first screen. It covers the app until it is done, then
/// removes itself ([onDone]); tap to skip. Under reduced motion the "mo" fades to the word.
///
/// [ready] says the first screen is known (auth resolved). [progress] (0 to 1 of the first
/// 1000 ms) freezes the timeline, for goldens and the lab.
class BrandOpening extends ConsumerStatefulWidget {
  const BrandOpening({
    super.key,
    required this.onDone,
    this.onPrepaint,
    this.onReveal,
    this.ready = true,
    this.progress,
    this.shown,
  });

  final VoidCallback onDone;

  /// Called once shortly before the fade, while the opening is still opaque, so whatever is
  /// underneath can paint its first frame out of sight.
  final VoidCallback? onPrepaint;

  /// Called once as the opening starts to fade, so whatever is underneath can come alive.
  final VoidCallback? onReveal;
  final bool ready;
  final double? progress;

  /// Completes when the "mo" is on the glass. Null asks the platform ([OpeningGlass.wait]).
  final Future<void>? shown;

  @override
  ConsumerState<BrandOpening> createState() => _BrandOpeningState();
}

class _BrandOpeningState extends ConsumerState<BrandOpening> with TickerProviderStateMixin {
  /// If the platform never says the "mo" is on the glass, the opening starts this long after its
  /// first build anyway. Only a net for a platform that never answers: it must outlast the
  /// slowest start (a first frame at 5.9 s on a 2 GB phone in debug) plus Android's own 3 s hold,
  /// or the opening would play, and hand off, under the splash (the "mo" then held, cut to the
  /// first screen, and faded over it as a ghost).
  static const double _glassCap = 10000;

  static final ThemeData _dark = buildTheme(Brightness.dark);

  /// Milliseconds since the first build, with no end: a slow start can never run it out before
  /// the opening has played.
  late final AnimationController _clock = AnimationController.unbounded(
    vsync: this,
    animationBehavior: AnimationBehavior.preserve,
  );
  late final AnimationController _fade = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: OpeningTimeline.fadeMs.round()),
    animationBehavior: AnimationBehavior.preserve,
  );
  late final CurvedAnimation _wordOut = CurvedAnimation(
    parent: _fade,
    curve: const Interval(0, OpeningTimeline.wordOutMs / OpeningTimeline.fadeMs, curve: Motion.exit),
  );
  late final CurvedAnimation _groundOut = CurvedAnimation(
    parent: _fade,
    curve: const Interval(OpeningTimeline.groundOutFrom / OpeningTimeline.fadeMs, 1, curve: Motion.sweepCurve),
  );
  late final Animation<double> _wordShown = ReverseAnimation(_wordOut);
  late final Animation<double> _groundShown = ReverseAnimation(_groundOut);

  bool _reduced = false;
  bool _started = false;
  bool _buzzed = false;
  bool _prepainted = false;
  bool _fading = false;
  bool _done = false;
  double? _readyAt;

  /// [_clock] runs from the first build (so frames keep coming under the splash); [_seenAt] is
  /// its value when the "mo" reached the glass. Timeline time is measured from there.
  double? _seenAt;

  double get _now {
    final c = _clock.value;
    final seen = _seenAt ?? math.min(c, _glassCap);
    return math.max(0.0, c - seen);
  }

  /// Whether the platform said the "mo" is on the glass and its splash is gone (not just the
  /// [_glassCap] net, and not a release that timed out).
  bool _confirmed = false;

  /// The "mo" is on the glass. [answered] is false when the platform did not say its splash is
  /// gone (a release that timed out): the timeline still starts, but the hand-off lifts the
  /// splash itself.
  void _markSeen({bool answered = true}) {
    if (!mounted) return;
    if (answered) _confirmed = true;
    // A late answer after the net started the timeline restarts it from the "mo", which is what
    // has been on the glass, unless the hand-off has begun.
    if (_seenAt != null || _fading) return;
    _seenAt = _clock.value;
  }

  /// Runs the unfold's poses and paint once, off screen, while the splash still covers the "mo",
  /// so a slow phone (or a debug build compiling them) does not pay for it in the unfold's own
  /// frames.
  void _warmUp() {
    if (_reduced || !mounted) return;
    final size = MediaQuery.sizeOf(context);
    final dpr = MediaQuery.devicePixelRatioOf(context);
    if (size.isEmpty) return;
    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);
    for (var t = OpeningTimeline.expandAt; t <= OpeningTimeline.settledAt; t += 100) {
      BrandLogoPainter.paintPose(
        canvas,
        size,
        OpeningTimeline.poseAt(t, size, devicePixelRatio: dpr),
        form: BrandLogoForm.wordmark,
        letterColor: LogoGeometry.warmWhite,
        devicePixelRatio: dpr,
      );
    }
    recorder.endRecording().dispose();
  }

  double get _t => widget.progress != null ? widget.progress!.clamp(0.0, 1.0) * OpeningTimeline.settledAt : _now;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (widget.progress != null) return;
    _readReduced();
    if (_started) return;
    _started = true;
    if (widget.ready) _readyAt = 0;
    _clock.addListener(_tick);
    _fade.addStatusListener((s) {
      if (s == AnimationStatus.completed) _finish();
    });
    final shown = widget.shown;
    final Future<bool> answered = shown != null ? shown.then((_) => true) : OpeningGlass.wait();
    unawaited(answered.then((ok) => _markSeen(answered: ok), onError: (Object _) => _markSeen(answered: false)));
    // After the first frame, still under the splash.
    WidgetsBinding.instance.addPostFrameCallback((_) => _warmUp());
    unawaited(_clock.animateWith(_Stopwatch()));
  }

  /// Reads reduced motion, again whenever it changes until the "mo" starts to move: the saved
  /// in-app setting is read from storage after the first frame, so it lands after the opening
  /// has started. Before the "mo" is on the glass it simply takes effect. Turning it on during
  /// the hold restarts the timeline from the "mo" it shows; after that the unfold is left to
  /// finish (and turning it off again after the start keeps the short version), so nothing jumps.
  void _readReduced() {
    final reduced = Motion.reduced(context);
    if (reduced == _reduced || _fading) return;
    if (_seenAt != null) {
      if (!reduced || _now >= OpeningTimeline.expandAt) return;
      _seenAt = _clock.value;
      if (_readyAt != null) _readyAt = 0;
    }
    _reduced = reduced;
    _fade.duration = Duration(
      milliseconds: (reduced ? OpeningTimeline.reducedFadeMs : OpeningTimeline.fadeMs).round(),
    );
  }

  @override
  void didUpdateWidget(BrandOpening old) {
    super.didUpdateWidget(old);
    // Only noted here; the next tick decides (a hand-off from here would set the host's state
    // during its build).
    if (widget.ready && _readyAt == null && widget.progress == null) _readyAt = _now;
  }

  double get _settledAt => _reduced ? OpeningTimeline.reducedMs : OpeningTimeline.settledAt;

  void _tick() {
    final t = _now;
    // Once, as the bubble eye inks (a skip sets _buzzed, so a skipped opening stays quiet).
    if (!_reduced && !_buzzed && t >= OpeningTimeline.hapticAt) {
      _buzzed = true;
      unawaited(ref.read(hapticsProvider).light().catchError((Object _) {}));
    }
    if (_fading) return;
    final readyAt = _readyAt;
    // A late "ready" waits a moment more, so the first screen has painted under the cover.
    final goAt = math.min(
      OpeningTimeline.maxMs,
      readyAt == null ? double.infinity : math.max(_settledAt, readyAt + OpeningTimeline.prepaintLead),
    );
    if (t >= goAt - OpeningTimeline.prepaintLead) _prepaint();
    if (t >= goAt) _handOff();
  }

  /// A tap: hand off now if the app is ready or the word is already composed, else jump to the
  /// composed word (a second tap then hands off).
  void _skip() {
    if (_done || widget.progress != null) return;
    _buzzed = true;
    if (_readyAt != null || _now >= _settledAt) {
      // Not ready yet past the word: the app is on its launch screen, which is this opening's
      // last frame, so the hand-off moves nothing and the tap is never dead.
      _handOff();
    } else {
      _seenAt = _clock.value - _settledAt;
    }
  }

  void _prepaint() {
    if (_prepainted) return;
    _prepainted = true;
    widget.onPrepaint?.call();
  }

  void _handOff() {
    if (_fading) return;
    _prepaint();
    _fading = true;
    // Only after the net, or a release Android never answered: it has not said its splash is
    // gone, so take it off at once rather than let its "mo" fade over the first screen.
    if (!_confirmed) unawaited(OpeningGlass.liftNow());
    widget.onReveal?.call();
    // Hands the status bar icons to the first screen.
    setState(() {});
    _fade.forward();
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
    _wordOut.dispose();
    _groundOut.dispose();
    _fade.dispose();
    super.dispose();
  }

  static SystemUiOverlayStyle _bars(Brightness icons) => SystemUiOverlayStyle(
        statusBarColor: const Color(0x00000000),
        statusBarIconBrightness: icons,
        systemNavigationBarColor: const Color(0x00000000),
        systemNavigationBarIconBrightness: icons,
        systemStatusBarContrastEnforced: false,
        systemNavigationBarContrastEnforced: false,
      );

  @override
  Widget build(BuildContext context) {
    final appIsDark = Theme.of(context).brightness == Brightness.dark;
    final frozen = widget.progress != null;
    final Animation<double> lamp = frozen
        ? AlwaysStoppedAnimation(OpeningTimeline.lamp(_t))
        : _clock.drive(_ByTime((_) => _reduced ? OpeningTimeline.reducedLamp(_now) : OpeningTimeline.lamp(_now)));
    return Theme(
      data: _dark,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        // Light icons on the charcoal; once fading, the first screen's.
        value: _bars(_fading && !appIsDark ? Brightness.dark : Brightness.light),
        child: Semantics(
          button: true,
          label: 'MockMob',
          hint: 'Tap to skip',
          onTap: _skip,
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: _skip,
            child: Stack(
              fit: StackFit.expand,
              children: [
                FadeTransition(
                  opacity: _groundShown,
                  child: ColoredBox(
                    color: MmColors.dark.ground,
                    child: FadeTransition(
                      opacity: lamp,
                      child: Builder(builder: (context) => LightField.lamp(context, strength: 0.7)),
                    ),
                  ),
                ),
                FadeTransition(
                  opacity: _wordShown,
                  child: RepaintBoundary(
                    child: CustomPaint(
                      painter: _OpeningPainter(
                        clock: _clock,
                        time: () => _t,
                        frozenAt: frozen ? _t : null,
                        reduced: _reduced && !frozen,
                        devicePixelRatio: MediaQuery.devicePixelRatioOf(context),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Milliseconds since it started, for ever.
class _Stopwatch extends Simulation {
  @override
  double x(double time) => time * 1000;

  @override
  double dx(double time) => 1000;

  @override
  bool isDone(double time) => false;
}

class _ByTime extends Animatable<double> {
  const _ByTime(this.f);

  final double Function(double t) f;

  @override
  double transform(double t) => f(t);
}

class _OpeningPainter extends CustomPainter {
  _OpeningPainter({
    required Listenable clock,
    required this.time,
    required this.frozenAt,
    required this.reduced,
    required this.devicePixelRatio,
  }) : super(repaint: clock);

  final double Function() time;
  final double? frozenAt;
  final bool reduced;
  final double devicePixelRatio;

  void _paint(Canvas canvas, Size size, LogoPose pose, {double opacity = 1}) => BrandLogoPainter.paintPose(
        canvas,
        size,
        opacity >= 1 ? pose : _faded(pose, opacity),
        form: BrandLogoForm.wordmark,
        letterColor: LogoGeometry.warmWhite.withValues(alpha: opacity),
        devicePixelRatio: devicePixelRatio,
      );

  /// [pose] at [opacity]: the letters through their colour, Mobi through its own (bounded)
  /// layer, so no full-screen layer is needed.
  static LogoPose _faded(LogoPose pose, double opacity) => LogoPose(
        view: pose.view,
        mobi: pose.mobi,
        glyphs: [
          for (var i = 0; i < LogoGeometry.word.length; i++)
            i == LogoGeometry.mobiIndex
                ? LogoGlyphPose(opacity: opacity * pose.glyph(i).opacity)
                : pose.glyph(i),
        ],
      );

  @override
  void paint(Canvas canvas, Size size) {
    final t = time();
    if (!reduced) {
      _paint(canvas, size, OpeningTimeline.poseAt(t, size, devicePixelRatio: devicePixelRatio));
      return;
    }
    // One, then the other: the "mo" fades out, then the word fades in, so two sizes of the logo
    // never show at once.
    const half = OpeningTimeline.reducedMs / 2;
    final out = 1 - Motion.glide.transform((t / half).clamp(0.0, 1.0));
    final into = Motion.glide.transform(((t - half) / half).clamp(0.0, 1.0));
    if (out > 0) _paint(canvas, size, OpeningTimeline.moPose(size, devicePixelRatio: devicePixelRatio), opacity: out);
    if (into > 0) _paint(canvas, size, OpeningTimeline.wordPose(size), opacity: into);
  }

  @override
  bool shouldRepaint(_OpeningPainter old) =>
      old.reduced != reduced || old.devicePixelRatio != devicePixelRatio || old.frozenAt != frozenAt;
}

/// Lays the brand opening over the app on every cold start and removes it when it is done. The
/// app underneath builds and routes as usual; it is hidden from screen readers until then.
class BrandOpeningHost extends ConsumerStatefulWidget {
  const BrandOpeningHost({super.key, required this.child, this.shown});

  final Widget child;

  /// Passed to [BrandOpening.shown] (tests).
  final Future<void>? shown;

  @override
  ConsumerState<BrandOpeningHost> createState() => _BrandOpeningHostState();
}

class _BrandOpeningHostState extends ConsumerState<BrandOpeningHost> {
  bool _showing = true;

  /// The opening is opaque until just before it fades, so the app underneath is not painted
  /// until then ([_painted]), and its tickers are muted until the fade starts ([_live]): on a
  /// budget phone the opening's frames cost only the logo, the first screen's first frame is
  /// paid while it is still covered, and its own entrance plays as it is revealed. The app
  /// still builds, lays out and routes throughout.
  bool _painted = false;
  bool _live = false;

  @override
  Widget build(BuildContext context) {
    // A load that failed is settled too: the router shows its retry screen, so hand off to it.
    final ready = ref.watch(authSnapshotProvider.select((a) => a.status != AuthStatus.unknown || a.loadFailed));
    return Stack(
      fit: StackFit.expand,
      children: [
        ExcludeSemantics(
          excluding: _showing,
          child: Offstage(offstage: !_painted, child: TickerMode(enabled: _live, child: widget.child)),
        ),
        if (_showing)
          BrandOpening(
            ready: ready,
            shown: widget.shown,
            onPrepaint: () => setState(() => _painted = true),
            onReveal: () => setState(() => _live = true),
            onDone: () => setState(() => _showing = false),
          ),
      ],
    );
  }
}
