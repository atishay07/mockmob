import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/logic/mob_ring.dart';

import 'mob_test_kit.dart';

Mob get mob => MobRead.fromJson(mobFixture('get_v1.json')).mob!;

void main() {
  group('parse', () {
    test('missing fields take safe defaults', () {
      final m = Mob.fromJson(const {'subject': 'economics'});
      expect(m.members, isEmpty);
      expect(m.week.sat, 0);
      expect(m.week.size, 1);
      expect(m.week.paper.costType, MobCostType.unknown);
      expect(m.trap, isNull);
      expect(m.invite, isNull);
      expect(m.plan.pro, isFalse);
      expect(m.plan.maxMobs, 1);
      expect(m.extras, isEmpty);
      expect(m.pastWeeks, 0);
      expect(m.compare, isNull);
    });

    test('an unknown field is ignored, a bare body is no Mob', () {
      final j = mobJson();
      (j['mob'] as Map)['futureField'] = {'ignored': true};
      expect(MobRead.fromJson(j).mob!.members, hasLength(4));
      expect(MobRead.fromJson(const {}).mob, isNull);
    });

    test('members keep join order and never exceed 5', () {
      final j = mobJson();
      (j['mob'] as Map)['members'] = [for (var i = 0; i < 7; i++) {'memberId': 'm$i', 'name': 'N$i', 'sat': i.isEven}];
      expect(MobRead.fromJson(j).mob!.members.map((m) => m.memberId), ['m0', 'm1', 'm2', 'm3', 'm4']);
    });

    test('sat is clamped to size, colour to 0..7', () {
      final m = Mob.fromJson(const {
        'week': {'sat': 9, 'size': 3},
        'members': [
          {'memberId': 'a', 'name': 'Zed', 'colour': 42},
        ],
      });
      expect(m.week.sat, 3);
      expect(m.members.single.colour, 7);
    });

    test('a score is { value, of } and shows as "7 of 10"', () {
      final asha = mob.members.firstWhere((m) => m.name == 'Asha');
      expect(asha.scoreLine, '7 of 10');
      expect(mob.members.firstWhere((m) => m.name == 'Kabir').scoreLine, isNull);
    });

    test('a ring of one Mob member is never "complete"', () {
      expect(Mob.fromJson(const {'week': {'sat': 1, 'size': 1}}).week.complete, isFalse);
      expect(Mob.fromJson(const {'week': {'sat': 4, 'size': 4}}).week.complete, isTrue);
    });

    test('the week key is the Monday, zero padded', () {
      expect(mob.week.key, '2026-10-12');
      expect(const MobWeek().key, 'unknown');
    });

    test('an old plan-less body is Free in one Mob', () {
      final m = Mob.fromJson(const {'subject': 'accountancy', 'members': []});
      expect(m.plan.canStartAnother, isFalse);
      expect(m.several, isFalse);
    });
  });

  group('trap (P7)', () {
    test('the letter, the line and the name', () {
      expect(mob.trap!.option, 'B');
      expect(MobCopy.trapLine(mob.trap!), 'Your Mob\'s trap: 3 of 3 picked B on question 6.');
      expect(MobCopy.trapName(mob.trap!), 'Trap: A look-alike term. You picked B too.');
    });

    test('refused under 3 sitters, under 2 picks, or under half', () {
      expect(MobTrap.fromJson(const {'questionNumber': 1, 'option': 'A', 'count': 2, 'of': 2}), isNull);
      expect(MobTrap.fromJson(const {'questionNumber': 1, 'option': 'A', 'count': 1, 'of': 3}), isNull);
      expect(MobTrap.fromJson(const {'questionNumber': 1, 'option': 'A', 'count': 2, 'of': 5}), isNull);
      expect(MobTrap.fromJson(const {'questionNumber': 1, 'option': 'A', 'count': 3, 'of': 5}), isNotNull);
    });

    test('shown only to a member who sat', () {
      final j = mobJson();
      (j['mob']['week'] as Map)['youSat'] = false;
      expect(MobRead.fromJson(j).mob!.visibleTrap, isNull);
      expect(mob.visibleTrap, isNotNull);
    });

    test('without a tagged name the line says a common wrong pick; a right answer says so', () {
      final t = MobTrap.fromJson(const {'questionNumber': 2, 'option': 'C', 'count': 2, 'of': 3, 'youGotItRight': true})!;
      expect(MobCopy.trapName(t), 'A common wrong pick. You got this one right.');
      final none = MobTrap.fromJson(const {'questionNumber': 2, 'option': 'C', 'count': 2, 'of': 3})!;
      expect(MobCopy.trapName(none), 'A common wrong pick. You did not pick it.');
    });
  });

  group('together and the teaser', () {
    test('the together line, for two and for more', () {
      expect(MobCopy.togetherLine(const MobTogether(withCount: 1, sameRight: 6, of: 10, sharedMiss: 4)), 'You and 1 other member both got the same 6 questions right. You both missed question 4.');
      expect(MobCopy.togetherLine(const MobTogether(withCount: 2, sameRight: 1, of: 10)), 'You and 2 other members all got the same question right.');
      expect(MobCopy.togetherLine(const MobTogether(withCount: 1, sameRight: 0, of: 10)), 'You and 1 other member got no question right in common.');
    });

    test('the server\'s together object parses; a malformed one is dropped', () {
      final j = mobJson();
      (j['mob'] as Map)['together'] = {'with': 1, 'sameRight': 6, 'of': 10, 'sharedMiss': 4};
      expect(MobRead.fromJson(j).mob!.together!.sameRight, 6);
      (j['mob'] as Map)['together'] = {'with': 0};
      expect(MobRead.fromJson(j).mob!.together, isNull);
    });

    test('compare access: free offer needs two sharers; the sample and full open', () {
      MobCompareSummary c(String access, {bool needsShare = false, bool available = true}) =>
          MobCompareSummary.fromJson({'available': available, 'access': access, 'needsShare': needsShare, 'youShare': true})!;
      expect(c('offer', needsShare: true).canOpen, isFalse);
      expect(c('offer').canOpen, isTrue);
      expect(c('sample').canOpen, isTrue);
      expect(c('full').canOpen, isTrue);
      expect(c('locked').canOpen, isFalse);
      expect(c('locked').locked, isTrue);
      expect(c('full', available: false).canOpen, isFalse);
      expect(c('something new').canOpen, isFalse);
    });
  });

  group('ring', () {
    test('sitters fill in order, open seats unlabelled', () {
      final plan = ringPlan(mob, seenSat: 1);
      expect(plan.segments, [RingSegment.filled, RingSegment.fresh, RingSegment.fresh, RingSegment.open]);
      expect(plan.sitters.map((m) => m.initial), ['R', 'A', 'K']);
      expect(plan.complete, isFalse);
      expect(plan.freshCount, 2);
    });

    test('reduced motion inks nothing', () {
      final plan = ringPlan(mob, reducedMotion: true);
      expect(plan.freshCount, 0);
      expect(plan.sat, 3);
    });

    test('0, 1, 3 and 5 of 5', () {
      for (final sat in [0, 1, 3, 5]) {
        final m = Mob.fromJson({
          'week': {'sat': sat, 'size': 5},
        });
        final plan = ringPlan(m, seenSat: sat);
        expect(plan.size, 5);
        expect(plan.sat, sat);
        expect(plan.complete, sat == 5);
      }
    });

    test('ink timing: 220 ms each, 60 ms step', () {
      expect(ringInkTotal(3), const Duration(milliseconds: 340));
      final (s, e) = ringInkInterval(1, 3);
      expect(s, closeTo(60 / 340, 1e-9));
      expect(e, closeTo(280 / 340, 1e-9));
    });

    test('a seen count above the sat count (someone left) never overfills', () {
      final plan = ringPlan(mob, seenSat: 9);
      expect(plan.freshCount, 0);
      expect(plan.sat, 3);
    });
  });

  group('names, codes, ids', () {
    test('display names (P3)', () {
      expect(isValidMobName('Asha'), isTrue);
      expect(isValidMobName('Anne-Marie'), isTrue);
      expect(isValidMobName("D'Souza"), isTrue);
      expect(isValidMobName('Zoë'), isTrue);
      // Vowel signs and the virama are combining marks: the server accepts them after the first letter.
      expect(isValidMobName('अनन्या'), isTrue);
      expect(isValidMobName('  Asha   Rao '), isTrue);
      expect(isValidMobName('A'), isFalse);
      expect(isValidMobName('1Asha'), isFalse);
      expect(isValidMobName('Asha 😀'), isFalse);
      expect(isValidMobName('a' * 19), isFalse);
      expect(isValidMobName('http://x'), isFalse);
    });

    test('invite codes, Crockford base32', () {
      expect(normaliseInviteCode('7k3m9qxa'), '7K3M9QXA');
      expect(normaliseInviteCode('7K3M-9QXA'), '7K3M9QXA');
      expect(normaliseInviteCode('7K3M 9QXA'), '7K3M9QXA');
      expect(normaliseInviteCode('7KQ2M9XO'), '7KQ2M9X0', reason: 'O reads as 0');
      expect(normaliseInviteCode('7K3M9QXU'), isNull);
      expect(normaliseInviteCode('short'), isNull);
      expect(inviteCodeFromLink('https://www.mockmob.in/join/7K3M9QXA'), '7K3M9QXA');
      expect(inviteCodeFromLink('https://www.mockmob.in/join/7K3M9QXA?utm=x'), '7K3M9QXA');
      expect(inviteCodeFromLink('7K3M9QXA'), '7K3M9QXA');
    });

    test('a Mob id is a uuid', () {
      expect(isMobId('7b0c5d8e-1f2a-4b3c-9d4e-5f6a7b8c9d0e'), isTrue);
      expect(isMobId('7b0c5d8e'), isFalse);
      expect(isMobId(null), isFalse);
    });
  });

  group('copy', () {
    test('times are 12-hour IST', () {
      expect(formatIstDayTime(DateTime.utc(2026, 10, 23, 16, 10)), 'Fri 23 Oct, 9:40 PM');
      expect(formatIstDayTime(DateTime.utc(2026, 10, 18, 18, 29)), 'Sun 18 Oct, 11:59 PM');
      expect(formatIstDayTime(DateTime.utc(2026, 10, 18, 19, 0)), 'Mon 19 Oct, 12:30 AM');
      expect(weekLabel('2026-10-05'), 'Week of 5 Oct');
      expect(weekLabel('nope'), 'This week');
    });

    test('the cost line is only what the server quoted', () {
      MobPaper p(Map<String, dynamic>? cost) => MobPaper.fromJson({'count': 10, 'durationSec': 720, 'cost': cost});
      expect(MobCopy.costLine(p({'type': 'free'})), 'Free. No credits.');
      expect(MobCopy.costLine(p({'type': 'included'})), 'Included with Pro.');
      expect(MobCopy.costLine(p({'type': 'allowance'})), 'Free today.');
      expect(MobCopy.costLine(p({'type': 'credits', 'credits': 10, 'balance': 40})), '10 credits. You have 40.');
      expect(MobCopy.costLine(p({'type': 'credits', 'credits': 10, 'balance': 4})), '10 credits. You have 4, so you need 6 more.');
      expect(MobCopy.costLine(p({'type': 'credits'})), isNull, reason: 'never a number the server did not send');
      expect(MobCopy.costLine(p(null)), isNull);
      expect(p({'type': 'free'}).minutes, 12);
    });

    test('the nudge reasons and the compare notes', () {
      expect(MobCopy.nudgeReason(MobNudgeReason.sent), 'You asked the others this week.');
      expect(MobCopy.nudgeReason(MobNudgeReason.everyoneSat), 'Everyone has sat this week.');
      expect(MobCopy.nudgeReason(MobNudgeReason.none), isNull);
      MobCompareSummary c(String access, {bool needsShare = false, bool youShare = true}) =>
          MobCompareSummary.fromJson({'available': true, 'access': access, 'needsShare': needsShare, 'youShare': youShare})!;
      expect(MobCopy.compareNote(c('offer')), 'Your first side-by-side is free.');
      expect(MobCopy.compareNote(c('offer', needsShare: true, youShare: false)), 'Your first side-by-side is free. Share your answers to open it.');
      expect(MobCopy.compareNote(c('offer', needsShare: true)), 'Your first side-by-side is free. It opens once another member shares their answers.');
      expect(MobCopy.compareNote(c('locked'), sell: true), startsWith('The full side-by-side is included with Pro'));
      // PLAY_BILLING off (H11): the plain fact, no word of Pro.
      expect(MobCopy.compareNote(c('locked')), MobCopy.lockedNotePlain);
      expect(MobCopy.lockedNotePlain, isNot(contains('Pro')));
      expect(MobCopy.compareNote(c('full')), isNull);
    });

    test('no copy carries an exclamation mark, an arrow, a price or a reward', () {
      final all = [
        MobCopy.pitch, ...MobCopy.promises, MobCopy.closes, MobCopy.closed, MobCopy.nudgeKey, MobCopy.leaveBody, MobCopy.inviteBody,
        MobCopy.joinNoContacts, MobCopy.proLine, ...MobCopy.joinFacts, MobCopy.lockedNote, MobCopy.sampleLead,
        MobCopy.extraNote, MobCopy.extrasEmpty, MobCopy.shareHint, MobCopy.showScoreNote, MobCopy.sideBySideFoot, MobCopy.freeUsed,
        for (final f in MobFailure.values) MobCopy.failure(f),
      ];
      for (final s in all) {
        expect(s.contains('!'), isFalse, reason: s);
        expect(RegExp('[←-⇿]|->').hasMatch(s), isFalse, reason: s);
        expect(RegExp(r'₹|rupee|price|reward|discount|% off|hurry|last chance', caseSensitive: false).hasMatch(s), isFalse, reason: s);
        // 12-hour clock only.
        expect(RegExp(r'\b(1[3-9]|2[0-3]):[0-5]\d\b').hasMatch(s), isFalse, reason: s);
      }
    });

    test('no sentence tells a student who has not sat', () {
      final all = [MobCopy.ringLine(3, 4), MobCopy.nudgeSentNote, MobCopy.nudgeReceived('Riya'), MobCopy.closes, ...MobCopy.promises];
      for (final s in all) {
        expect(RegExp(r'not sat yet|still waiting|hasn.t sat|behind|last to sit', caseSensitive: false).hasMatch(s), isFalse, reason: s);
      }
    });
  });

  group('the repository', () {
    test('failures that need Pro', () {
      expect(MobFailure.fromCode('pro_required'), MobFailure.proRequired);
      expect(MobFailure.fromCode('nope'), MobFailure.generic);
    });
  });
}
