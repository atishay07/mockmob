// The smart nudges in the demo (D191). `--dart-define=MOCKMOB_DEMO_NUDGE=<kind>` walks one kind on Today:
// friendPaid, mobGame, chainRisk, repairOpen, practiceToday, creditsLow, friendJoined or goodResult. The default,
// "fresh", is a new account's Today: no nudge at all. The nudges' memory lives in memory, so every launch starts
// clean, and their clock is the kind's own moment (the chain's last call at 9:05 PM, the evening at 7:30 PM), so a
// walk works at any hour.
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/nudges/nudges.dart';

import '../unit/nudges/nudge_test_kit.dart' show NudgeFixtures;

const String demoNudge = String.fromEnvironment('MOCKMOB_DEMO_NUDGE', defaultValue: 'fresh');

/// The demo's nudge kind, or null for "fresh" (and anything unknown).
NudgeKind? get demoNudgeKind => NudgeKind.values.where((k) => k.name == demoNudge).firstOrNull;

List<Override> demoNudgeOverrides() {
  final kind = demoNudgeKind;
  return [
    nudgePrefsProvider.overrideWithValue(MemoryPrefsStore()),
    nudgeSignalsProvider.overrideWithValue(kind == null ? NudgeSignals.none : NudgeFixtures.forKind(kind)),
    if (kind != null) nudgeClockProvider.overrideWithValue(() => NudgeFixtures.nowFor(kind)),
    // A walk is never the first session after onboarding, so the credits note can show (D181 holds in the app).
    nudgeFirstSessionProvider.overrideWithValue(false),
  ];
}
