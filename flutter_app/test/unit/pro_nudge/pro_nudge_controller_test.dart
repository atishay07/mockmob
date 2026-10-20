// The Pro nudges' memory and rules wired together: runs of the app, restarts (a new container over the
// same saved preferences), onboarding finishing, Pro, the flag, the first real action, the 6-hour first
// session, once ever, and the seven-day quiet after a dismissed row. The first-session rules are the
// website's (src/lib/proNudge.mjs).

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/repositories/student_actions.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/billing/billing.dart' show playBillingUserIdProvider;
import 'package:mockmob/features/credits/data/credit_figures.dart';
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
        _creditsLow = NotifierProvider<_Flag, bool>(() => _Flag(false)),
        clock = now ?? DateTime(2026, 10, 18, 19) {
    container = ProviderContainer(overrides: [
      proNudgePrefsProvider.overrideWithValue(prefs),
      proNudgeLaunchProvider.overrideWithValue(launch),
      playBillingUserIdProvider.overrideWithValue(userId),
      proNudgesOnProvider.overrideWith((ref) => ref.watch(_enabled)),
      proNudgeInOnboardingProvider.overrideWith((ref) => ref.watch(_onboarding)),
      proNudgeCreditsLowProvider.overrideWith((ref) => ref.watch(_creditsLow)),
      nowProvider.overrideWithValue(() => clock),
    ]);
    // The app shell listens to the pop-up for the whole run; so does this run.
    container.listen<bool>(upgradePopupDueProvider, (_, _) {});
  }

  final MemoryPrefsStore prefs;
  final String launch;
  final NotifierProvider<_Flag, bool> _enabled;
  final NotifierProvider<_Flag, bool> _onboarding;
  final NotifierProvider<_Flag, bool> _creditsLow;
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

  /// The student has met a real limit: 10 credits or fewer (D181).
  void setCreditsLow(bool v) => container.read(_creditsLow.notifier).set(v);

  /// The student seals their onboarding plan (signed out, before sign-in, as in the app).
  void seal() => container.read(onboardedThisRunProvider.notifier).sealed();

  /// A new student's onboarding in this run: in onboarding, seal, then signed in and out of it.
  Future<void> onboard() async {
    setOnboarding(true);
    seal();
    setOnboarding(false);
    await settled();
  }

  bool take() => container.read(proNudgeProvider.notifier).takePopup();
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
    test('a new student: nothing on onboarding, due after the first action in the same run, once ever', () async {
      // Run 1: the student goes through onboarding (signed out), seals the plan, signs in. Nothing yet.
      final r1 = await Run(prefs, launch: 'L1', onboarding: true).settled();
      r1.seal();
      expect(r1.verdict, PopupVerdict.onboarding);
      r1.setOnboarding(false);
      await r1.settled();
      expect(r1.verdict, PopupVerdict.noAction, reason: 'never right after onboarding');
      expect(r1.due, isFalse);

      // The first real action of the first usage session: a first paper alone asks for nothing (D181).
      r1.act();
      expect(r1.verdict, PopupVerdict.notArmed);
      expect(r1.due, isFalse);
      expect(r1.take(), isFalse);

      // A real limit arms it.
      r1.setCreditsLow(true);
      expect(r1.due, isTrue);
      expect(r1.take(), isTrue);
      expect(r1.take(), isFalse, reason: 'marked before it opens: a second call finds it shown');
      await r1.settled();
      expect(r1.verdict, PopupVerdict.alreadyShown);
      r1.act();
      expect(r1.due, isFalse);
      r1.close();

      // Never in any run after a restart (it is saved on the phone).
      final r2 = await Run(prefs, launch: 'L2').settled();
      r2.act();
      expect(r2.verdict, PopupVerdict.alreadyShown);
      r2.close();
    });

    test('an action from before onboarding finished does not count (another account on the phone acted earlier)', () async {
      final r = await Run(prefs, launch: 'L1', onboarding: true).settled();
      r.act();
      await r.onboard();
      expect(r.verdict, PopupVerdict.noAction);
      r.setCreditsLow(true);
      expect(r.verdict, PopupVerdict.noAction, reason: 'a limit alone is not an action either');
      r.act();
      expect(r.due, isTrue);
      r.close();
    });

    test('first session only: a student who did nothing in it is not asked in a later run', () async {
      final r1 = await Run(prefs, launch: 'L1', onboarding: true).settled();
      await r1.onboard();
      expect(r1.verdict, PopupVerdict.noAction);
      r1.close();

      final r2 = await Run(prefs, launch: 'L2').settled();
      r2.act();
      expect(r2.verdict, PopupVerdict.notFirstSession);
      expect(r2.due, isFalse);
      expect(r2.take(), isFalse);
      r2.close();
    });

    test('the first session ends 6 hours after onboarding, even in the same run', () async {
      final r = await Run(prefs, launch: 'L1', onboarding: true).settled();
      await r.onboard();
      r.clock = r.clock.add(const Duration(hours: 6, minutes: 1));
      r.act();
      expect(r.verdict, PopupVerdict.notFirstSession);
      expect(r.take(), isFalse);
      r.close();
    });

    test('the moment of showing reads the clock again: due when the action landed, too late by the time of showing', () async {
      final r = await Run(prefs, launch: 'L1', onboarding: true).settled();
      await r.onboard();
      r.clock = r.clock.add(const Duration(hours: 5, minutes: 59));
      r.setCreditsLow(true);
      r.act();
      expect(r.due, isTrue);
      r.clock = r.clock.add(const Duration(minutes: 2));
      expect(r.take(), isFalse);
      r.close();
    });

    test('a student who signed straight in (or was set up before this build) is never asked, as on the website', () async {
      final r = await Run(prefs, launch: 'L1', onboarding: true).settled();
      r.setOnboarding(false);
      await r.settled();
      r.act();
      expect(r.verdict, PopupVerdict.notFirstSession);
      expect(r.due, isFalse);
      r.close();
    });

    test('a second onboarding never restarts the first session', () async {
      final r1 = await Run(prefs, launch: 'L1', onboarding: true).settled();
      await r1.onboard();
      r1.close();

      final r2 = await Run(prefs, launch: 'L2', onboarding: true).settled();
      await r2.onboard();
      r2.act();
      expect(r2.verdict, PopupVerdict.notFirstSession);
      r2.close();
    });

    test('never during onboarding, even with an action', () async {
      final r = await Run(prefs, launch: 'L1', onboarding: true).settled();
      r.seal();
      r.act();
      expect(r.verdict, PopupVerdict.onboarding);
      expect(r.due, isFalse);
      expect(r.take(), isFalse);
      r.close();
    });

    test('a Pro student or the flag off sees nothing, whatever the student does', () async {
      final r = await Run(prefs, launch: 'L1', enabled: false, onboarding: true).settled();
      await r.onboard();
      for (var i = 0; i < 3; i++) {
        r.act();
      }
      expect(r.verdict, PopupVerdict.off);
      expect(r.due, isFalse);
      expect(r.take(), isFalse);
      expect(r.visible(ProNudgeSurface.result), isFalse);
      r.close();
    });

    test('a student whose plan read says Free a moment after onboarding is still asked after the first action', () async {
      final r = await Run(prefs, launch: 'L1', enabled: false, onboarding: true).settled();
      await r.onboard();
      r.setEnabled(true);
      await r.settled();
      expect(r.verdict, PopupVerdict.noAction);
      r.setCreditsLow(true);
      r.act();
      expect(r.due, isTrue);
      // Becomes Pro: not asked.
      r.setEnabled(false);
      expect(r.due, isFalse);
      r.close();
    });

    test('signed out: nothing is read or saved', () async {
      final r = await Run(prefs, launch: 'L1', userId: null, onboarding: true).settled();
      r.seal();
      r.act();
      expect(r.container.read(proNudgeProvider).loaded, isFalse);
      expect(r.due, isFalse);
      expect(prefs.values, isEmpty);
      r.close();
    });

    test('the mark is per account: another account on the same phone has its own', () async {
      final a = await Run(prefs, launch: 'L1', userId: 'a', onboarding: true).settled();
      await a.onboard();
      a.setCreditsLow(true);
      a.act();
      expect(a.take(), isTrue);
      await a.settled();
      a.close();

      final b = await Run(prefs, launch: 'L2', userId: 'b', onboarding: true).settled();
      await b.onboard();
      b.setCreditsLow(true);
      b.act();
      expect(b.due, isTrue);
      b.close();
    });
  });

  group('arming: the first-session sheet waits for a real limit (D181)', () {
    Future<Run> afterFirstPaper() async {
      final r = await Run(prefs, launch: 'L1', onboarding: true).settled();
      await r.onboard();
      r.act();
      return r;
    }

    test('the second return to a tab root after a viewed result arms it; the first does not', () async {
      final r = await afterFirstPaper();
      r.ctl.noteResultViewed();
      expect(r.verdict, PopupVerdict.notArmed);
      r.ctl.noteTabRoot();
      expect(r.verdict, PopupVerdict.notArmed, reason: 'the first return, from the result to Today');
      r.ctl.noteTabRoot();
      expect(r.verdict, PopupVerdict.due);
      expect(r.take(), isTrue);
      r.close();
    });

    test('returns to a tab root before any result was viewed count for nothing', () async {
      final r = await afterFirstPaper();
      for (var i = 0; i < 5; i++) {
        r.ctl.noteTabRoot();
      }
      expect(r.verdict, PopupVerdict.notArmed);
      r.close();
    });

    test('viewing another result starts the count again', () async {
      final r = await afterFirstPaper();
      r.ctl.noteResultViewed();
      r.ctl.noteTabRoot();
      r.ctl.noteResultViewed();
      r.ctl.noteTabRoot();
      expect(r.verdict, PopupVerdict.notArmed);
      r.ctl.noteTabRoot();
      expect(r.verdict, PopupVerdict.due);
      r.close();
    });

    test('a real limit (10 credits or fewer) arms it with no result viewed, and 11 does not', () async {
      final r = await afterFirstPaper();
      expect(r.verdict, PopupVerdict.notArmed);
      r.setCreditsLow(true);
      expect(r.due, isTrue);
      r.setCreditsLow(false);
      expect(r.due, isFalse);
      r.close();
    });

    test('the credit limit is read from the figures: 10 or fewer, a Free student, known and fresh', () {
      bool low(CreditFigures f) {
        final c = ProviderContainer(overrides: [
          proNudgesOnProvider.overrideWithValue(true),
          creditFiguresProvider.overrideWithValue(f),
        ]);
        addTearDown(c.dispose);
        return c.read(proNudgeCreditsLowProvider);
      }

      expect(low(const CreditFigures(mode: CreditsMode.oneBalance, total: 10)), isTrue);
      expect(low(const CreditFigures(mode: CreditsMode.oneBalance, total: 0)), isTrue);
      expect(low(const CreditFigures(mode: CreditsMode.oneBalance, total: 11)), isFalse);
      expect(low(const CreditFigures(mode: CreditsMode.twoPools, practice: 7)), isTrue);
      expect(low(const CreditFigures(mode: CreditsMode.twoPools, practice: 38)), isFalse);
      expect(low(const CreditFigures(mode: CreditsMode.oneBalance)), isFalse, reason: 'unknown is never a limit');
      expect(low(const CreditFigures(mode: CreditsMode.oneBalance, total: 3, stale: true)), isFalse, reason: 'a saved copy is not a limit');
      expect(low(const CreditFigures(mode: CreditsMode.oneBalance, total: 3, isPro: true)), isFalse, reason: 'Pro has no limit');
    });

    test('with the nudges off the credits are not even read', () {
      final c = ProviderContainer(overrides: [proNudgesOnProvider.overrideWithValue(false)]);
      addTearDown(c.dispose);
      expect(c.read(proNudgeCreditsLowProvider), isFalse);
    });

    test('opening the full Pro page oneself is the ask: the sheet never follows it', () async {
      final r = await afterFirstPaper();
      r.setCreditsLow(true);
      expect(r.due, isTrue);
      r.ctl.upgradeOpened();
      await r.settled();
      expect(r.verdict, PopupVerdict.alreadyShown);
      expect(r.take(), isFalse);
      r.close();
    });

    test('the number of results viewed is kept on the phone, per account', () async {
      final r1 = await Run(prefs, launch: 'L1').settled();
      expect(r1.container.read(proNudgeProvider).saved.resultsViewed, 0);
      r1.ctl.noteResultViewed();
      r1.ctl.noteResultViewed();
      await r1.settled();
      r1.close();

      final r2 = await Run(prefs, launch: 'L2').settled();
      expect(r2.container.read(proNudgeProvider).saved.resultsViewed, 2);
      r2.close();

      final other = await Run(prefs, launch: 'L3', userId: 'u2').settled();
      expect(other.container.read(proNudgeProvider).saved.resultsViewed, 0);
      other.close();
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
      final r = await Run(prefs, launch: 'L1', onboarding: true).settled();
      await r.onboard();
      r.ctl.dismiss(ProNudgeSurface.practiceMocks);
      r.setCreditsLow(true);
      r.act();
      expect(r.due, isTrue);
      expect(r.take(), isTrue);
      await r.settled();
      expect(r.visible(ProNudgeSurface.result), isTrue);
      r.close();
    });
  });
}
