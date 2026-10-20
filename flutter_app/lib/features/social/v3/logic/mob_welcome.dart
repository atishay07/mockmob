// The Mob welcome's rules (owner, 20 Oct 11:20 pm: "The 'How it works' that you have built should have another
// welcome animation on top of that for the first time"; V16-PLAN A3), kept apart from the widgets so tests read
// them plainly:
// - when it plays: once per account on this phone, the first time the Mob tab's root (the den, or D0 for a student
//   in no Mob) is on screen; never during a run or a results run, never over the explainer, a sheet, a moment or an
//   onboarding route (anything above the root counts), never in a hidden tab;
// - the seen flag: `mob.welcome.v1.seen.<user id>` in the Mob prefs, set by Skip, either key or leaving the welcome
//   any other way; an invite link that opens the explainer sets it too; a read that fails counts as seen, so the
//   welcome never loops;
// - where "See how it works" goes: the explainer, as Start for a student in no Mob (slide 7 offers Start and Join)
//   and as a replay for a member (one key back to the den). "See how it works" in D0 and Mob settings still
//   replays only the explainer;
// - the demo build (fixture server on): only the `fresh` scenario plays it, once per app run; every other
//   scenario counts it seen.

import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_state.dart';
import '../../data/mob_repository.dart' show mobPrefsStoreProvider;
import '../mob_v3_flags.dart';
import 'explainer_flow.dart' show ExplainerVia;

/// The per-account key. An account the app cannot name yet shares one anonymous key.
String mobWelcomeSeenKey(String? userId) => 'mob.welcome.v1.seen.${(userId == null || userId.isEmpty) ? 'anon' : userId}';

/// What the Mob tab's root sees when it asks whether the welcome may open.
@immutable
class WelcomeMoment {
  const WelcomeMoment({required this.seen, required this.tabShown, required this.rootOnTop, this.resultsRun = false, this.opening = false});

  /// This account's flag on this phone.
  final bool seen;

  /// The Mob tab is the tab on screen (its tickers run).
  final bool tabShown;

  /// Nothing sits above the root on any navigator: no run, explainer, sheet, moment or onboarding route.
  final bool rootOnTop;

  /// A results run is playing.
  final bool resultsRun;

  /// The welcome already opened in this app run (it is on screen, or the flag write failed).
  final bool opening;
}

/// The answer, and why not.
enum WelcomeCall {
  play,
  seen,

  /// Already open or opened in this run.
  busy,

  /// Another tab is on screen: the Mob tab asks again when it comes back.
  hiddenTab,

  /// Something sits above the root: ask again shortly.
  covered,
}

abstract final class MobWelcomeRules {
  static WelcomeCall decide(WelcomeMoment m) {
    if (m.seen) return WelcomeCall.seen;
    if (m.opening) return WelcomeCall.busy;
    if (!m.tabShown) return WelcomeCall.hiddenTab;
    if (!m.rootOnTop || m.resultsRun) return WelcomeCall.covered;
    return WelcomeCall.play;
  }

  static bool shouldPlay(WelcomeMoment m) => decide(m) == WelcomeCall.play;

  /// Only a covered root polls again (a hidden tab is asked again on its return; seen and busy never).
  static bool askAgain(WelcomeCall c) => c == WelcomeCall.covered;

  /// How often a covered root asks again.
  static const Duration askEvery = Duration(milliseconds: 600);

  /// "See how it works": the explainer as Start for a student in no Mob, as a replay for a member.
  static ExplainerVia explainerVia({required bool inMob}) => inMob ? ExplainerVia.replay : ExplainerVia.start;

  /// The demo build plays the welcome only in the `fresh` scenario; the others count it seen.
  static bool demoCountsSeen(String scenario) => scenario != 'fresh';
}

/// The welcome may open at all: on in the app, off under `flutter test` (a test that wants it overrides this), so
/// no other screen's test meets it.
final mobWelcomeOnProvider = Provider<bool>((ref) => !_underTest);

final bool _underTest = !kIsWeb && Platform.environment.containsKey('FLUTTER_TEST');

/// The demo build's fixture scenario (built with MOB_V3_FIXTURES), or null in the app. Tests override it.
final mobWelcomeDemoProvider = Provider<String?>((ref) => MobV3Flags.fixturesByDefine ? MobV3Flags.scenarioByDefine : null);

/// Reads and sets this account's welcome flag on this phone. A read that fails counts as seen; a write that fails
/// costs at most one more welcome (the run's own memory stops a second one in the same run).
class MobWelcomeSeen {
  MobWelcomeSeen(this.ref);

  final Ref ref;

  /// The demo build keeps the fresh scenario's flag for the app run only, so every demo launch shows it once.
  bool _demoSeen = false;

  String get _key => mobWelcomeSeenKey(ref.read(authSnapshotProvider).userId);

  Future<bool> read() async {
    try {
      final demo = ref.read(mobWelcomeDemoProvider);
      if (demo != null) return MobWelcomeRules.demoCountsSeen(demo) || _demoSeen;
      return await ref.read(mobPrefsStoreProvider).getBool(_key) ?? false;
    } on Object {
      return true;
    }
  }

  Future<void> mark() async {
    try {
      if (ref.read(mobWelcomeDemoProvider) != null) {
        _demoSeen = true;
        return;
      }
      await ref.read(mobPrefsStoreProvider).setBool(_key, true);
    } on Object {
      // The worst case is the welcome once more on this phone.
    }
  }
}

final mobWelcomeSeenProvider = Provider<MobWelcomeSeen>(MobWelcomeSeen.new);

/// This app run's welcome: whether it opened, and whether its flow (the welcome, then the explainer it hands to) is
/// still on screen. The den waits for it before its moment queue, so no moment ever plays over the welcome.
class MobWelcomeRun {
  /// Opened in this run (never twice, even when the flag could not be written).
  bool opened = false;

  /// The welcome or the explainer it handed to is on screen.
  final ValueNotifier<bool> onScreen = ValueNotifier<bool>(false);

  /// Completes once no welcome flow is on screen.
  Future<void> idle() {
    if (!onScreen.value) return Future<void>.value();
    final done = Completer<void>();
    void check() {
      if (onScreen.value) return;
      onScreen.removeListener(check);
      if (!done.isCompleted) done.complete();
    }

    onScreen.addListener(check);
    return done.future;
  }
}

final mobWelcomeRunProvider = Provider<MobWelcomeRun>((ref) {
  final run = MobWelcomeRun();
  ref.onDispose(run.onScreen.dispose);
  return run;
});

/// True when nothing sits above [context]'s route on its navigator, nor above that navigator's own route, up to the
/// root (the tab shell keeps each tab in a nested navigator, so a run or a sheet on the root navigator covers the
/// tab's route without making it not current in its own navigator).
bool routeOnTopEverywhere(BuildContext context) {
  BuildContext c = context;
  for (var depth = 0; depth < 8; depth++) {
    final route = ModalRoute.of(c);
    if (route == null) return true;
    if (!route.isCurrent) return false;
    final nav = route.navigator;
    if (nav == null || !nav.mounted) return true;
    c = nav.context;
  }
  return true;
}
