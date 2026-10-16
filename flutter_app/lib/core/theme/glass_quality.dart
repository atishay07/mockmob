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

/// The saved glass settings, read before `runApp` so a saved Lite or Off is right on the first
/// frame instead of flipping from Full after it.
class GlassBoot {
  const GlassBoot({this.chosen = GlassQuality.full, this.autoLite = false});

  final GlassQuality chosen;
  final bool autoLite;

  static Future<GlassBoot> read(AppPrefs prefs, {Future<bool> Function()? lowMemory}) async {
    // The lens program loads alongside the preferences, so the first frame is already the right
    // tier (no flip from the basic glass to the lens). It never throws.
    final shader = (GlassShader.load(), DeviceCorner.load()).wait;
    try {
      // Both reads start together: each is a round trip to the platform before the first frame.
      final (savedRaw, savedAuto) = await (prefs.glassQuality(), prefs.glassAutoLite()).wait;
      final saved = GlassQuality.parse(savedRaw);
      var auto = savedAuto;
      // First launch, nothing chosen yet: a phone with little memory (a weak GPU with it)
      // starts on Lite, as the automatic step, never as the student's choice.
      if (saved == null && !auto && await (lowMemory ?? deviceHasLowMemory)()) {
        auto = true;
        await prefs.setGlassAutoLite(true);
      }
      await shader;
      return GlassBoot(chosen: saved ?? GlassQuality.full, autoLite: auto);
    } on Object {
      await shader;
      return const GlassBoot();
    }
  }
}

/// True on an Android phone that reports itself low on RAM or has under 4.5 GB in all (the
/// 3 to 4 GB MediaTek phones many students use). False anywhere it cannot tell.
Future<bool> deviceHasLowMemory() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return false;
  try {
    final info = await const MethodChannel('in.mockmob.app/device').invokeMapMethod<String, Object?>('memory');
    if (info == null) return false;
    final total = info['totalMb'];
    return info['lowRam'] == true || (total is int && total > 0 && total < 4500);
  } on Object {
    return false;
  }
}

/// Overridden in `main.dart` with [GlassBoot.read]. Null (tests, the lab) loads lazily.
final glassBootProvider = Provider<GlassBoot?>((ref) => null);

/// The glass quality in effect: the student's choice, except that Full can be stepped down to
/// Lite automatically by [GlassPerformanceWatch]. The automatic step is stored on its own, never
/// as the student's choice; choosing any quality clears it.
class GlassQualitySetting extends Notifier<GlassQuality> {
  GlassQuality _chosen = GlassQuality.full;
  bool _auto = false;

  /// What the student picked in Appearance.
  GlassQuality get chosen => _chosen;

  /// True while Full was chosen but the app switched to Lite to keep scrolling smooth.
  bool get autoLite => _auto && _chosen == GlassQuality.full;

  GlassQuality get _effective => autoLite ? GlassQuality.lite : _chosen;

  @override
  GlassQuality build() {
    final boot = ref.read(glassBootProvider);
    if (boot != null) {
      _chosen = boot.chosen;
      _auto = boot.autoLite;
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
    _auto = boot.autoLite;
    state = _effective;
  }

  Future<void> choose(GlassQuality quality) async {
    final before = state;
    _chosen = quality;
    _auto = false;
    state = _effective;
    // Lite chosen while already on automatic Lite: the state is the same, the choice is not.
    if (state == before) ref.notifyListeners();
    try {
      final prefs = ref.read(appPrefsProvider);
      await prefs.setGlassQuality(quality.name);
      await prefs.setGlassAutoLite(false);
    } on Object {
      // Applies for this run even if it cannot be kept.
    }
  }

  /// Full to Lite only; never touches a choice of Lite or Off.
  Future<void> downgrade() async {
    if (_chosen != GlassQuality.full || _auto) return;
    _auto = true;
    state = _effective;
    try {
      await ref.read(appPrefsProvider).setGlassAutoLite(true);
    } on Object {
      // Applies for this run.
    }
  }
}

final glassQualityProvider = NotifierProvider<GlassQualitySetting, GlassQuality>(GlassQualitySetting.new);

/// Publishes the glass quality to the widget tree, so glass widgets need no Riverpod and render
/// Full in isolation (goldens, the lab).
///
/// High-contrast text on the phone (`MediaQuery.highContrast`) forces Off everywhere, whatever
/// was chosen (GLASS-1017 section 5.11): solid surfaces with stronger hairlines.
class GlassScope extends InheritedWidget {
  const GlassScope({super.key, required this.quality, required super.child});

  final GlassQuality quality;

  /// The quality in effect: the inherited choice, or Off under high contrast.
  static GlassQuality of(BuildContext context) {
    if (MediaQuery.maybeHighContrastOf(context) ?? false) return GlassQuality.off;
    return context.dependOnInheritedWidgetOfExactType<GlassScope>()?.quality ?? GlassQuality.full;
  }

  /// The tier drawn: [of], with the lens when [GlassShader.ready]. [quality] overrides the
  /// inherited choice (the lab and goldens), never high contrast.
  static GlassTier tierOf(BuildContext context, {GlassQuality? quality}) {
    final highContrast = MediaQuery.maybeHighContrastOf(context) ?? false;
    return GlassTier.resolve(quality ?? of(context), shaderReady: GlassShader.ready, highContrast: highContrast);
  }

  @override
  bool updateShouldNotify(GlassScope oldWidget) => quality != oldWidget.quality;
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

/// Steps glass from Full to Lite once when [RasterBudgetMonitor] fires during a user scroll with
/// live glass on screen. Runs in release and profile builds only: a debug engine is slower and
/// would switch for the wrong reason. Watch [glassPerformanceWatchProvider] once near the root.
class GlassPerformanceWatch {
  GlassPerformanceWatch(this._ref, {Duration? threshold})
    : _monitor = RasterBudgetMonitor(threshold: threshold ?? const Duration(milliseconds: 12));

  final Ref _ref;
  final RasterBudgetMonitor _monitor;
  bool _fired = false;

  void start() => SchedulerBinding.instance.addTimingsCallback(_onTimings);

  void stop() => SchedulerBinding.instance.removeTimingsCallback(_onTimings);

  void _onTimings(List<FrameTiming> timings) {
    if (_fired || _ref.read(glassQualityProvider) != GlassQuality.full) return;
    if (!GlassActivity.userScrolling || !GlassActivity.liveGlassMounted) {
      _monitor.reset();
      return;
    }
    for (final t in timings) {
      final end = t.timestampInMicroseconds(FramePhase.rasterFinish);
      if (_monitor.add(endMicros: end, rasterMicros: t.rasterDuration.inMicroseconds)) {
        _fired = true;
        _ref.read(glassQualityProvider.notifier).downgrade();
        return;
      }
    }
  }
}

final glassPerformanceWatchProvider = Provider<GlassPerformanceWatch?>((ref) {
  if (!(kReleaseMode || kProfileMode)) return null;
  final views = PlatformDispatcher.instance.views;
  final hz = views.isEmpty ? 60.0 : views.first.display.refreshRate;
  final watch = GlassPerformanceWatch(ref, threshold: RasterBudgetMonitor.thresholdFor(hz))..start();
  ref.onDispose(watch.stop);
  return watch;
});
