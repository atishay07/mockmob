import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/logic/mob_ring.dart';

Map<String, dynamic> fixture(String name) => jsonDecode(File('test/fixtures/social/$name').readAsStringSync()) as Map<String, dynamic>;

Mob mobFixture() => MobRead.fromJson(fixture('mob_get_v1.json')).mob!;

void main() {
  group('parse', () {
    test('the full GET shape, additively', () {
      final mob = mobFixture();
      expect(mob.subject, 'accountancy');
      expect(mob.subjectName, 'Accountancy');
      expect(mob.you.owner, isTrue);
      expect(mob.you.showScore, isTrue);
      expect(mob.members.map((m) => m.name), ['Asha', 'Riya', 'Kabir', 'Dev']);
      expect(mob.week.sat, 3);
      expect(mob.week.size, 4);
      expect(mob.week.youSat, isTrue);
      expect(mob.week.paper.costType, MobCostType.included);
      expect(mob.week.paper.minutes, 12);
      expect(mob.invite!.code, '7K3M9QXA');
      expect(mob.seatsLeft, 1);
      expect(mob.nudge.canSend, isTrue);
      expect(mob.nudge.receivedFrom, isNull);
    });

    test('{ mob: null } is no Mob', () {
      expect(MobRead.fromJson(fixture('mob_none_v1.json')).mob, isNull);
      expect(MobRead.fromJson(const {}).mob, isNull);
    });

    test('a bare inner shape reads as the Mob', () {
      final inner = fixture('mob_get_v1.json')['mob'] as Map<String, dynamic>;
      expect(MobRead.fromJson(inner).mob!.members, hasLength(4));
    });

    test('scores only for members who sent one, in both shapes', () {
      final m = mobFixture().members;
      expect(m[0].scoreLine, '7 of 10');
      expect(m[1].scoreLine, isNull);
      expect(m[2].scoreLine, '8 of 10');
      expect(m[3].scoreLine, isNull);
    });

    test('members keep join order and never exceed 5', () {
      final j = fixture('mob_get_v1.json');
      final mob = j['mob'] as Map<String, dynamic>;
      mob['members'] = [for (var i = 0; i < 7; i++) {'memberId': 'm$i', 'name': 'N$i', 'sat': i.isEven, 'score': 10 - i}];
      final parsed = MobRead.fromJson(j).mob!;
      expect(parsed.members.map((m) => m.memberId), ['m0', 'm1', 'm2', 'm3', 'm4']);
    });

    test('missing fields take safe defaults', () {
      final mob = Mob.fromJson(const {'subject': 'economics'});
      expect(mob.members, isEmpty);
      expect(mob.week.sat, 0);
      expect(mob.week.size, 1);
      expect(mob.week.paper.costType, MobCostType.unknown);
      expect(mob.trap, isNull);
      expect(mob.invite, isNull);
    });

    test('sat is clamped to size, colour to 0..7', () {
      final mob = Mob.fromJson(const {
        'week': {'sat': 9, 'size': 3},
        'members': [
          {'memberId': 'a', 'name': 'Zed', 'colour': 42},
        ],
      });
      expect(mob.week.sat, 3);
      expect(mob.members.single.colour, 7);
    });

    test('invite preview carries no names', () {
      final p = MobInvitePreview.fromJson(fixture('mob_join_preview_v1.json'));
      expect(p.subjectName, 'Business Studies');
      expect(p.size, 3);
      expect(p.seatsLeft, 2);
      expect(MobCopy.joinBody(p), 'A small group sitting one 10-question Business Studies paper each week. 3 of 5 seats taken.');
    });
  });

  group('trap (P7)', () {
    test('option index becomes a letter', () {
      expect(mobFixture().trap!.option, 'B');
      expect(MobCopy.trapLine(mobFixture().trap!), 'Your Mob\'s trap: 3 of 3 picked B on question 6.');
      expect(MobCopy.trapName(mobFixture().trap!), 'Trap: Goodwill as an expense.');
    });

    test('refused under 3 sitters, under 2 picks, or under half', () {
      expect(MobTrap.fromJson(const {'questionNumber': 1, 'option': 'A', 'count': 2, 'of': 2}), isNull);
      expect(MobTrap.fromJson(const {'questionNumber': 1, 'option': 'A', 'count': 1, 'of': 3}), isNull);
      expect(MobTrap.fromJson(const {'questionNumber': 1, 'option': 'A', 'count': 2, 'of': 5}), isNull);
      expect(MobTrap.fromJson(const {'questionNumber': 1, 'option': 'A', 'count': 3, 'of': 5}), isNotNull);
    });

    test('shown only to a member who sat', () {
      final j = fixture('mob_get_v1.json');
      (j['mob']['week'] as Map)['youSat'] = false;
      expect(MobRead.fromJson(j).mob!.visibleTrap, isNull);
      expect(mobFixture().visibleTrap, isNotNull);
    });

    test('without a tagged name the line says a common wrong pick', () {
      final t = MobTrap.fromJson(const {'questionNumber': 2, 'option': 'C', 'count': 2, 'of': 3})!;
      expect(MobCopy.trapName(t), 'A common wrong pick.');
    });
  });

  group('ring', () {
    test('sitters fill in order, open seats unlabelled', () {
      final plan = ringPlan(mobFixture(), seenSat: 1);
      expect(plan.segments, [RingSegment.filled, RingSegment.fresh, RingSegment.fresh, RingSegment.open]);
      expect(plan.sitters.map((m) => m.initial), ['A', 'R', 'K']);
      expect(plan.complete, isFalse);
      expect(plan.freshCount, 2);
    });

    test('reduced motion inks nothing', () {
      final plan = ringPlan(mobFixture(), reducedMotion: true);
      expect(plan.freshCount, 0);
      expect(plan.sat, 3);
    });

    test('0, 1, 3 and 5 of 5', () {
      for (final sat in [0, 1, 3, 5]) {
        final mob = Mob.fromJson({
          'week': {'sat': sat, 'size': 5},
        });
        final plan = ringPlan(mob, seenSat: sat);
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
      final plan = ringPlan(mobFixture(), seenSat: 9);
      expect(plan.freshCount, 0);
      expect(plan.sat, 3);
    });
  });

  group('names and codes', () {
    test('display names (P3)', () {
      expect(isValidMobName('Asha'), isTrue);
      expect(isValidMobName('Anne-Marie'), isTrue);
      expect(isValidMobName("D'Souza"), isTrue);
      expect(isValidMobName('Zoë'), isTrue); // The server's own rule (letters only, no combining marks) decides scripts like Devanagari.
      expect(isValidMobName('A'), isFalse);
      expect(isValidMobName('1Asha'), isFalse);
      expect(isValidMobName('Asha 😀'), isFalse);
      expect(isValidMobName('a' * 19), isFalse);
      expect(isValidMobName('http://x'), isFalse);
    });

    test('invite codes, Crockford base32', () {
      expect(normaliseInviteCode('7k3m9qxa'), '7K3M9QXA');
      expect(normaliseInviteCode('7K3M-9QXA'), '7K3M9QXA');
      expect(normaliseInviteCode('7K3M9QXU'), isNull);
      expect(normaliseInviteCode('short'), isNull);
      expect(inviteCodeFromLink('https://www.mockmob.in/join/7K3M9QXA'), '7K3M9QXA');
      expect(inviteCodeFromLink('https://www.mockmob.in/join/7K3M9QXA?utm=x'), '7K3M9QXA');
      expect(inviteCodeFromLink('7K3M9QXA'), '7K3M9QXA');
    });
  });

  group('failures and copy', () {
    test('codes map to sentences, a block reads as an unusable invite', () {
      expect(mobFailureFor(const ApiError(kind: ApiErrorKind.notFound, code: 'INVITE_INVALID', status: 404)), MobFailure.inviteInvalid);
      expect(mobFailureFor(const ApiError(kind: ApiErrorKind.conflict, code: 'ALREADY_NUDGED', status: 409)), MobFailure.alreadyNudged);
      expect(mobFailureFor(const ApiError(kind: ApiErrorKind.network, code: 'network')), MobFailure.offline);
      expect(MobCopy.failure(MobFailure.inviteExpired), MobCopy.inviteUnusable);
    });

    test('the server switch off hides the Mob', () {
      expect(mobDisabledError(const ApiError(kind: ApiErrorKind.notFound, code: 'MOB_DISABLED', status: 404)), isTrue);
      expect(mobDisabledError(const ApiError(kind: ApiErrorKind.network, code: 'network')), isFalse);
    });

    test('times are 12-hour IST', () {
      expect(formatIstDayTime(DateTime.utc(2026, 10, 23, 16, 10)), 'Fri 23 Oct, 9:40 PM');
      expect(formatIstDayTime(DateTime.utc(2026, 10, 18, 18, 29)), 'Sun 18 Oct, 11:59 PM');
      expect(formatIstDayTime(DateTime.utc(2026, 10, 18, 19, 0)), 'Mon 19 Oct, 12:30 AM');
    });

    test('no copy carries an exclamation mark, an arrow or money', () {
      final all = [
        MobCopy.pitch, ...MobCopy.promises, MobCopy.closes, MobCopy.closed, MobCopy.costIncluded, MobCopy.costAllowance,
        MobCopy.costConfirm, MobCopy.nudgeKey, MobCopy.leaveBody, MobCopy.blockBody, MobCopy.inviteBody, MobCopy.joinNoContacts,
        for (final f in MobFailure.values) MobCopy.failure(f),
      ];
      for (final s in all) {
        expect(s.contains('!'), isFalse, reason: s);
        expect(RegExp('[←-⇿]|->').hasMatch(s), isFalse, reason: s);
        expect(RegExp(r'credit|₹|rupee|price|reward', caseSensitive: false).hasMatch(s), isFalse, reason: s);
      }
    });
  });
}
