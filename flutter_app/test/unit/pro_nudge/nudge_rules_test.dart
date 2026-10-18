// The rules of the Pro nudges, stated one by one: the first-session pop-up (first session only, after
// the first action, once ever, never on onboarding, Pro and the flag off see nothing) and the inline
// rows (quiet for seven days after a dismissal).

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/pro_nudge/data/nudge_rules.dart';

PopupInputs inputs({
  bool enabled = true,
  bool loaded = true,
  bool shown = false,
  bool inOnboarding = false,
  String launch = 'L2',
  String? first = 'L2',
  int actions = 1,
}) =>
    PopupInputs(enabled: enabled, loaded: loaded, shown: shown, inOnboarding: inOnboarding, launchId: launch, firstSessionLaunch: first, actions: actions);

void main() {
  group('first-session pop-up verdict', () {
    test('due: the first session, after the first action, never shown, a Free student with the flag on', () {
      expect(PopupRules.verdict(inputs()), PopupVerdict.due);
      expect(PopupRules.verdict(inputs(actions: 5)), PopupVerdict.due);
    });

    test('not before the first real action', () {
      expect(PopupRules.verdict(inputs(actions: 0)), PopupVerdict.noAction);
    });

    test('once ever: shown means never again', () {
      expect(PopupRules.verdict(inputs(shown: true)), PopupVerdict.alreadyShown);
    });

    test('first session only: a later run is not it', () {
      expect(PopupRules.verdict(inputs(launch: 'L3', first: 'L2')), PopupVerdict.notFirstSession);
    });

    test('the run before a first session is chosen is not it either', () {
      expect(PopupRules.verdict(inputs(first: null)), PopupVerdict.notFirstSession);
    });

    test('never during onboarding', () {
      expect(PopupRules.verdict(inputs(inOnboarding: true)), PopupVerdict.onboarding);
    });

    test('Pro, signed out or the flag off (the nudges are not enabled): nothing', () {
      expect(PopupRules.verdict(inputs(enabled: false)), PopupVerdict.off);
      // Even with everything else true, and even if it was shown before.
      expect(PopupRules.verdict(inputs(enabled: false, shown: true)), PopupVerdict.off);
    });

    test('nothing until what was saved on the phone is read', () {
      expect(PopupRules.verdict(inputs(loaded: false)), PopupVerdict.notLoaded);
    });
  });

  group('which run is the first session after onboarding', () {
    test('the run in which onboarding was seen is the onboarding run, and is not the first session', () {
      final c = PopupRules.classify(launchId: 'L1', sawOnboarding: true, onboardedLaunch: null, firstSessionLaunch: null)!;
      expect(c.onboardedLaunch, 'L1');
      expect(c.firstSessionLaunch, isNull);
    });

    test('the next run is the first session', () {
      final c = PopupRules.classify(launchId: 'L2', sawOnboarding: false, onboardedLaunch: 'L1', firstSessionLaunch: null)!;
      expect(c.firstSessionLaunch, 'L2');
      expect(c.onboardedLaunch, 'L1');
    });

    test('an account set up before this build has this run as its first session', () {
      final c = PopupRules.classify(launchId: 'L9', sawOnboarding: false, onboardedLaunch: null, firstSessionLaunch: null)!;
      expect(c.firstSessionLaunch, 'L9');
    });

    test('once chosen it never moves', () {
      expect(PopupRules.classify(launchId: 'L3', sawOnboarding: false, onboardedLaunch: 'L1', firstSessionLaunch: 'L2'), isNull);
      expect(PopupRules.classify(launchId: 'L3', sawOnboarding: true, onboardedLaunch: 'L1', firstSessionLaunch: 'L2'), isNull);
    });

    test('seeing onboarding twice in the onboarding run changes nothing', () {
      expect(PopupRules.classify(launchId: 'L1', sawOnboarding: true, onboardedLaunch: 'L1', firstSessionLaunch: null), isNull);
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
