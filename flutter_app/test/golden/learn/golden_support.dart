import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/learn/data/catalog_repository.dart';
import 'package:mockmob/features/learn/data/lesson_loader.dart';
import 'package:mockmob/features/learn/data/run_controller.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';
import 'package:mockmob/features/learn/screens/learn_screen.dart';

import '../../helpers/golden_harness.dart';

class FakeNetwork extends NetworkStatusNotifier {
  FakeNetwork(this.status);

  final NetworkStatus status;

  @override
  NetworkStatus build() => status;
}

/// Overrides shared by the Learn goldens: no network, no plugins, a fixed catalog.
List<Override> learnOverrides({
  LearnCatalog? catalog,
  RemoteState<LearnCatalog>? catalogState,
  OfflineLearnState offline = const OfflineLearnState(),
  List<String> pending = const [],
  NetworkStatus network = NetworkStatus.online,
  Map<String, RunUiState> runs = const {},
}) =>
    [
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
