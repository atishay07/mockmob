// Keeps the Android home-screen widget in step with Today. Started once from the app root
// (`ref.watch(homeWidgetSyncProvider)` in app.dart). It reads Today's and the rhythm's
// providers, never changes them, and writes only when what the widget would show changed.
import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show debugPrint, kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:home_widget/home_widget.dart';

import '../../features/rhythm/rhythm.dart' show rhythmSnapshotProvider, rhythmVisibleProvider;
import '../../features/today/data/today_providers.dart' show todayInputsProvider, todayViewProvider;
import '../auth/auth_state.dart';
import '../notifications/timezones.dart' show defaultTimezoneName;
import 'home_widget_data.dart';

/// Where the widget's data goes. Replaced in tests.
abstract interface class HomeWidgetWriter {
  /// False where there is no Android widget to write to (tests, other platforms).
  bool get available;

  /// True only when the widget now holds [json] and was asked to draw it. False means it may
  /// still hold what it held before, so the caller tries again.
  Future<bool> write(String json);
}

/// Writes through the home_widget plugin, then asks the provider to draw again.
class PlatformHomeWidgetWriter implements HomeWidgetWriter {
  const PlatformHomeWidgetWriter();

  @override
  bool get available => !kIsWeb && Platform.isAndroid && !Platform.environment.containsKey('FLUTTER_TEST');

  @override
  Future<bool> write(String json) async {
    try {
      final saved = await HomeWidget.saveWidgetData<String>(homeWidgetDataKey, json);
      if (saved != true) {
        debugPrint('Home widget write was not saved');
        return false;
      }
      await HomeWidget.updateWidget(qualifiedAndroidName: homeWidgetProviderName);
      return true;
    } on Object catch (error) {
      // A widget that cannot be written keeps its last state; the app is unaffected, and the
      // sync tries again.
      debugPrint('Home widget write failed: $error');
      return false;
    }
  }
}

final homeWidgetWriterProvider = Provider<HomeWidgetWriter>((ref) => const PlatformHomeWidgetWriter());

/// How long Today must hold still before the widget is written, so a burst of provider
/// updates while the screen loads is one write.
final homeWidgetSettleProvider = Provider<Duration>((ref) => const Duration(seconds: 2));

/// How long to wait before writing again after a write failed. It doubles on each further
/// failure, up to twenty times this.
final homeWidgetRetryProvider = Provider<Duration>((ref) => const Duration(seconds: 30));

/// What the widget should show now, or null to keep what it shows (auth still deciding, or
/// Today not settled). Today's providers are only read while signed in.
final homeWidgetDataProvider = Provider<HomeWidgetData?>((ref) {
  final status = ref.watch(authSnapshotProvider.select((a) => a.status));
  switch (status) {
    case AuthStatus.unknown:
      return null;
    case AuthStatus.signedOut:
      return const HomeWidgetData.signedOut(timezone: defaultTimezoneName);
    case AuthStatus.signedIn:
      final rhythm = ref.watch(rhythmSnapshotProvider);
      return homeWidgetFromToday(
        view: ref.watch(todayViewProvider),
        inputs: ref.watch(todayInputsProvider),
        week: ref.watch(rhythmVisibleProvider) ? rhythm.week : null,
      );
  }
});

/// Writes [homeWidgetDataProvider] to the widget whenever it settles on something new.
final homeWidgetSyncProvider = Provider<void>((ref) {
  final writer = ref.watch(homeWidgetWriterProvider);
  if (!writer.available) return;
  final settle = ref.watch(homeWidgetSettleProvider);
  final retryBase = ref.watch(homeWidgetRetryProvider);
  // What the widget is known to hold, and what is being written to it now. A write that failed
  // is neither, so the same data is written again instead of being dropped as a duplicate: a
  // signed-out phone must not keep the last student's move.
  String? written;
  String? inFlight;
  HomeWidgetData? latest;
  var failures = 0;
  var disposed = false;
  Timer? pending;
  Timer? retry;
  // Declared first: a write that finishes hands newer data back to it.
  late final void Function(HomeWidgetData?) schedule;

  Future<void> write(String json) async {
    inFlight = json;
    final ok = await writer.write(json);
    if (disposed || inFlight != json) return;
    inFlight = null;
    if (ok) {
      written = json;
      failures = 0;
      // Newer data arrived while this was being written and matched the older state: write it.
      final data = latest;
      if (data != null && data.encode() != json) schedule(data);
      return;
    }
    failures++;
    final factor = failures > 5 ? 20 : 1 << (failures - 1);
    final wait = retryBase * factor;
    retry?.cancel();
    retry = Timer(wait, () {
      final data = latest;
      if (data != null) schedule(data);
    });
  }

  schedule = (HomeWidgetData? data) {
    if (data == null) return;
    latest = data;
    final json = data.encode();
    pending?.cancel();
    retry?.cancel();
    if (json == written || json == inFlight) return;
    // Signing out is written at once: if the app is closed inside the settle window, the last
    // student's next move must not stay on the home screen (a shared phone).
    if (!data.signedIn) {
      unawaited(write(json));
      return;
    }
    pending = Timer(settle, () => unawaited(write(json)));
  };

  ref.listen<HomeWidgetData?>(homeWidgetDataProvider, (_, next) => schedule(next), fireImmediately: true);
  ref.onDispose(() {
    disposed = true;
    pending?.cancel();
    retry?.cancel();
  });
});
