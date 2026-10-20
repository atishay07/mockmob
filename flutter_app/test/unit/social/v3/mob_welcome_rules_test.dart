// The Mob welcome's rules and timeline (V16 A3, logic/mob_welcome.dart, widgets/welcome_stage.dart).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/social/data/mob_repository.dart' show mobPrefsStoreProvider;
import 'package:mockmob/features/social/v3/logic/explainer_flow.dart';
import 'package:mockmob/features/social/v3/logic/mob_welcome.dart';
import 'package:mockmob/features/social/v3/widgets/fold_acts.dart' show JoinAct;
import 'package:mockmob/features/social/v3/widgets/welcome_stage.dart';

import '../../you/you_test_support.dart' show youOverrides;
import 'social_test_kit.dart' show aaravAuth;

/// A prefs store whose reads and writes fail.
class _Broken extends MemoryPrefsStore {
  @override
  Future<bool?> getBool(String key) => Future.error(StateError('disk'));

  @override
  Future<void> setBool(String key, bool value) => Future.error(StateError('disk'));
}

void main() {
  const open = WelcomeMoment(seen: false, tabShown: true, rootOnTop: true);

  group('when it plays', () {
    test('the first time the tab root is on screen, and only then', () {
      expect(MobWelcomeRules.decide(open), WelcomeCall.play);
      expect(MobWelcomeRules.decide(const WelcomeMoment(seen: true, tabShown: true, rootOnTop: true)), WelcomeCall.seen);
      expect(MobWelcomeRules.decide(const WelcomeMoment(seen: false, tabShown: true, rootOnTop: true, opening: true)), WelcomeCall.busy);
    });

    test('never in a hidden tab, under a route (run, explainer, sheet, onboarding) or a results run', () {
      expect(MobWelcomeRules.decide(const WelcomeMoment(seen: false, tabShown: false, rootOnTop: true)), WelcomeCall.hiddenTab);
      expect(MobWelcomeRules.decide(const WelcomeMoment(seen: false, tabShown: true, rootOnTop: false)), WelcomeCall.covered);
      expect(MobWelcomeRules.decide(const WelcomeMoment(seen: false, tabShown: true, rootOnTop: true, resultsRun: true)), WelcomeCall.covered);
      expect(MobWelcomeRules.shouldPlay(const WelcomeMoment(seen: false, tabShown: true, rootOnTop: false)), isFalse);
    });

    test('only a covered root asks again; seen and busy never do', () {
      expect(MobWelcomeRules.askAgain(WelcomeCall.covered), isTrue);
      for (final c in [WelcomeCall.play, WelcomeCall.seen, WelcomeCall.busy, WelcomeCall.hiddenTab]) {
        expect(MobWelcomeRules.askAgain(c), isFalse, reason: '$c');
      }
    });

    test('See how it works: Start in no Mob, a replay for a member', () {
      expect(MobWelcomeRules.explainerVia(inMob: false), ExplainerVia.start);
      expect(MobWelcomeRules.explainerVia(inMob: true), ExplainerVia.replay);
    });

    test('the demo build plays it only in the fresh scenario', () {
      expect(MobWelcomeRules.demoCountsSeen('fresh'), isFalse);
      for (final s in ['heavy', 'one', 'quiet', 'open', 'played', 'live', 'formats']) {
        expect(MobWelcomeRules.demoCountsSeen(s), isTrue, reason: s);
      }
    });
  });

  group('the seen flag', () {
    test('the key is per account', () {
      expect(mobWelcomeSeenKey('u1'), 'mob.welcome.v1.seen.u1');
      expect(mobWelcomeSeenKey('u2'), isNot(mobWelcomeSeenKey('u1')));
      expect(mobWelcomeSeenKey(null), 'mob.welcome.v1.seen.anon');
      expect(mobWelcomeSeenKey('u1'), isNot(explainerSeenKey('u1')));
    });

    ProviderContainer container(PrefsStore store, {String? demo}) {
      final c = ProviderContainer(
        overrides: [
          ...youOverrides(auth: aaravAuth),
          mobPrefsStoreProvider.overrideWithValue(store),
          mobWelcomeDemoProvider.overrideWithValue(demo),
        ],
      );
      addTearDown(c.dispose);
      return c;
    }

    test('read and mark this account on this phone', () async {
      final store = MemoryPrefsStore();
      final seen = container(store).read(mobWelcomeSeenProvider);
      expect(await seen.read(), isFalse);
      await seen.mark();
      expect(await seen.read(), isTrue);
      expect(await store.getBool('mob.welcome.v1.seen.u1'), isTrue);
    });

    test('a read that fails counts as seen (never loops); a write that fails is quiet', () async {
      final seen = container(_Broken()).read(mobWelcomeSeenProvider);
      expect(await seen.read(), isTrue);
      await seen.mark();
    });

    test('the demo keeps the fresh flag for the run only, never on the phone', () async {
      final store = MemoryPrefsStore();
      final seen = container(store, demo: 'fresh').read(mobWelcomeSeenProvider);
      expect(await seen.read(), isFalse);
      await seen.mark();
      expect(await seen.read(), isTrue);
      expect(await store.getBool('mob.welcome.v1.seen.u1'), isNull);
      expect(await container(MemoryPrefsStore(), demo: 'heavy').read(mobWelcomeSeenProvider).read(), isTrue);
    });

    test('the run waits for the welcome flow to close', () async {
      final run = MobWelcomeRun();
      await run.idle();
      run.onScreen.value = true;
      var done = false;
      final f = run.idle().then((_) => done = true);
      await Future<void>.delayed(Duration.zero);
      expect(done, isFalse);
      run.onScreen.value = false;
      await f;
      expect(done, isTrue);
    });
  });

  group('the timeline', () {
    test('lamp first: the bulb in 150 ms, then the beam over 300 ms', () {
      expect(WelcomeTimeline.bulb(0), 0);
      expect(WelcomeTimeline.bulb(150), 1);
      expect(WelcomeTimeline.beam(150), 0);
      expect(WelcomeTimeline.beam(450), 1);
      expect(WelcomeTimeline.room(0), 0);
      expect(WelcomeTimeline.room(1100), 1);
    });

    test('three Folds 350 ms apart from 500 ms, each landing with the friend-joins squash', () {
      expect([for (var i = 0; i < 3; i++) WelcomeTimeline.foldStart(i)], [500, 850, 1200]);
      expect(WelcomeTimeline.landing(0), 500 + JoinAct.land);
      for (var i = 0; i < 3; i++) {
        expect(WelcomeTimeline.fold(i, WelcomeTimeline.foldStart(i) - 1, fromDx: -100).opacity, 0, reason: 'not in before its start');
        final low = WelcomeTimeline.fold(i, WelcomeTimeline.landing(i) + 90, fromDx: -100);
        expect(low.scaleX, closeTo(1.12, 0.001));
        expect(low.scaleY, closeTo(0.86, 0.001));
        expect(WelcomeTimeline.fold(i, WelcomeTimeline.landing(i) + 400, fromDx: -100).dx, closeTo(0, 0.001));
      }
      expect(WelcomeCast.folds.toSet().length, 3);
      expect(WelcomeCast.slots, isNot(contains(WelcomeCast.seatSlot)));
    });

    test('the seat at 2000, the pennant at 2300, the headline at 2800 (rising 10 dp), the keys at 3400', () {
      expect(WelcomeTimeline.seat(1999), 0);
      expect(WelcomeTimeline.seat(2420), 1);
      expect(WelcomeTimeline.pennant(2299).$1, 0);
      expect(WelcomeTimeline.pennant(2300 + WelcomeTimeline.pennantDrop).$2, 0);
      expect(WelcomeTimeline.headline(2799), (0.0, 10.0));
      expect(WelcomeTimeline.headline(3300), (1.0, 0.0));
      expect(WelcomeTimeline.keys(3399).$1, 0);
      expect(WelcomeTimeline.keysLive(3399), isFalse);
      expect(WelcomeTimeline.keysLive(3700), isTrue);
      expect(WelcomeTimeline.total, lessThanOrEqualTo(4500));
    });

    test('Skip shows from 600 ms until the keys arrive, never under reduced motion', () {
      expect(WelcomeTimeline.skipShown(599), isFalse);
      expect(WelcomeTimeline.skipShown(600), isTrue);
      expect(WelcomeTimeline.skipShown(WelcomeTimeline.keysAt), isFalse);
      expect(WelcomeTimeline.skipShown(1000, reduced: true), isFalse);
    });

    test('reduced motion: fades in the same order, no hops, over in 1.2 s', () {
      for (var ms = 0.0; ms <= WelcomeTimeline.reducedTotal; ms += 20) {
        for (var i = 0; i < 3; i++) {
          final f = WelcomeTimeline.fold(i, ms, fromDx: -100, reduced: true);
          expect(f.dx, 0);
          expect(f.dy, 0);
          expect(f.scaleY, 1);
        }
        expect(WelcomeTimeline.headline(ms, reduced: true).$2, 0);
        expect(WelcomeTimeline.pennant(ms, reduced: true).$3, 0);
      }
      expect(WelcomeTimeline.room(120, reduced: true), 1);
      expect(WelcomeTimeline.keys(WelcomeTimeline.reducedTotal, reduced: true).$1, 1);
      expect(WelcomeTimeline.fold(2, WelcomeTimeline.reducedTotal, fromDx: -100, reduced: true).opacity, 1);
    });
  });
}
