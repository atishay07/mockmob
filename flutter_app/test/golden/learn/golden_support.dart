import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/learn/data/catalog_repository.dart';
import 'package:mockmob/features/learn/data/learn_prefs.dart';
import 'package:mockmob/features/learn/data/lesson_loader.dart';
import 'package:mockmob/features/learn/data/run_controller.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';
import 'package:mockmob/features/learn/screens/learn_screen.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;

import '../../helpers/golden_harness.dart';

class FakeNetwork extends NetworkStatusNotifier {
  FakeNetwork(this.status);

  final NetworkStatus status;

  @override
  NetworkStatus build() => status;
}

/// Per-phone flags kept in memory for tests.
class MemoryPrefs implements PrefsStore {
  MemoryPrefs([Map<String, Object>? values]) : values = values ?? {};

  final Map<String, Object> values;

  @override
  Future<bool?> getBool(String key) async => values[key] as bool?;
  @override
  Future<int?> getInt(String key) async => values[key] as int?;
  @override
  Future<String?> getString(String key) async => values[key] as String?;
  @override
  Future<List<String>?> getStringList(String key) async => values[key] as List<String>?;
  @override
  Future<void> setBool(String key, bool value) async => values[key] = value;
  @override
  Future<void> setInt(String key, int value) async => values[key] = value;
  @override
  Future<void> setString(String key, String value) async => values[key] = value;
  @override
  Future<void> setStringList(String key, List<String> value) async => values[key] = value;
  @override
  Future<void> remove(String key) async => values.remove(key);
}

/// Overrides shared by the Learn goldens: no network, no plugins, a fixed catalog.
List<Override> learnOverrides({
  LearnCatalog? catalog,
  RemoteState<LearnCatalog>? catalogState,
  OfflineLearnState offline = const OfflineLearnState(),
  List<String> pending = const [],
  NetworkStatus network = NetworkStatus.online,
  Map<String, RunUiState> runs = const {},
  bool firstVisit = false,
}) =>
    [
      // The Celebrations setting reads the rhythm prefs store; with no platform it would throw.
      rhythmPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      learnPrefsStoreProvider.overrideWithValue(MemoryPrefs({if (!firstVisit) 'learn_how_concepts_seen': true})),
      studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
      networkStatusProvider.overrideWith(() => FakeNetwork(network)),
      if (catalog != null || catalogState != null)
        learnCatalogProvider.overrideWithBuild(
          (ref, notifier) => catalogState ?? RemoteState(value: catalog, fetchedAt: DateTime(2026, 10, 12, 18)),
        ),
      offlineLearnProvider.overrideWithBuild((ref, notifier) => offline),
      pendingRunIdsProvider.overrideWith((ref) => pending),
      for (final e in runs.entries) runControllerProvider(e.key).overrideWithBuild((ref, notifier) => e.value),
    ];

/// Lets Mobi finish speaking: the bubble types its line in character by character, and a golden
/// taken mid-line would commit half a sentence.
Future<void> settleSpeech(WidgetTester tester, {Duration total = const Duration(seconds: 6)}) async {
  for (var elapsed = Duration.zero; elapsed < total; elapsed += const Duration(milliseconds: 100)) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// Pumps a screen with its own Scaffold at the golden size and brightness.
Future<void> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  required Brightness brightness,
  List<Override> overrides = const [],
  Size size = kGoldenSize,
  double textScale = 1,
}) =>
    pumpMockmob(tester, screen, brightness: brightness, overrides: overrides, size: size, textScale: textScale, wrapInScaffold: false);
