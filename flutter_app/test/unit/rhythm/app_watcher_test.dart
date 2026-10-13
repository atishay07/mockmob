// rhythm-notifications-03: the app root keeps the milestone watcher alive, so a milestone in a
// fresh rhythm read gets its moment without Today's week row (or the week sheet) ever being built.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/app.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_controller.dart';
import 'package:mockmob/features/rhythm/celebration/celebration_event.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart';
import 'package:mockmob/features/rhythm/widgets/week_strip_section.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../helpers/fonts.dart';
import 'fixtures.dart';

/// Stays signed out without touching Supabase or secure storage: the welcome screen, no Today.
class _SignedOut extends AuthController {
  @override
  AuthSnapshot build() => AuthSnapshot.signedOut;
}

final _at = DateTime(2026, 10, 14, 21);

/// A read that just arrived from the server with a milestone earned an hour ago.
class _FreshRhythm extends RhythmRepository {
  @override
  RemoteState<Rhythm> build() => RemoteState(
        value: rhythmFixture(milestones: [RhythmMilestone(id: 'first_repair', achievedAt: _at.subtract(const Duration(hours: 1)))]),
        fetchedAt: _at,
      );
}

/// `rhythm_seen` in memory, with a week already seen so this read is not the first on the phone.
class _MemorySeen implements RhythmSeenRepository {
  LastSeenWeek? week = LastSeenWeek.fromRhythm(rhythmFixture());
  String? celebratedWeek;
  final Set<String> celebrated = {};

  @override
  Future<RhythmSeenState> read() async =>
      RhythmSeenState(lastSeenWeek: week, lastCelebratedWeekStart: celebratedWeek, celebratedIds: {...celebrated});

  @override
  Future<void> saveSeen(Rhythm rhythm) async => week = LastSeenWeek.fromRhythm(rhythm);

  @override
  Future<bool> hasCelebrated(String id) async => celebrated.contains(id);

  @override
  Future<bool> markCelebrated(String id) async => celebrated.add(id);

  @override
  Future<void> setLastCelebratedWeekStart(String weekStart) async => celebratedWeek = weekStart;
}

class _QuietDriver implements HapticDriver {
  @override
  Future<void> lightImpact() async {}

  @override
  Future<void> mediumImpact() async {}

  @override
  Future<void> selectionClick() async {}
}

void main() {
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await loadAppFonts();
  });

  testWidgets('a fresh milestone is celebrated from the app root, with Today never opened', (tester) async {
    final seen = _MemorySeen();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authSnapshotProvider.overrideWith(_SignedOut.new),
          rhythmRepositoryProvider.overrideWith(_FreshRhythm.new),
          rhythmSeenRepositoryProvider.overrideWithValue(seen),
          rhythmPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
          hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: _QuietDriver())),
          nowProvider.overrideWithValue(() => _at),
        ],
        child: const MockMobApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('I already have an account'), findsOneWidget, reason: 'the welcome screen, not Today');
    expect(find.byType(WeekStripSection), findsNothing);

    final container = ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
    final shown = container.read(celebrationControllerProvider).byScope[CelebrationScope.today];
    expect(shown?.id, 'first_repair');
    expect(seen.celebrated, contains('first_repair'));
  });
}
