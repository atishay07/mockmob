import 'dart:ui' show FramePhase, FrameTiming;

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/storage_providers.dart';

/// How glass is drawn (brief section 5), chosen in You > Appearance.
enum GlassQuality {
  /// Live backdrop blur on the dock, Start and sheets.
  full,

  /// Tint plus edge light, no live blur.
  lite,

  /// Solid surfaces.
  off;

  static GlassQuality? parse(String? raw) => values.asNameMap()[raw];
}

/// The saved glass quality. Starts at Full, loads the saved choice, and accepts one automatic
/// step down to Lite from [GlassPerformanceWatch].
class GlassQualitySetting extends Notifier<GlassQuality> {
  @override
  GlassQuality build() {
    _load();
    return GlassQuality.full;
  }

  Future<void> _load() async {
    try {
      final saved = GlassQuality.parse(await ref.read(appPrefsProvider).glassQuality());
      if (saved != null && ref.mounted) state = saved;
    } on Object {
      // Preferences are a convenience; keep Full.
    }
  }

  Future<void> choose(GlassQuality quality) async {
    state = quality;
    try {
      await ref.read(appPrefsProvider).setGlassQuality(quality.name);
    } on Object {
      // Applies for this run even if it cannot be kept.
    }
  }

  /// Full to Lite only; never touches a choice of Lite or Off.
  Future<void> downgrade() async {
    if (state == GlassQuality.full) await choose(GlassQuality.lite);
  }
}

final glassQualityProvider = NotifierProvider<GlassQualitySetting, GlassQuality>(GlassQualitySetting.new);

/// Publishes the glass quality to the widget tree, so glass widgets need no Riverpod and render
/// Full in isolation (goldens, the lab).
class GlassScope extends InheritedWidget {
  const GlassScope({super.key, required this.quality, required super.child});

  final GlassQuality quality;

  static GlassQuality of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<GlassScope>()?.quality ?? GlassQuality.full;

  @override
  bool updateShouldNotify(GlassScope oldWidget) => quality != oldWidget.quality;
}

/// Watches frame timings and reports when the raster thread keeps missing its budget: the 90th
/// percentile raster time over [threshold] across a continuous [window] of rendering (about two
/// seconds of scrolling). Idle gaps reset the window, so a single janky frame never counts.
class RasterBudgetMonitor {
  RasterBudgetMonitor({
    this.threshold = const Duration(milliseconds: 12),
    this.window = const Duration(seconds: 2),
    this.minFrames = 60,
  });

  final Duration threshold;
  final Duration window;
  final int minFrames;

  final List<(int, int)> _frames = []; // (end time in microseconds, raster microseconds)

  /// Adds one frame; returns true when the budget has been missed for the whole window.
  bool add({required int endMicros, required int rasterMicros}) {
    if (_frames.isNotEmpty && endMicros - _frames.last.$1 > 250000) _frames.clear(); // idle gap
    _frames.add((endMicros, rasterMicros));
    final start = endMicros - window.inMicroseconds;
    while (_frames.isNotEmpty && _frames.first.$1 < start) {
      _frames.removeAt(0);
    }
    if (_frames.length < minFrames) return false;
    final span = _frames.last.$1 - _frames.first.$1;
    if (span < window.inMicroseconds * 0.9) return false;
    return p90() > threshold.inMicroseconds;
  }

  int p90() {
    if (_frames.isEmpty) return 0;
    final sorted = [for (final f in _frames) f.$2]..sort();
    return sorted[((sorted.length - 1) * 0.9).round()];
  }

  void reset() => _frames.clear();
}

/// Steps glass from Full to Lite once when [RasterBudgetMonitor] fires. Watch
/// [glassPerformanceWatchProvider] once near the app root.
class GlassPerformanceWatch {
  GlassPerformanceWatch(this._ref);

  final Ref _ref;
  final RasterBudgetMonitor _monitor = RasterBudgetMonitor();
  bool _fired = false;

  void start() => SchedulerBinding.instance.addTimingsCallback(_onTimings);

  void stop() => SchedulerBinding.instance.removeTimingsCallback(_onTimings);

  void _onTimings(List<FrameTiming> timings) {
    if (_fired || _ref.read(glassQualityProvider) != GlassQuality.full) return;
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

final glassPerformanceWatchProvider = Provider<GlassPerformanceWatch>((ref) {
  final watch = GlassPerformanceWatch(ref)..start();
  ref.onDispose(watch.stop);
  return watch;
});
