import 'dart:math' as math;
import 'dart:ui' show FramePhase, FrameTiming, PlatformDispatcher;

import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart' show MethodChannel;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../platform/device_corner.dart';
import '../storage/app_prefs.dart';
import '../storage/storage_providers.dart';
import '../widgets/materials/glass_shader.dart';

/// How glass is drawn (brief section 5), chosen in You > Appearance. This setting is also the
/// app's Reduce Transparency (Android has no system flag for it): Off is solid with hairlines.
enum GlassQuality {
  /// Live glass: the lens where the phone can run it, otherwise blur and a thicker tint.
  full,

  /// Tint plus edge light, no live blur.
  lite,

  /// Solid surfaces.
  off;

  static GlassQuality? parse(String? raw) => values.asNameMap()[raw];
}

/// The glass actually drawn (GLASS-1017 section 5.1): the student's [GlassQuality] after the
/// phone's abilities and its accessibility settings.
enum GlassTier {
  /// The lens: rim bend, core blur and the luminosity clamp (`mm_glass.frag`).
  full,

  /// Full without the shader: blur, a 1.15 saturation lift and a thicker tint, no rim bend.
  fullBasic,

  /// No live blur: a dense tint with grain.
  lite,

  /// Solid, with a hairline.
  off;

  /// True for the two tiers that read the backdrop live.
  bool get live => this == full || this == fullBasic;

  /// The tier for [quality] on a phone where the lens is [shaderReady], with high-contrast text
  /// [highContrast] (which forces Off: section 5.11).
  static GlassTier resolve(GlassQuality quality, {required bool shaderReady, bool highContrast = false}) {
    if (highContrast) return GlassTier.off;
    return switch (quality) {
      GlassQuality.full => shaderReady ? GlassTier.full : GlassTier.fullBasic,
      GlassQuality.lite => GlassTier.lite,
      GlassQuality.off => GlassTier.off,
    };
  }
}

/// The automatic steps the app takes by itself when a phone cannot keep up with the glass (D57,
/// 18 Oct). They never touch the student's choice and are not saved: each launch starts on the
/// choice again and [GlassPerformanceWatch] re-decides.
///
/// v14 had one step, Full straight to the dense Lite tint, at a budget of 90% of the display's
/// frame. On a 120 Hz phone that is 7.5 ms of raster, which the live blur misses on most mid-range
/// phones within seconds of scrolling, so the owner's phone showed an opaque pill and "no frost".
/// Now the lens goes first, and the frost itself goes only on a phone that cannot hold 60 fps.
enum GlassStep {
  /// As chosen.
  none,

  /// The lens is dropped; the plain frost (live blur, no rim bend) stays.
  noLens,

  /// No live blur: the Lite tint. Android Go class phones start here.
  lite;

  /// The raster p90 the frost may use before it gives way to Lite: 90% of a 60 Hz frame. A
  /// phone that holds 60 fps keeps the frost whatever its refresh rate.
  static const Duration frostBudget = Duration(microseconds: 15000);

  /// The budget that moves this step on, for a display at [hz] with the lens [lensRunning]. The
  /// lens is held to the display's own frame ([RasterBudgetMonitor.thresholdFor]); the frost to
  /// [frostBudget], or to the display's frame on a screen slower than 60 Hz.
  Duration budget({required bool lensRunning, required double hz}) {
    if (this == none && lensRunning) return RasterBudgetMonitor.thresholdFor(hz);
    if (hz <= 0) return frostBudget;
    final display = Duration(microseconds: (0.9 * 1000000 / hz).round());
    return display > frostBudget ? display : frostBudget;
  }

  /// The step after a missed [budget]: the lens first when it runs, then Lite. Lite is the last.
  GlassStep next({required bool lensRunning}) => switch (this) {
    none => lensRunning ? noLens : lite,
    noLens || lite => lite,
  };
}

/// The saved glass settings, read before `runApp` so a saved Lite or Off is right on the first
/// frame instead of flipping from Full after it.
class GlassBoot {
  const GlassBoot({this.chosen = GlassQuality.full, this.autoLite = false, this.emulator = false});

  final GlassQuality chosen;
  final bool autoLite;

  /// The app runs on an Android emulator. Its software GPU misses the raster budget whatever
  /// glass is drawn, so [GlassPerformanceWatch] does not run there (v14: the emulator is the
  /// owner's test phone, and a watch trip left it on Lite, the near-opaque bar of the v13 walk).
  final bool emulator;

  static Future<GlassBoot> read(
    AppPrefs prefs, {
    Future<bool> Function()? lowMemory,
    Future<bool> Function()? emulator,
  }) async {
    // The lens program loads alongside the preferences, so the first frame is already the right
    // tier (no flip from the basic glass to the lens). It never throws.
    final shader = (GlassShader.load(), DeviceCorner.load()).wait;
    final onEmulator = (emulator ?? deviceIsEmulator)();
    try {
      // Both reads start together: each is a round trip to the platform before the first frame.
      final (savedRaw, savedAuto) = await (prefs.glassQuality(), prefs.glassAutoLite()).wait;
      final saved = GlassQuality.parse(savedRaw);
      var auto = savedAuto;
      // First launch, nothing chosen yet: an Android Go class phone starts on Lite, as the
      // automatic step, never as the student's choice.
      if (saved == null && !auto && await (lowMemory ?? deviceHasLowMemory)()) {
        auto = true;
        await prefs.setGlassAutoLite(true);
      }
      await shader;
      return GlassBoot(chosen: saved ?? GlassQuality.full, autoLite: auto, emulator: await onEmulator);
    } on Object {
      await shader;
      return GlassBoot(emulator: await onEmulator.catchError((Object _) => false));
    }
  }
}

/// True on an Android phone that reports itself as a low-RAM device (Android Go class, about
/// 1 to 2 GB). False anywhere it cannot tell.
///
/// Memory size alone no longer starts a phone on Lite (v13 device walk): the old rule (under
/// 4.5 GB in all) put most students' 3 to 4 GB phones, and the test emulator, on the dense tint,
/// so the bar read as a flat opaque pill and the glass the owner asked for was never seen.
/// Whether glass is too slow is measured instead: [GlassPerformanceWatch] steps Full down to
/// Lite once the raster thread keeps missing its budget while scrolling.
Future<bool> deviceHasLowMemory() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return false;
  try {
    final info = await const MethodChannel('in.mockmob.app/device').invokeMapMethod<String, Object?>('memory');
    if (info == null) return false;
    return info['lowRam'] == true;
  } on Object {
    return false;
  }
}

/// True on an Android emulator (the `in.mockmob.app/device` channel's `emulator` flag: a
/// `ranchu` or `goldfish` board, or a `generic` build). False anywhere it cannot tell.
Future<bool> deviceIsEmulator() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return false;
  try {
    final info = await const MethodChannel('in.mockmob.app/device').invokeMapMethod<String, Object?>('memory');
    return info?['emulator'] == true;
  } on Object {
    return false;
  }
}

/// Overridden in `main.dart` with [GlassBoot.read]. Null (tests, the lab) loads lazily.
final glassBootProvider = Provider<GlassBoot?>((ref) => null);

/// The glass quality in effect: the student's choice, except for the automatic [GlassStep]s
/// [GlassPerformanceWatch] takes on a slow phone (the lens first, then Lite). The automatic step
/// is kept apart from the choice; choosing any quality clears it.
class GlassQualitySetting extends Notifier<GlassQuality> {
  GlassQuality _chosen = GlassQuality.full;
  GlassStep _step = GlassStep.none;

  /// What the student picked in Appearance.
  GlassQuality get chosen => _chosen;

  /// The automatic step in effect (always [GlassStep.none] unless Full was chosen).
  GlassStep get step => _chosen == GlassQuality.full ? _step : GlassStep.none;

  /// True while Full was chosen but the app switched to Lite to keep scrolling smooth.
  bool get autoLite => step == GlassStep.lite;

  /// True while the app has dropped the lens by itself (the frost stays until [autoLite]).
  bool get lensSuspended => step != GlassStep.none;

  GlassQuality get _effective => autoLite ? GlassQuality.lite : _chosen;

  @override
  GlassQuality build() {
    final boot = ref.read(glassBootProvider);
    if (boot != null) {
      _chosen = boot.chosen;
      _step = boot.autoLite ? GlassStep.lite : GlassStep.none;
      return _effective;
    }
    _load();
    return GlassQuality.full;
  }

  Future<void> _load() async {
    final GlassBoot boot;
    try {
      boot = await GlassBoot.read(ref.read(appPrefsProvider));
    } on Object {
      return; // Preferences are a convenience; keep Full.
    }
    if (!ref.mounted) return;
    _chosen = boot.chosen;
    _step = boot.autoLite ? GlassStep.lite : GlassStep.none;
    state = _effective;
  }

  Future<void> choose(GlassQuality quality) async {
    final before = state;
    final suspended = lensSuspended;
    _chosen = quality;
    _step = GlassStep.none;
    state = _effective;
    // Lite chosen while already on automatic Lite, or Full again after the lens was dropped: the
    // state is the same, the choice (or the lens) is not.
    if (state == before || suspended) ref.notifyListeners();
    try {
      final prefs = ref.read(appPrefsProvider);
      await prefs.setGlassQuality(quality.name);
      await prefs.setGlassAutoLite(false);
    } on Object {
      // Applies for this run even if it cannot be kept.
    }
  }

  /// One automatic step down from Full, for this run ([GlassStep.next]); never touches a choice
  /// of Lite or Off.
  ///
  /// Not saved (v14): a trip once stuck for good, so one slow scroll (or the emulator's software
  /// GPU) put the bar on the dense Lite tint for every launch after, which the owner saw as an
  /// opaque pill. Each launch starts on the student's choice again and the watch re-decides.
  void stepDown({required bool lensRunning}) {
    if (_chosen != GlassQuality.full || _step == GlassStep.lite) return;
    final before = state;
    _step = _step.next(lensRunning: lensRunning);
    state = _effective;
    // Dropping the lens keeps Full: the lens flag still needs to hear it.
    if (state == before) ref.notifyListeners();
  }

  /// Full straight to Lite, for this run; never touches a choice of Lite or Off.
  Future<void> downgrade() async {
    if (_chosen != GlassQuality.full || _step == GlassStep.lite) return;
    _step = GlassStep.lite;
    state = _effective;
  }
}

/// False while the app has dropped the lens by itself ([GlassStep.noLens] or further); the frost
/// stays. The root `GlassScope` passes it down.
final glassLensAllowedProvider = Provider<bool>((ref) {
  ref.watch(glassQualityProvider);
  return !ref.read(glassQualityProvider.notifier).lensSuspended;
});

final glassQualityProvider = NotifierProvider<GlassQualitySetting, GlassQuality>(GlassQualitySetting.new);

/// Publishes the glass quality to the widget tree, so glass widgets need no Riverpod and render
/// Full in isolation (goldens, the lab).
///
/// High-contrast text on the phone (`MediaQuery.highContrast`) forces Off everywhere, whatever
/// was chosen (GLASS-1017 section 5.11): solid surfaces with stronger hairlines.
class GlassScope extends InheritedWidget {
  const GlassScope({super.key, required this.quality, this.lens = true, required super.child});

  final GlassQuality quality;

  /// False while the app has dropped the lens by itself on a slow phone ([GlassStep.noLens]).
  final bool lens;

  /// Whether the lens may run under [context] (the phone and the build decide whether it can).
  static bool lensOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<GlassScope>()?.lens ?? true;

  /// The quality in effect: the inherited choice, or Off under high contrast.
  static GlassQuality of(BuildContext context) {
    if (MediaQuery.maybeHighContrastOf(context) ?? false) return GlassQuality.off;
    return context.dependOnInheritedWidgetOfExactType<GlassScope>()?.quality ?? GlassQuality.full;
  }

  /// The tier drawn: [of], with the lens when [GlassShader.ready]. [quality] overrides the
  /// inherited choice (the lab and goldens), never high contrast.
  static GlassTier tierOf(BuildContext context, {GlassQuality? quality}) {
    final highContrast = MediaQuery.maybeHighContrastOf(context) ?? false;
    return GlassTier.resolve(quality ?? of(context), shaderReady: GlassShader.ready && lensOf(context), highContrast: highContrast);
  }

  @override
  bool updateShouldNotify(GlassScope oldWidget) => quality != oldWidget.quality || lens != oldWidget.lens;
}

/// What the raster watch needs to know about the screen: whether the student is scrolling and
/// whether any live (Full) glass is on screen. Frames outside both are not glass's fault.
abstract final class GlassActivity {
  static int _liveGlass = 0;

  /// True while a user scroll is in progress (set by the app shell).
  static bool userScrolling = false;

  static bool get liveGlassMounted => _liveGlass > 0;

  static void glassMounted() => _liveGlass++;
  static void glassUnmounted() => _liveGlass = math.max(0, _liveGlass - 1);
}

/// Watches frame timings and reports when the raster thread keeps missing its budget: the 90th
/// percentile raster time over [threshold] across about [window] of continuous rendering.
///
/// Slow phones are the ones that most need help, so the watch works at any frame rate: it needs
/// [minFrames] frames, keeps at least [window] of them (longer when frames are slow), and only an
/// idle gap longer than both 250 ms and three typical raster times resets it.
class RasterBudgetMonitor {
  RasterBudgetMonitor({
    this.threshold = const Duration(milliseconds: 12),
    this.window = const Duration(seconds: 2),
    this.minFrames = 20,
  });

  final Duration threshold;
  final Duration window;
  final int minFrames;

  final List<(int, int)> _frames = []; // (end time in microseconds, raster microseconds)

  /// The budget for a display refreshing at [hz]: 12 ms, or less on a faster screen.
  static Duration thresholdFor(double hz) {
    if (hz <= 0) return const Duration(milliseconds: 12);
    final ninety = (0.9 * 1000000 / hz).round();
    return Duration(microseconds: math.min(12000, ninety));
  }

  /// Adds one frame; returns true when the budget has been missed for the whole window.
  bool add({required int endMicros, required int rasterMicros}) {
    if (_frames.isNotEmpty) {
      final idle = math.max(250000, 3 * _median());
      if (endMicros - _frames.last.$1 > idle) _frames.clear();
    }
    _frames.add((endMicros, rasterMicros));
    // Keep the window, stretched to hold [minFrames] frames on a slow phone.
    final span = math.max(window.inMicroseconds, minFrames * _medianInterval());
    while (_frames.length > minFrames && _frames.first.$1 < endMicros - span) {
      _frames.removeAt(0);
    }
    if (_frames.length < minFrames) return false;
    if (_frames.last.$1 - _frames.first.$1 < window.inMicroseconds * 0.9) return false;
    return p90() > threshold.inMicroseconds;
  }

  int p90() {
    if (_frames.isEmpty) return 0;
    final sorted = [for (final f in _frames) f.$2]..sort();
    return sorted[((sorted.length - 1) * 0.9).round()];
  }

  int _median() {
    final sorted = [for (final f in _frames) f.$2]..sort();
    return sorted[sorted.length ~/ 2];
  }

  int _medianInterval() {
    if (_frames.length < 2) return 0;
    final gaps = [for (var i = 1; i < _frames.length; i++) _frames[i].$1 - _frames[i - 1].$1]..sort();
    return gaps[gaps.length ~/ 2];
  }

  void reset() => _frames.clear();
}

/// Steps glass down ([GlassStep]) when [RasterBudgetMonitor] fires during a user scroll with live
/// glass on screen: the lens first (held to the display's frame), then the frost (held to a 60 Hz
/// frame, [GlassStep.frostBudget]). Runs in release and profile builds only: a debug engine is
/// slower and would switch for the wrong reason. Watch [glassPerformanceWatchProvider] once near
/// the root.
class GlassPerformanceWatch {
  GlassPerformanceWatch(this._ref, {this.hz = 60, bool Function()? lensReady})
    : _lensReady = lensReady ?? (() => GlassShader.barReady);

  final Ref _ref;

  /// The display's refresh rate.
  final double hz;
  final bool Function() _lensReady;
  RasterBudgetMonitor _monitor = RasterBudgetMonitor();

  void start() => SchedulerBinding.instance.addTimingsCallback(_onTimings);

  void stop() => SchedulerBinding.instance.removeTimingsCallback(_onTimings);

  void _onTimings(List<FrameTiming> timings) {
    final setting = _ref.read(glassQualityProvider.notifier);
    if (setting.chosen != GlassQuality.full || setting.step == GlassStep.lite) return;
    if (!GlassActivity.userScrolling || !GlassActivity.liveGlassMounted) {
      _monitor.reset();
      return;
    }
    final lens = _lensReady() && setting.step == GlassStep.none;
    final budget = setting.step.budget(lensRunning: lens, hz: hz);
    if (_monitor.threshold != budget) _monitor = RasterBudgetMonitor(threshold: budget);
    for (final t in timings) {
      final end = t.timestampInMicroseconds(FramePhase.rasterFinish);
      if (_monitor.add(endMicros: end, rasterMicros: t.rasterDuration.inMicroseconds)) {
        _monitor.reset();
        setting.stepDown(lensRunning: lens);
        return;
      }
    }
  }
}

final glassPerformanceWatchProvider = Provider<GlassPerformanceWatch?>((ref) {
  if (!(kReleaseMode || kProfileMode)) return null;
  if (ref.read(glassBootProvider)?.emulator ?? false) return null;
  final views = PlatformDispatcher.instance.views;
  final hz = views.isEmpty ? 60.0 : views.first.display.refreshRate;
  final watch = GlassPerformanceWatch(ref, hz: hz)..start();
  ref.onDispose(watch.stop);
  return watch;
});
