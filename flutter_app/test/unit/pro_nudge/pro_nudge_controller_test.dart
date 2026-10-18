// The Pro nudges' memory and rules wired together: runs of the app, restarts (a new container over the
// same saved preferences), onboarding, Pro, the flag, the first real action, once ever, and the
// seven-day quiet after a dismissed row.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/repositories/student_actions.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/billing/billing.dart' show playBillingUserIdProvider;
import 'package:mockmob/features/pro_nudge/copy.dart';
import 'package:mockmob/features/pro_nudge/data/nudge_rules.dart';
import 'package:mockmob/features/pro_nudge/data/pro_nudge_controller.dart';

class _Flag extends Notifier<bool> {
  _Flag(this.initial);

  final bool initial;

  @override
  bool build() => initial;

  void set(bool v) => state = v;
}

/// One run of the app on a phone whose preferences are [prefs].
class Run {
  Run(
    this.prefs, {
    required this.launch,
    bool enabled = true,
    bool onboarding = false,
    String? userId = 'u1',
    DateTime? now,
  })  : _enabled = NotifierProvider<_Flag, bool>(() => _Flag(enabled)),
        _onboarding = NotifierProvider<_Flag, bool>(() => _Flag(onboarding)),
        clock = now ?? DateTime(2026, 10, 18, 19) {
    container = ProviderContainer(overrides: [
      proNudgePrefsProvider.overrideWithValue(prefs),
      proNudgeLaunchProvider.overrideWithValue(launch),
      playBillingUserIdProvider.overrideWithValue(userId),
      proNudgesOnProvider.overrideWith((ref) => ref.watch(_enabled)),
      proNudgeInOnboardingProvider.overrideWith((ref) => ref.watch(_onboarding)),
      nowProvider.overrideWithValue(() => clock),
    ]);
    // The controller is read once, as the app does when it starts.
    container.read(proNudgeProvider);
  }

  final MemoryPrefsStore prefs;
  final String launch;
  final NotifierProvider<_Flag, bool> _enabled;
  final NotifierProvider<_Flag, bool> _onboarding;
  DateTime clock;
  late final ProviderContainer container;

  Future<Run> settled() async {
    for (var i = 0; i < 8; i++) {
      await Future<void>.delayed(Duration.zero);
    }
    return this;
  }

  void setEnabled(bool v) => container.read(_enabled.notifier).set(v);
  void setOnboarding(bool v) => container.read(_onboarding.notifier).set(v);
  void act() => container.read(studentActionsProvider.notifier).submitted();
  PopupVerdict get verdict => container.read(upgradePopupVerdictProvider);
  bool get due => container.read(upgradePopupDueProvider);
  ProNudgeController get ctl => container.read(proNudgeProvider.notifier);
  bool visible(ProNudgeSurface s) => container.read(proNudgeVisibleProvider(s));
  void close() => container.dispose();
}

void main() {
  late MemoryPrefsStore prefs;
  setUp(() => prefs = MemoryPrefsStore());

  group('first-session pop-up', () {
    test('a new student: not in the onboarding run, then due after the first action of the next run, once ever', () async {
      // Run 1: the student is signed out, goes through onboarding and signs in. They even complete a set.
      final r1 = await Run(prefs, launch: 'L1', enabled: false, onboarding: true).settled();
      r1.setOnboarding(false);
      r1.setEnabled(true);
      await r1.settled();
      expect(r1.verdict, PopupVerdict.notFirstSession);
      r1.act();
      expect(r1.verdict, PopupVerdict.notFirstSession, reason: 'never right after onboarding');
      expect(r1.due, isFalse);
      r1.close();

      // Run 2 is the first session after onboarding: nothing until the first real action.
      final r2 = await Run(prefs, launch: 'L2').settled();
      expect(r2.verdict, PopupVerdict.noAction);
      expect(r2.due, isFalse);
      r2.act();
      expect(r2.due, isTrue);

      // Shown: never again in this run...
      r2.ctl.popupShown();
      await r2.settled();
      expect(r2.verdict, PopupVerdict.alreadyShown);
      r2.act();
      expect(r2.due, isFalse);
      r2.close();

      // ...and not in any run after a restart (it is saved on the phone).
      final r3 = await Run(prefs, launch: 'L3').settled();
      r3.act();
      expect(r3.verdict, PopupVerdict.alreadyShown);
      r3.close();
    });

    test('first session only: a student who did nothing in it is not asked in a later run', () async {
      final r1 = await Run(prefs, launch: 'L1').settled();
      expect(r1.verdict, PopupVerdict.noAction, reason: 'an account set up before this build: this run is its first session');
      r1.close();

      final r2 = await Run(prefs, launch: 'L2').settled();
      r2.act();
      expect(r2.verdict, PopupVerdict.notFirstSession);
      expect(r2.due, isFalse);
      r2.close();
    });

    test('an account set up before this build: due after the first action of its first run', () async {
      final r = await Run(prefs, launch: 'L1').settled();
      expect(r.due, isFalse);
      r.act();
      expect(r.due, isTrue);
      r.close();
    });

    test('never during onboarding, even with an action', () async {
      final r = await Run(prefs, launch: 'L1', onboarding: true).settled();
      r.act();
      expect(r.verdict, PopupVerdict.onboarding);
      expect(r.due, isFalse);
      r.close();
    });

    test('a Pro student sees nothing and nothing is saved', () async {
      final r = await Run(prefs, launch: 'L1', enabled: false).settled();
      r.act();
      expect(r.verdict, PopupVerdict.off);
      expect(r.due, isFalse);
      expect(prefs.values, isEmpty);
      r.close();
    });

    test('the flag off sees nothing, whatever the student does', () async {
      final r = await Run(prefs, launch: 'L1', enabled: false).settled();
      for (var i = 0; i < 3; i++) {
        r.act();
      }
      expect(r.due, isFalse);
      expect(r.visible(ProNudgeSurface.result), isFalse);
      r.close();
    });

    test('a student who becomes Pro (or loses the plan read) is not asked, and one who turns out Free is', () async {
      final r = await Run(prefs, launch: 'L1', enabled: false).settled();
      r.act();
      expect(r.due, isFalse);
      // The plan read says Free: the nudges come on, this run is classified, and the action already taken counts.
      r.setEnabled(true);
      await r.settled();
      expect(r.due, isTrue);
      r.setEnabled(false);
      expect(r.due, isFalse);
      r.close();
    });

    test('signed out: nothing is read or saved', () async {
      final r = await Run(prefs, launch: 'L1', userId: null).settled();
      r.act();
      expect(r.container.read(proNudgeProvider).loaded, isFalse);
      expect(r.due, isFalse);
      expect(prefs.values, isEmpty);
      r.close();
    });

    test('the mark is per account: another account on the same phone has its own', () async {
      final a = await Run(prefs, launch: 'L1', userId: 'a').settled();
      a.act();
      a.ctl.popupShown();
      await a.settled();
      a.close();

      final b = await Run(prefs, launch: 'L1', userId: 'b').settled();
      b.act();
      expect(b.due, isTrue);
      b.close();
    });
  });

  group('inline rows', () {
    test('visible once saved state is read, and stays quiet for seven days after a dismissal, across a restart', () async {
      final r1 = await Run(prefs, launch: 'L1').settled();
      expect(r1.visible(ProNudgeSurface.result), isTrue);
      expect(r1.visible(ProNudgeSurface.reviewPractise), isTrue);

      r1.ctl.dismiss(ProNudgeSurface.result);
      await r1.settled();
      expect(r1.visible(ProNudgeSurface.result), isFalse);
      // Another place is its own row.
      expect(r1.visible(ProNudgeSurface.reviewPractise), isTrue);
      r1.close();

      // A restart six days later: still quiet.
      final r2 = await Run(prefs, launch: 'L2', now: DateTime(2026, 10, 24, 19)).settled();
      expect(r2.visible(ProNudgeSurface.result), isFalse);
      r2.close();

      // On the seventh day it is back.
      final r3 = await Run(prefs, launch: 'L3', now: DateTime(2026, 10, 25, 19)).settled();
      expect(r3.visible(ProNudgeSurface.result), isTrue);
      r3.close();
    });

    test('hidden until the saved state is read', () async {
      final r = Run(prefs, launch: 'L1');
      expect(r.visible(ProNudgeSurface.practiceMocks), isFalse);
      await r.settled();
      expect(r.visible(ProNudgeSurface.practiceMocks), isTrue);
      r.close();
    });

    test('never for a Pro student or with the flag off', () async {
      final r = await Run(prefs, launch: 'L1', enabled: false).settled();
      for (final s in ProNudgeSurface.values) {
        expect(r.visible(s), isFalse, reason: s.key);
      }
      r.close();
    });

    test('a dismissal does not touch the first-session pop-up, and the pop-up does not touch the rows', () async {
      final r = await Run(prefs, launch: 'L1').settled();
      r.ctl.dismiss(ProNudgeSurface.practiceMocks);
      r.act();
      expect(r.due, isTrue);
      r.ctl.popupShown();
      await r.settled();
      expect(r.visible(ProNudgeSurface.result), isTrue);
      r.close();
    });
  });
}
