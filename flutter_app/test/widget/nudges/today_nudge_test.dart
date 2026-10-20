// The nudge on Today (D191): one per run, X hides it and the phone remembers, a sheet opens once per event,
// nothing in onboarding.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/nudges/nudges.dart';

import '../../helpers/golden_harness.dart' show FileAssetBundle;
import '../../unit/nudges/nudge_test_kit.dart';

Future<void> _pump(WidgetTester tester, List<Override> overrides) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(theme: buildTheme(Brightness.dark), home: const NudgeHostPage()),
      ),
    ),
  );
  // The memory loads, the card is marked shown after a frame, and it enters.
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// A new run of the app: a fresh tree on the same phone.
Future<void> _restart(WidgetTester tester, List<Override> overrides) async {
  await tester.pumpWidget(const SizedBox());
  await _pump(tester, overrides);
}

void main() {
  final repairs = NudgeFixtures.forKind(NudgeKind.repairOpen);
  final repairTitle = NudgeCopy.repairOpenTitle(3);

  testWidgets('one nudge per run: after the X nothing else shows, even when another applies', (tester) async {
    final prefs = MemoryPrefsStore();
    // Mistakes waiting and a goal on an empty evening: the repair comes first.
    const both = NudgeSignals(openRepairs: 3, hasDailyGoal: true);
    await _pump(tester, nudgeOverrides(signals: both, prefs: prefs));
    expect(find.text(repairTitle), findsOneWidget);
    expect(find.text(NudgeCopy.practiceTodayTitle), findsNothing);

    await tester.tap(find.byKey(const ValueKey('nudge-dismiss')));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text(repairTitle), findsNothing);
    // The practice note would apply, but this run has had its one.
    expect(find.text(NudgeCopy.practiceTodayTitle), findsNothing);
    expect(find.byType(NudgeCard), findsNothing);
  });

  testWidgets('the shown card stays the one of the run while it holds', (tester) async {
    final prefs = MemoryPrefsStore();
    await _pump(tester, nudgeOverrides(signals: repairs, prefs: prefs));
    expect(find.text(repairTitle), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
    expect(find.text(repairTitle), findsOneWidget);
    expect(find.byType(NudgeCard), findsOneWidget);
  });

  testWidgets('X hides the card in 240 ms and the phone remembers it for the next run', (tester) async {
    final prefs = MemoryPrefsStore();
    await _pump(tester, nudgeOverrides(signals: repairs, prefs: prefs));
    expect(find.text(repairTitle), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('nudge-dismiss')));
    await tester.pump(const Duration(milliseconds: 120));
    // Mid-collapse it is still there.
    expect(find.text(repairTitle), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text(repairTitle), findsNothing);

    final saved = prefs.values[NudgeStore.keyFor('u1')];
    expect(saved, isA<String>());
    final memory = NudgeMemory.fromJson(jsonDecode(saved! as String));
    expect(memory.dismissedAt.keys, contains(NudgeKind.repairOpen));
    expect(memory.seenEvents, contains('repairOpen:2026-10-21'));

    // The next run, the next day: still quiet (seven days).
    await _restart(tester, nudgeOverrides(signals: repairs, prefs: prefs, now: DateTime(2026, 10, 22, 19)));
    expect(find.text(repairTitle), findsNothing);
    // Eight days on it may speak again.
    await _restart(tester, nudgeOverrides(signals: repairs, prefs: prefs, now: DateTime(2026, 10, 29, 19)));
    expect(find.text(repairTitle), findsOneWidget);
  });

  testWidgets('a reward opens its sheet once, 600 ms after Today settles, and never again for that event', (tester) async {
    final prefs = MemoryPrefsStore();
    final reward = NudgeFixtures.forKind(NudgeKind.friendPaid);
    await _pump(tester, nudgeOverrides(signals: reward, prefs: prefs));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text(NudgeCopy.friendPaidTitle(100)), findsOneWidget);
    expect(find.text(NudgeCopy.friendPaidKey), findsOneWidget);
    // A sheet leaves no card on Today.
    expect(find.byType(NudgeCard), findsNothing);

    await tester.tap(find.byKey(const ValueKey('nudge-sheet-key')));
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text(NudgeCopy.friendPaidTitle(100)), findsNothing);
    expect(NudgeMemory.fromJson(jsonDecode(prefs.values[NudgeStore.keyFor('u1')]! as String)).seenEvents, contains('reward:1'));

    // The next run: the same reward is not celebrated again.
    await _restart(tester, nudgeOverrides(signals: reward, prefs: prefs));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text(NudgeCopy.friendPaidTitle(100)), findsNothing);

    // A second friend's reward is a new event.
    await _restart(tester, nudgeOverrides(signals: const NudgeSignals(invitesLive: true, rewardEvents: ['reward:2']), prefs: prefs));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text(NudgeCopy.friendPaidTitle(100)), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('nothing in onboarding', (tester) async {
    final prefs = MemoryPrefsStore();
    await _pump(tester, nudgeOverrides(signals: repairs, prefs: prefs, inOnboarding: true));
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(NudgeCard), findsNothing);
    await _restart(tester, nudgeOverrides(signals: NudgeFixtures.forKind(NudgeKind.friendPaid), prefs: prefs, inOnboarding: true));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text(NudgeCopy.friendPaidTitle(100)), findsNothing);
    // Nothing was marked seen while it could not show.
    expect(prefs.values[NudgeStore.keyFor('u1')], isNull);
  });

  testWidgets('nothing while Today is not the screen on top', (tester) async {
    final prefs = MemoryPrefsStore();
    await _pump(tester, nudgeOverrides(signals: repairs, prefs: prefs, calm: false));
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(NudgeCard), findsNothing);
  });

  testWidgets('a fresh account has no nudge', (tester) async {
    final prefs = MemoryPrefsStore();
    await _pump(tester, nudgeOverrides(signals: NudgeSignals.none, prefs: prefs));
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(NudgeCard), findsNothing);
    expect(find.byType(NudgeSheetBody), findsNothing);
  });
}
