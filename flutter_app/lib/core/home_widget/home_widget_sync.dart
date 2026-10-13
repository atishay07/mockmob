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

  Future<void> write(String json);
}

/// Writes through the home_widget plugin, then asks the provider to draw again.
class PlatformHomeWidgetWriter implements HomeWidgetWriter {
  const PlatformHomeWidgetWriter();

  @override
  bool get available => !kIsWeb && Platform.isAndroid && !Platform.environment.containsKey('FLUTTER_TEST');

  @override
  Future<void> write(String json) async {
    try {
      await HomeWidget.saveWidgetData<String>(homeWidgetDataKey, json);
      await HomeWidget.updateWidget(qualifiedAndroidName: homeWidgetProviderName);
    } on Object catch (error) {
      // A widget that cannot be written keeps its last state; the app is unaffected.
      debugPrint('Home widget write failed: $error');
    }
  }
}

final homeWidgetWriterProvider = Provider<HomeWidgetWriter>((ref) => const PlatformHomeWidgetWriter());

/// How long Today must hold still before the widget is written, so a burst of provider
/// updates while the screen loads is one write.
final homeWidgetSettleProvider = Provider<Duration>((ref) => const Duration(seconds: 2));

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
  String? written;
  Timer? pending;

  void write(String json) {
    written = json;
    unawaited(writer.write(json));
  }

  void schedule(HomeWidgetData? data) {
    if (data == null) return;
    final json = data.encode();
    pending?.cancel();
    if (json == written) return;
    // Signing out is written at once: if the app is closed inside the settle window, the last
    // student's next move must not stay on the home screen (a shared phone).
    if (!data.signedIn) {
      write(json);
      return;
    }
    pending = Timer(settle, () => write(json));
  }

  ref.listen<HomeWidgetData?>(homeWidgetDataProvider, (_, next) => schedule(next), fireImmediately: true);
  ref.onDispose(() => pending?.cancel());
});
