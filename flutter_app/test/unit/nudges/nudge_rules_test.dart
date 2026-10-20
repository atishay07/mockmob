import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/nudges/nudge_rules.dart';

void main() {
  final evening = DateTime(2026, 10, 21, 19, 30);
  final night = DateTime(2026, 10, 21, 21, 5);
  final noon = DateTime(2026, 10, 21, 12, 0);

  NudgeFacts calm({
    DateTime? now,
    bool signedIn = true,
    bool inOnboarding = false,
    bool calmScreen = true,
    bool firstSession = false,
    bool isPro = false,
    bool invitesLive = true,
    int? credits,
    int? openRepairs,
    DateTime? lastRepairAt,
    bool practisedToday = false,
    bool hasDailyGoal = false,
    int? chainDays,
    bool chainEndsTonight = false,
    MobGameWaiting? mobGame,
    int friendsJoinedWaiting = 0,
    List<String> rewardEvents = const [],
    LatestResult? latestResult,
    Map<NudgeKind, DateTime> dismissedAt = const {},
    Set<String> seenEvents = const {},
    bool shownThisRun = false,
  }) =>
      NudgeFacts(
        now: now ?? noon,
        signedIn: signedIn,
        inOnboarding: inOnboarding,
        calmScreen: calmScreen,
        firstSession: firstSession,
        isPro: isPro,
        invitesLive: invitesLive,
        credits: credits,
        openRepairs: openRepairs,
        lastRepairAt: lastRepairAt,
        practisedToday: practisedToday,
        hasDailyGoal: hasDailyGoal,
        chainDays: chainDays,
        chainEndsTonight: chainEndsTonight,
        mobGame: mobGame,
        friendsJoinedWaiting: friendsJoinedWaiting,
        rewardEvents: rewardEvents,
        latestResult: latestResult,
        dismissedAt: dismissedAt,
        seenEvents: seenEvents,
        shownThisRun: shownThisRun,
      );

  final game = MobGameWaiting(gameId: 'g1', starterFirstName: 'Riya', kindLabel: 'sprint', closesAt: DateTime(2026, 10, 22, 15, 36));

  group('the gate', () {
    test('a quiet screen when nothing applies', () => expect(NudgeRules.pick(calm()), isNull));
    test('never signed out, in onboarding, over a sheet, or twice in a run', () {
      expect(NudgeRules.pick(calm(signedIn: false, mobGame: game)), isNull);
      expect(NudgeRules.pick(calm(inOnboarding: true, mobGame: game)), isNull);
      expect(NudgeRules.pick(calm(calmScreen: false, mobGame: game)), isNull);
      expect(NudgeRules.pick(calm(shownThisRun: true, mobGame: game)), isNull);
    });
  });

  group('priority', () {
    test('a reward beats a game, which beats everything else', () {
      final f = calm(now: night, rewardEvents: const ['r1'], mobGame: game, chainDays: 5, chainEndsTonight: true, openRepairs: 3);
      expect(NudgeRules.pick(f), const NudgeOffer(NudgeKind.friendPaid, eventId: 'r1', surface: NudgeSurface.sheet));
      final noReward = calm(now: night, mobGame: game, chainDays: 5, chainEndsTonight: true, openRepairs: 3);
      expect(NudgeRules.pick(noReward), const NudgeOffer(NudgeKind.mobGame, eventId: 'game:g1', surface: NudgeSurface.sheet));
    });
    test('the newest unseen reward is the one celebrated, and a seen one never repeats', () {
      final f = calm(rewardEvents: const ['r1', 'r2'], seenEvents: const {'r2'});
      expect(NudgeRules.pick(f)!.eventId, 'r1');
      expect(NudgeRules.pick(calm(rewardEvents: const ['r1', 'r2'], seenEvents: const {'r1', 'r2'})), isNull);
    });
  });

  group('the Mob game', () {
    test('once per game, never after it closes', () {
      expect(NudgeRules.pick(calm(mobGame: game, seenEvents: const {'game:g1'})), isNull);
      final closed = MobGameWaiting(gameId: 'g2', starterFirstName: 'Kabir', kindLabel: 'race', closesAt: DateTime(2026, 10, 21, 11, 0));
      expect(NudgeRules.pick(calm(mobGame: closed)), isNull);
    });
  });

  group('the chain', () {
    test('calls from 8 pm with two days or more at stake and nothing done today', () {
      expect(NudgeRules.pick(calm(now: night, chainDays: 2, chainEndsTonight: true)), const NudgeOffer(NudgeKind.chainRisk, eventId: 'chainRisk:2026-10-21', surface: NudgeSurface.card));
      expect(NudgeRules.pick(calm(now: evening, chainDays: 2, chainEndsTonight: true)), isNull);
      expect(NudgeRules.pick(calm(now: night, chainDays: 1, chainEndsTonight: true)), isNull);
      expect(NudgeRules.pick(calm(now: night, chainDays: 6, chainEndsTonight: true, practisedToday: true)), isNull);
    });
    test('once a day', () {
      expect(NudgeRules.pick(calm(now: night, chainDays: 4, chainEndsTonight: true, seenEvents: const {'chainRisk:2026-10-21'})), isNull);
    });
  });

  group('repairs and practice', () {
    test('mistakes waiting after two idle days', () {
      expect(NudgeRules.pick(calm(openRepairs: 3)), const NudgeOffer(NudgeKind.repairOpen, eventId: 'repairOpen:2026-10-21', surface: NudgeSurface.card));
      expect(NudgeRules.pick(calm(openRepairs: 3, lastRepairAt: DateTime(2026, 10, 20, 9))), isNull);
      expect(NudgeRules.pick(calm(openRepairs: 3, lastRepairAt: DateTime(2026, 10, 18, 9)))!.kind, NudgeKind.repairOpen);
      expect(NudgeRules.pick(calm(openRepairs: 0)), isNull);
      expect(NudgeRules.pick(calm(openRepairs: null)), isNull);
    });
    test('an empty evening with a goal, 6 pm to 11 pm', () {
      expect(NudgeRules.pick(calm(now: evening, hasDailyGoal: true))!.kind, NudgeKind.practiceToday);
      expect(NudgeRules.pick(calm(now: noon, hasDailyGoal: true)), isNull);
      expect(NudgeRules.pick(calm(now: DateTime(2026, 10, 21, 23, 10), hasDailyGoal: true)), isNull);
      expect(NudgeRules.pick(calm(now: evening, hasDailyGoal: true, practisedToday: true)), isNull);
      expect(NudgeRules.pick(calm(now: evening, hasDailyGoal: false)), isNull);
    });
    test('a dismissed kind stays quiet for 7 days', () {
      final dismissed = {NudgeKind.repairOpen: DateTime(2026, 10, 16, 12)};
      expect(NudgeRules.pick(calm(openRepairs: 3, dismissedAt: dismissed)), isNull);
      final old = {NudgeKind.repairOpen: DateTime(2026, 10, 13, 12)};
      expect(NudgeRules.pick(calm(openRepairs: 3, dismissedAt: old))!.kind, NudgeKind.repairOpen);
    });
  });

  group('money and friends', () {
    test('credits low only for Free, after the first session, with invites live', () {
      expect(NudgeRules.pick(calm(credits: 10))!.kind, NudgeKind.creditsLow);
      expect(NudgeRules.pick(calm(credits: 11)), isNull);
      expect(NudgeRules.pick(calm(credits: 4, firstSession: true)), isNull);
      expect(NudgeRules.pick(calm(credits: 4, isPro: true)), isNull);
      expect(NudgeRules.pick(calm(credits: 4, invitesLive: false)), isNull);
      expect(NudgeRules.pick(calm(credits: null)), isNull);
    });
    test('a friend who joined and has not practised', () {
      expect(NudgeRules.pick(calm(friendsJoinedWaiting: 1))!.kind, NudgeKind.friendJoined);
      expect(NudgeRules.pick(calm(friendsJoinedWaiting: 1, invitesLive: false)), isNull);
    });
    test('a good fresh result is an invite moment, once per result', () {
      final r = LatestResult(attemptId: 'a9', completedAt: DateTime(2026, 10, 21, 10), percent: 84);
      expect(NudgeRules.pick(calm(latestResult: r)), const NudgeOffer(NudgeKind.goodResult, eventId: 'result:a9', surface: NudgeSurface.card));
      expect(NudgeRules.pick(calm(latestResult: r, seenEvents: const {'result:a9'})), isNull);
      final weak = LatestResult(attemptId: 'a8', completedAt: DateTime(2026, 10, 21, 10), percent: 60);
      expect(NudgeRules.pick(calm(latestResult: weak)), isNull);
      final best = LatestResult(attemptId: 'a7', completedAt: DateTime(2026, 10, 21, 10), percent: 60, best: true);
      expect(NudgeRules.pick(calm(latestResult: best))!.kind, NudgeKind.goodResult);
      final stale = LatestResult(attemptId: 'a6', completedAt: DateTime(2026, 10, 19, 10), percent: 95);
      expect(NudgeRules.pick(calm(latestResult: stale)), isNull);
    });
  });

  group('memory', () {
    test('round-trips and drops what it cannot read', () {
      final m = NudgeMemory.empty.dismiss(NudgeKind.chainRisk, DateTime(2026, 10, 21, 21)).seen('game:g1').seen('r1');
      final back = NudgeMemory.fromJson(m.toJson());
      expect(back.dismissedAt[NudgeKind.chainRisk], DateTime(2026, 10, 21, 21));
      expect(back.seenEvents, {'game:g1', 'r1'});
      expect(NudgeMemory.fromJson('junk').seenEvents, isEmpty);
      expect(NudgeMemory.fromJson({'dismissed': {'nope': 'x', 'repairOpen': 'not a date'}, 'seen': [1, 'ok']}).seenEvents, {'ok'});
    });
    test('keeps only the newest events', () {
      var m = NudgeMemory.empty;
      for (var i = 0; i < NudgeMemory.keepEvents + 5; i++) {
        m = m.seen('e$i');
      }
      expect(m.seenEvents.length, NudgeMemory.keepEvents);
      expect(m.seenEvents.contains('e0'), isFalse);
      expect(m.seenEvents.contains('e${NudgeMemory.keepEvents + 4}'), isTrue);
    });
  });
}
