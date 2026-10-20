// The rules of the Pro nudges, stated one by one, as the website states them (src/lib/proNudge.mjs):
// the first-session upgrade sheet (the run in which onboarding finished, at most 6 hours after it, after a
// real action taken since, only once armed by a real limit or a second return to a tab root (D181), once
// ever, never on onboarding, Pro and the flag off see nothing) and the inline rows (quiet for seven days
// after a dismissal).

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/pro_nudge/data/nudge_rules.dart';

final onboarded = DateTime(2026, 10, 18, 19);

PopupInputs inputs({
  bool enabled = true,
  bool loaded = true,
  bool shown = false,
  bool inOnboarding = false,
  String launch = 'L1',
  DateTime? now,
  DateTime? onboardedAt,
  bool neverOnboarded = false,
  String? onboardedLaunch = 'L1',
  int actions = 1,
  int actionsAtOnboarded = 0,
  bool armed = true,
}) =>
    PopupInputs(
      enabled: enabled,
      loaded: loaded,
      shown: shown,
      inOnboarding: inOnboarding,
      launchId: launch,
      now: now ?? onboarded.add(const Duration(minutes: 5)),
      onboardedAt: neverOnboarded ? null : (onboardedAt ?? onboarded),
      onboardedLaunch: onboardedLaunch,
      actions: actions,
      actionsAtOnboarded: actionsAtOnboarded,
      armed: armed,
    );

void main() {
  group('first-session pop-up verdict', () {
    test('due: the run in which onboarding finished, after an action since, never shown, a Free student with the flag on', () {
      expect(PopupRules.verdict(inputs()), PopupVerdict.due);
      expect(PopupRules.verdict(inputs(actions: 5)), PopupVerdict.due);
    });

    test('not before the first real action, and an action from before onboarding finished does not count', () {
      expect(PopupRules.verdict(inputs(actions: 0)), PopupVerdict.noAction);
      expect(PopupRules.verdict(inputs(actions: 2, actionsAtOnboarded: 2)), PopupVerdict.noAction);
      expect(PopupRules.verdict(inputs(actions: 3, actionsAtOnboarded: 2)), PopupVerdict.due);
    });

    test('D181: after the first paper it still waits for a real limit or a second return to a tab root', () {
      expect(PopupRules.verdict(inputs(armed: false)), PopupVerdict.notArmed);
      expect(PopupRules.verdict(inputs(armed: false, actions: 5)), PopupVerdict.notArmed);
      expect(PopupRules.verdict(inputs(armed: true)), PopupVerdict.due);
      // Not armed never hides the other reasons: no action is still no action.
      expect(PopupRules.verdict(inputs(armed: false, actions: 0)), PopupVerdict.noAction);
      expect(PopupRules.verdict(inputs(armed: false, shown: true)), PopupVerdict.alreadyShown);
    });

    test('once ever: shown means never again', () {
      expect(PopupRules.verdict(inputs(shown: true)), PopupVerdict.alreadyShown);
    });

    test('first session only: a later run is not it', () {
      expect(PopupRules.verdict(inputs(launch: 'L2', onboardedLaunch: 'L1')), PopupVerdict.notFirstSession);
    });

    test('the first session lasts 6 hours from onboarding, as on the website', () {
      expect(PopupRules.verdict(inputs(now: onboarded.add(const Duration(hours: 6)))), PopupVerdict.due);
      expect(PopupRules.verdict(inputs(now: onboarded.add(const Duration(hours: 6, seconds: 1)))), PopupVerdict.notFirstSession);
      // A clock that runs backwards is not in the window either.
      expect(PopupRules.verdict(inputs(now: onboarded.subtract(const Duration(minutes: 1)))), PopupVerdict.notFirstSession);
    });

    test('a student who never onboarded on this phone (signed straight in, or set up before this build) is never asked', () {
      expect(PopupRules.verdict(inputs(neverOnboarded: true, onboardedLaunch: null, actions: 4)), PopupVerdict.notFirstSession);
    });

    test('never during onboarding', () {
      expect(PopupRules.verdict(inputs(inOnboarding: true)), PopupVerdict.onboarding);
    });

    test('Pro, signed out or the flag off (the nudges are not enabled): nothing', () {
      expect(PopupRules.verdict(inputs(enabled: false)), PopupVerdict.off);
      expect(PopupRules.verdict(inputs(enabled: false, shown: true)), PopupVerdict.off);
    });

    test('nothing until what was saved on the phone is read', () {
      expect(PopupRules.verdict(inputs(loaded: false)), PopupVerdict.notLoaded);
    });

    test('the pop-up waits a beat, as the website does after the result', () {
      expect(PopupRules.firstActionDelay, const Duration(milliseconds: 1800));
      expect(PopupRules.firstSessionWindow, const Duration(hours: 6));
    });
  });

  group('arming (D181)', () {
    test('a real limit is 10 credits or fewer; unknown is never one', () {
      expect(ArmRules.creditsLimit, 10);
      expect(ArmRules.creditsMet(0), isTrue);
      expect(ArmRules.creditsMet(10), isTrue);
      expect(ArmRules.creditsMet(11), isFalse);
      expect(ArmRules.creditsMet(null), isFalse);
    });

    test('the sheet arms on the second return to a tab root after a result', () {
      expect(ArmRules.returnsToArm, 2);
    });

    test('the very first result is the one with no Pro ask: only for a student onboarded on this phone who has viewed none', () {
      expect(ArmRules.firstResult(onboardedAt: onboarded, resultsViewed: 0), isTrue);
      expect(ArmRules.firstResult(onboardedAt: onboarded, resultsViewed: 1), isFalse);
      expect(ArmRules.firstResult(onboardedAt: null, resultsViewed: 0), isFalse, reason: 'signed straight in: not a new student');
    });
  });

  group('marking the end of onboarding', () {
    test('the first finish is marked with the time, the run and the actions so far', () {
      final m = PopupRules.noteOnboarded(onboardedAt: null, shown: false, now: onboarded, launchId: 'L1', actions: 2)!;
      expect(m.at, onboarded);
      expect(m.launch, 'L1');
      expect(m.actions, 2);
    });

    test('a second onboarding never resets it, nor one after the pop-up was shown', () {
      expect(PopupRules.noteOnboarded(onboardedAt: onboarded, shown: false, now: onboarded.add(const Duration(days: 1)), launchId: 'L2', actions: 0), isNull);
      expect(PopupRules.noteOnboarded(onboardedAt: null, shown: true, now: onboarded, launchId: 'L1', actions: 0), isNull);
    });
  });

  group('inline rows', () {
    final now = DateTime(2026, 10, 18, 19);

    test('visible when on, loaded and never dismissed', () {
      expect(InlineRules.visible(enabled: true, loaded: true, now: now), isTrue);
    });

    test('hidden with the nudges off, and until the saved state is read', () {
      expect(InlineRules.visible(enabled: false, loaded: true, now: now), isFalse);
      expect(InlineRules.visible(enabled: true, loaded: false, now: now), isFalse);
    });

    test('a dismissed row stays quiet for seven days, then returns', () {
      expect(InlineRules.visible(enabled: true, loaded: true, now: now, dismissedAt: now), isFalse);
      expect(InlineRules.visible(enabled: true, loaded: true, now: now, dismissedAt: now.subtract(const Duration(days: 6, hours: 23))), isFalse);
      expect(InlineRules.visible(enabled: true, loaded: true, now: now, dismissedAt: now.subtract(const Duration(days: 7))), isTrue);
      expect(InlineRules.visible(enabled: true, loaded: true, now: now, dismissedAt: now.subtract(const Duration(days: 30))), isTrue);
    });
  });
}
