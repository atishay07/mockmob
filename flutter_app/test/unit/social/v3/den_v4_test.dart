// V4 den (pass-1020 MOB-MINIMAL 3.1 item 3, 3.6, 4.2): the nine-step ladder's new steps and the Mob
// hours contract (`v3.hours`, absent = hidden).

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/den_copy_state.dart';
import 'package:mockmob/features/social/v3/widgets/den_motion.dart';
import 'package:mockmob/features/social/v3/widgets/den_stage.dart';
import 'package:mockmob/features/social/v3/widgets/quest_segments.dart';

import 'mob_v3_test_kit.dart';

DenCard _card(MobV3FakeServer s) {
  final r = MobRead.fromJson(s.denNow());
  return denCardFor(r.v3!, paperSat: r.mob?.week.youSat ?? false);
}

MobV3 _v3(MobV3FakeServer s) => MobRead.fromJson(s.denNow()).v3!;

void main() {
  group('ladder', () {
    test('step 2: Fix it together is ready, ahead of an open game', () {
      final c = _card(v3Server(scenario: 'open')..denFix = {'gameId': 'g', 'question': 4, 'state': 'ready'});
      expect(c.kind, DenCardKind.fix);
      expect(ladderStep(c.kind), 2);
      expect(c.fix!.question, 4);
    });

    test('step 3: the Wednesday check', () {
      final c = _card(v3Server(scenario: 'played')..denFix = {'gameId': 'g', 'question': 4, 'state': 'check'});
      expect(c.kind, DenCardKind.check);
      expect(ladderStep(c.kind), 3);
    });

    test('step 1 beats step 2: a live room you are not in comes first', () {
      final c = _card(v3Server(scenario: 'live')..denFix = {'gameId': 'g', 'question': 4});
      expect(ladderStep(c.kind), 1);
    });

    test('step 5: the paper unplayed, before a game you already played', () {
      final c = _card(v3Server(scenario: 'played')..setPaperSat(false));
      expect(c.kind, DenCardKind.paper);
    });

    test('step 7: a brand-new week puts Start a game ahead of the paper', () {
      final c = _card(v3Server(scenario: 'quiet')
        ..makeNew()
        ..setPaperSat(false));
      expect(c.kind, DenCardKind.quiet);
      expect(c.fresh, isTrue);
      expect(c.keyIsStart, isTrue);
    });

    test('step 9: a Mob of one', () {
      expect(ladderStep(_card(v3Server(scenario: 'one')).kind), 9);
    });
  });

  group('Mob hours', () {
    test('absent when the server has not shipped it', () {
      expect(_v3(v3Server(scenario: 'open')..hoursShipped = false).hours, isNull);
    });

    test('lists only sharing members with minutes, most first; the total is the server\'s', () {
      final h = _v3(v3Server(scenario: 'open')).hours!;
      expect(h.members.map((m) => m.minutes), [190, 160, 115]);
      expect(h.members.every((m) => m.minutes > 0), isTrue);
      expect(h.totalMinutes, 465);
      expect(h.targetMinutes, 600);
      expect(h.topMemberId, h.members.first.memberId);
      expect(h.offForEveryone, isFalse);
    });

    test('a member with 0 minutes is dropped even if a server sends one', () {
      final h = MobHours.fromJsonOrNull({
        'week_start': '2026-10-19',
        'target_minutes': 300,
        'total_minutes': 40,
        'me_sharing': true,
        'members': [
          {'member_id': 'a', 'first_name': 'Riya', 'minutes': 0, 'goal_days': 1},
          {'member_id': 'b', 'first_name': 'Kabir', 'minutes': 40, 'goal_days': 5},
        ],
        'top_member_id': 'b',
        'studying_now': [
          {'member_id': 'b', 'first_name': 'Kabir', 'since': '2026-10-22T10:22:00Z'},
        ],
      })!;
      expect(h.members.single.firstName, 'Kabir');
      expect(h.members.single.weekTick, isTrue);
      expect(h.studyingNow.single.memberId, 'b');
    });

    test('sharing with no minutes yet (Monday morning) is not off: the figure reads 0 m of 2 h 30 m', () {
      final h = MobHours.fromJsonOrNull({'week_start': '2026-10-19', 'target_minutes': 150, 'total_minutes': 0, 'me_sharing': true, 'members': <Object>[], 'top_member_id': null, 'studying_now': <Object>[]})!;
      expect(h.offForEveryone, isFalse);
      expect(h.members, isEmpty);
      expect(MobV4DenCopy.hm(h.totalMinutes), '0 m');
      expect(MobV4DenCopy.hoursOf(h.targetMinutes), 'of 2 h 30 m');
      expect(MobHours.fromJsonOrNull({'target_minutes': 0, 'total_minutes': 0, 'members': <Object>[]})!.offForEveryone, isTrue);
    });

    test('the invite footer counts the seats left', () {
      expect(MobV4DenCopy.inviteWorksFor(1), 'Works for 7 days, for 1 friend.');
      expect(MobV4DenCopy.inviteWorksFor(3), 'Works for 7 days, for up to 3 friends.');
    });

    test('nobody shares: Off for everyone', () {
      expect(_v3(v3Server(scenario: 'quiet')).hours!.offForEveryone, isTrue);
    });

    test('studying now: a friend, never you, never in a Mob of one', () {
      final (st, m) = DenStage.studierOf(_v3(v3Server(scenario: 'open')));
      expect(st, isNotNull);
      expect(m!.you, isFalse);
      expect(DenStage.studierOf(_v3(v3Server(scenario: 'one'))).$1, isNull);
    });
  });

  test('den life timings follow 4.2', () {
    expect(DenLife.breathe.inMilliseconds, 3600);
    expect(DenLife.blink.inMilliseconds, 150);
    expect(DenLife.foldStep.inMilliseconds, 90);
    for (var i = 0; i < 5; i++) {
      final d = DenLife.seeded(DenLife.blinkEveryMin, DenLife.blinkEveryMax, i, 0);
      expect(d >= DenLife.blinkEveryMin && d <= DenLife.blinkEveryMax, isTrue);
    }
  });

  group('review fixes', () {
    test('an empty week says when: "15 each by Sunday stitches week 1"', () {
      expect(MobV4DenCopy.questLine(const Quest(target: 60, sizedFor: 4), 0), '15 each by Sunday stitches week 1');
      expect(MobV4DenCopy.questLine(const Quest(target: 15), 3), '15 by Sunday stitches week 4');
      expect(MobV4DenCopy.questLine(const Quest(target: 60, answered: 51, sizedFor: 4), 3), '9 more stitches week 4');
    });

    test('screen readers hear hours and minutes as words', () {
      expect(MobV4DenCopy.hmSpoken(465), '7 hours 45 minutes');
      expect(MobV4DenCopy.hmSpoken(60), '1 hour');
      expect(MobV4DenCopy.hmSpoken(45), '45 minutes');
      expect(MobV4DenCopy.hmSpoken(61), '1 hour 1 minute');
      expect(MobV4DenCopy.hoursSemantics(465, 600), 'Mob hours: 7 hours 45 minutes of practice this week, out of 10 hours.');
      expect(MobV4DenCopy.memberHoursSemantics('Riya', 190), 'Riya, 3 hours 10 minutes');
    });

    test('the Free price line carries the balance or the shortfall', () {
      expect(MobV4DenCopy.sitCostLine(50, null), 'For you: 50 credits.');
      expect(MobV4DenCopy.sitCostLine(50, 120), 'For you: 50 credits. You have 120.');
      expect(MobV4DenCopy.sitCostLine(50, 20), 'For you: 50 credits. You have 20, so you need 30 more.');
    });

    test('quest segments fill whole segments only', () {
      expect(QuestSegments.filledOf(51, 60), 10);
      expect(QuestSegments.filledOf(59, 60), 11);
      expect(QuestSegments.filledOf(60, 60), 12);
      expect(QuestSegments.filledOf(70, 60), 12);
      expect(QuestSegments.filledOf(0, 60), 0);
      expect(QuestSegments.filledOf(4, 60), 0);
      expect(QuestSegments.filledOf(5, 0), 0);
    });
  });
}
