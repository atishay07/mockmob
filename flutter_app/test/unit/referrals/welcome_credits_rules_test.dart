// When the welcome-credits sheet opens (owner, 20 Oct 11:20 pm): once per account, on Today, about 600 ms after a new
// account's after-sign-in sheet closes; never over onboarding or another modal; never for a returning account.

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/referrals/referral_copy.dart';
import 'package:mockmob/features/referrals/welcome_credits_rules.dart';
import 'package:mockmob/features/referrals/welcome_credits_trigger.dart';

WelcomeCreditsMoment _m({
  String? armedFor = 'u1',
  String? signedInAs = 'u1',
  bool sheetClosed = true,
  String location = AppRoutes.today,
  bool modalOnTop = false,
  bool shownThisRun = false,
  bool shownForAccount = false,
  Duration sinceClosed = Duration.zero,
}) =>
    WelcomeCreditsMoment(
      armedFor: armedFor,
      signedInAs: signedInAs,
      sheetClosed: sheetClosed,
      location: location,
      modalOnTop: modalOnTop,
      shownThisRun: shownThisRun,
      shownForAccount: shownForAccount,
      sinceClosed: sinceClosed,
    );

/// A trigger over a fake app: where the router is, whether a modal is up, who is signed in, and every open.
class _App {
  _App() {
    trigger = WelcomeCreditsTrigger(
      prefs: prefs,
      signedInAs: () => user,
      location: () => location,
      modalOnTop: () => modal,
      open: () async => opened++,
    );
  }

  final MemoryPrefsStore prefs = MemoryPrefsStore();
  late final WelcomeCreditsTrigger trigger;
  String? user = 'u1';
  String _location = AppRoutes.today;
  String get location => _location;
  // The real provider listens to the router delegate; the fake reports each move the same way.
  set location(String v) {
    _location = v;
    trigger.routeChanged();
  }
  bool modal = false;
  int opened = 0;
}

void main() {
  group('the rules', () {
    test('shown on Today with nothing over it once the sheet closed', () {
      expect(decideWelcomeCredits(_m()), WelcomeCreditsDecision.show);
    });

    test('never for an account whose sheet was not offered in this run (a returning account)', () {
      expect(decideWelcomeCredits(_m(armedFor: null)), WelcomeCreditsDecision.notOwed);
      expect(decideWelcomeCredits(_m(signedInAs: 'u2')), WelcomeCreditsDecision.notOwed);
      expect(decideWelcomeCredits(_m(signedInAs: null)), WelcomeCreditsDecision.notOwed);
    });

    test('once per account and once per run', () {
      expect(decideWelcomeCredits(_m(shownForAccount: true)), WelcomeCreditsDecision.notOwed);
      expect(decideWelcomeCredits(_m(shownThisRun: true)), WelcomeCreditsDecision.notOwed);
    });

    test('waits while the after-sign-in sheet, an onboarding route, another page or a modal is on top', () {
      expect(decideWelcomeCredits(_m(sheetClosed: false)), WelcomeCreditsDecision.wait);
      expect(decideWelcomeCredits(_m(location: AppRoutes.beforeYouStart)), WelcomeCreditsDecision.wait);
      expect(decideWelcomeCredits(_m(location: '/onboarding')), WelcomeCreditsDecision.wait);
      expect(decideWelcomeCredits(_m(location: AppRoutes.youCredits)), WelcomeCreditsDecision.wait);
      expect(decideWelcomeCredits(_m(location: AppRoutes.todayWeek)), WelcomeCreditsDecision.wait);
      expect(decideWelcomeCredits(_m(modalOnTop: true)), WelcomeCreditsDecision.wait);
    });

    test('belongs to the first minutes: gone after the window', () {
      expect(decideWelcomeCredits(_m(sinceClosed: welcomeCreditsWindow + const Duration(seconds: 1))), WelcomeCreditsDecision.notOwed);
    });

    test('the flag is kept per account', () {
      expect(welcomeCreditsShownKey('abc'), 'welcome.credits.v1.shown.abc');
    });
  });

  group('the trigger', () {
    test('opens about 600 ms after the sheet closes, once, and remembers it for the account', () {
      fakeAsync((async) {
        final app = _App()..location = AppRoutes.beforeYouStart;
        app.trigger.arm('u1');
        async.elapse(const Duration(seconds: 3));
        expect(app.opened, 0, reason: 'the after-sign-in sheet is still up');
        app.location = AppRoutes.today;
        app.trigger.sheetClosed();
        async.elapse(const Duration(milliseconds: 300));
        expect(app.opened, 0, reason: 'not before about 600 ms');
        async.elapse(const Duration(milliseconds: 900));
        expect(app.opened, 1);
        async.elapse(const Duration(seconds: 5));
        expect(app.opened, 1, reason: 'once');
        bool? kept;
        app.prefs.getBool(welcomeCreditsShownKey('u1')).then((v) => kept = v);
        async.flushMicrotasks();
        expect(kept, isTrue);
        // Armed again in the same run (a second sign-in): never twice.
        app.trigger.arm('u1');
        async.elapse(const Duration(seconds: 3));
        expect(app.opened, 1);
      });
    });

    test('a sheet that closed without its route answering still counts once Today is back', () {
      fakeAsync((async) {
        final app = _App()..location = AppRoutes.beforeYouStart;
        app.trigger.arm('u1');
        async.elapse(const Duration(seconds: 1));
        app.location = AppRoutes.today;
        async.elapse(const Duration(seconds: 2));
        expect(app.opened, 1);
      });
    });

    test('never over onboarding or another modal; opens once Today is clear again', () {
      fakeAsync((async) {
        final app = _App()..location = AppRoutes.beforeYouStart;
        app.trigger.arm('u1');
        async.elapse(const Duration(milliseconds: 600));
        app.trigger.sheetClosed();
        app.location = '/onboarding';
        async.elapse(const Duration(seconds: 5));
        expect(app.opened, 0);
        app.location = AppRoutes.today;
        app.modal = true;
        async.elapse(const Duration(seconds: 5));
        expect(app.opened, 0);
        app.modal = false;
        async.elapse(const Duration(seconds: 2));
        expect(app.opened, 1);
      });
    });

    test('an account that has seen it on this phone never sees it again', () {
      fakeAsync((async) {
        final app = _App();
        app.prefs.setBool(welcomeCreditsShownKey('u1'), true);
        async.flushMicrotasks();
        app.trigger.arm('u1', sheetClosed: true);
        async.elapse(const Duration(seconds: 5));
        expect(app.opened, 0);
      });
    });

    test('a returning account (never armed) never sees it', () {
      fakeAsync((async) {
        final app = _App();
        async.elapse(const Duration(seconds: 5));
        expect(app.opened, 0);
      });
    });

    test('a different account signed in by then is not shown the first one\'s welcome', () {
      fakeAsync((async) {
        final app = _App();
        app.trigger.arm('u1', sheetClosed: true);
        app.user = 'u2';
        async.elapse(const Duration(seconds: 5));
        expect(app.opened, 0);
      });
    });

    test('the demo fixture shows it at every launch, flag or not', () {
      fakeAsync((async) {
        final app = _App();
        app.prefs.setBool(welcomeCreditsShownKey('u1'), true);
        async.flushMicrotasks();
        app.trigger.arm('u1', sheetClosed: true, ignoreFlag: true);
        async.elapse(const Duration(seconds: 2));
        expect(app.opened, 1);
      });
    });
  });

  test('words: no exclamation marks, emoji, arrows, em dashes or loss words', () {
    final all = [
      ReferralCopy.welcomeUnit, ReferralCopy.welcomeWhat, ReferralCopy.welcomeInviteTitle(100), ReferralCopy.welcomeInviteHow,
      ReferralCopy.welcomeInvite, ReferralCopy.welcomeLater, ReferralCopy.welcomeStart, ReferralCopy.title(100), ReferralCopy.how(100),
      ReferralCopy.mobLine(100), ReferralCopy.cap(10), ReferralCopy.shareText(100, 'https://www.mockmob.in/r/K7P2M9X'),
      ReferralCopy.none, ReferralCopy.paused, ReferralCopy.capReached(10, 100), ReferralCopy.invitedJoined(100),
      ReferralCopy.invitedRewarded(100), ReferralCopy.earned(100), ReferralCopy.notCounted(2), ReferralCopy.codeAdded(100),
      ReferralCopy.codeBad, ReferralCopy.codeUnknown, ReferralCopy.codeOwn, ReferralCopy.codeUsed, ReferralCopy.codeNotNew,
      ReferralCopy.codeOffline, ReferralCopy.codeBusy, ReferralCopy.codeOff,
    ];
    for (final w in all) {
      expect(w, isNot(matches(RegExp(r'[!—·→←]'))), reason: w);
      expect(w.toLowerCase(), isNot(matches(RegExp(r'\b(lost|behind|last)\b'))), reason: w);
      expect(w.runes.every((r) => r < 0x2190), isTrue, reason: 'no emoji or symbols: $w');
    }
    // The facts stay: 100 each, one finished practice, a cap a month.
    expect(ReferralCopy.how(100), contains('100 credits'));
    expect(ReferralCopy.how(100), contains('one practice'));
    expect(ReferralCopy.cap(10), contains('10 friends a month'));
    expect(ReferralCopy.shareText(100, 'https://x'), endsWith('https://x'));
  });
}
