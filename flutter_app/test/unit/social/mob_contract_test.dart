// The Mob against the server's own shapes: the fixtures in test/fixtures/mob are copied byte for byte
// from the website release branch (data/tests/fixtures/mob), and these tests hold the app to them:
// what it parses, what it sends, and the sentence for every error code.

import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';

import '../core_data/support/fakes.dart';
import 'mob_test_kit.dart';

class _Sent {
  _Sent(this.method, this.path, this.query, this.body);

  final String method;
  final String path;
  final Map<String, dynamic> query;
  final Map<String, dynamic>? body;

  @override
  String toString() => '$method $path ?$query $body';
}

/// A repository that holds a settled Pro view and never reads the network.
class _Repo extends MobRepository {
  @override
  RemoteState<MobRead> build() => RemoteState(value: MobRead.fromJson(mobFixture('get_pro_v2.json')), fetchedAt: DateTime.utc(2026, 10, 16));

  @override
  Future<void> refresh({bool force = false}) async {}
}

void main() {
  group('the server fixtures parse', () {
    test('get_v1: a free student who sat, with the teaser and one free side-by-side on offer', () {
      final mob = MobRead.fromJson(mobFixture('get_v1.json')).mob!;
      expect(mob.id, isNotEmpty);
      expect(mob.subjectName, 'Accountancy');
      expect(mob.plan.pro, isFalse);
      expect(mob.plan.maxMobs, 1);
      expect(mob.plan.canMakeExtra, isFalse);
      expect(mob.plan.canStartAnother, isFalse);
      expect(mob.week.sat, 3);
      expect(mob.week.size, 4);
      expect(mob.week.paper.costType, MobCostType.unknown, reason: 'cost is null once you sat: draw nothing');
      expect(mob.week.paper.freeUsed, isFalse);
      expect(mob.compare!.access, MobCompareAccess.offer);
      expect(mob.compare!.needsShare, isTrue);
      expect(mob.compare!.canOpen, isFalse, reason: 'the free one is spent only when there is something to read');
      expect(mob.compare!.teaser!.text, 'Your Mob split on 3 of 10 questions.');
      expect(mob.visibleTrap!.option, 'B');
      expect(mob.visibleTrap!.youPickedIt, isTrue);
      expect(mob.visibleTrap!.youGotItRight, isFalse);
      expect(mob.members.map((m) => m.name), ['Riya', 'Asha', 'Kabir', 'Meera'], reason: 'join order, never by score');
      expect(mob.members.where((m) => m.scoreLine != null).map((m) => m.name), ['Asha'], reason: 'only a member who shares shows a score');
      expect(mob.members.first.owner, isTrue);
    });

    test('get_not_sat_v1: the paper is free of credits and the nudge is in', () {
      final mob = MobRead.fromJson(mobFixture('get_not_sat_v1.json')).mob!;
      expect(mob.week.paper.costType, MobCostType.free);
      expect(MobCopy.costLine(mob.week.paper), 'Free. No credits.');
      expect(mob.week.youSat, isFalse);
      expect(mob.trap, isNull);
      expect(mob.compare, isNull);
      expect(mob.nudge.receivedFrom, 'Riya');
      expect(mob.nudge.reason, MobNudgeReason.notSat);
      expect(mob.visibleTrap, isNull);
    });

    test('get_alone_v1: one member, no invite yet', () {
      final mob = MobRead.fromJson(mobFixture('get_alone_v1.json')).mob!;
      expect(mob.alone, isTrue);
      expect(mob.invite, isNull);
      expect(mob.seatsLeft, 4);
      expect(mob.week.complete, isFalse);
    });

    test('get_none_v1 is no Mob', () {
      expect(MobRead.fromJson(mobFixture('get_none_v1.json')).mob, isNull);
    });

    test('get_pro_v2: two Mobs, extras, past weeks, full access', () {
      final mob = MobRead.fromJson(mobFixture('get_pro_v2.json')).mob!;
      expect(mob.plan.pro, isTrue);
      expect(mob.plan.maxMobs, 3);
      expect(mob.plan.canMakeExtra, isTrue);
      expect(mob.plan.canStartAnother, isTrue);
      expect(mob.several, isTrue);
      expect(mob.mobs.map((m) => m.subjectName), ['Accountancy', 'Economics']);
      expect(mob.mobs.where((m) => m.active).single.id, mob.id);
      expect(mob.compare!.access, MobCompareAccess.full);
      expect(mob.compare!.canOpen, isTrue);
      expect(mob.pastWeeks, 2);
      expect(mob.extras, hasLength(2));
      expect(mob.extras.first.chapter, 'Partnership Accounts');
      expect(mob.extras.first.createdByYou, isTrue);
      expect(mob.extras.first.youSat, isFalse);
      expect(mob.extras.last.compare!.teaser!.text, 'Your Mob split on 1 of 5 questions.');
      expect(mob.extras.last.yourResultId, 'practice_u2x');
    });

    test('compare_v2: per question, who picked what, the trap, the hidden count', () {
      final c = MobCompare.fromJson(mobFixture('compare_v2.json'));
      expect(c.kind, 'weekly');
      expect(c.access, MobCompareAccess.full);
      expect(c.questions, hasLength(10));
      expect(c.sat, 3);
      expect(c.size, 4);
      expect(c.hidden, 0);
      expect(c.mobId, isNotEmpty);
      expect(c.yourResultId, 'practice_u2');
      final q4 = c.questions[3];
      expect(q4.key, 'D');
      expect(q4.you!.picked, 'A');
      expect(q4.you!.right, isFalse);
      expect(q4.you!.changed, 1);
      expect(q4.you!.seconds, 88);
      expect(q4.others.map((o) => o.name), ['Riya', 'Kabir']);
      expect(q4.split, isTrue);
      expect(q4.picks!.map((p) => '${p.option}${p.count}'), ['A1', 'D2']);
      expect(c.questions[5].trap!.option, 'B');
      expect(c.questions[5].trap!.trapName, 'A look-alike term');
      expect(c.questions[0].trap, isNull);
    });

    test('history_v2: a week you sat and a week you did not', () {
      final h = MobHistory.fromJson(mobFixture('history_v2.json'));
      expect(h.weeks, hasLength(2));
      expect(h.weeks.first.week, '2026-10-05');
      expect(h.weeks.first.youSat, isTrue);
      expect('${h.weeks.first.score} of ${h.weeks.first.scoreOf}', '8 of 10');
      expect(h.weeks.first.resultId, 'practice_u2_w1');
      expect(h.weeks.first.extras, 1);
      expect(h.weeks.last.youSat, isFalse);
      expect(h.weeks.last.score, isNull);
      expect(MobCopy.historyLine(h.weeks.first), '4 members sat. You scored 8 of 10. 1 extra paper.');
      expect(MobCopy.historyLine(h.weeks.last), '2 members sat. You did not sit it.');
    });

    test('lookup_v1 carries no member name, and a signed-in reply may name the inviter', () {
      final raw = jsonEncode(mobFixture('lookup_v1.json'));
      expect(raw.contains('"name"'), isFalse);
      final p = MobInvitePreview.fromJson(mobFixture('lookup_v1.json'));
      expect(p.code, '7KQ2M9XR');
      expect(p.subjectName, 'Accountancy');
      expect(p.size, 3);
      expect(p.seatsLeft, 2);
      expect(p.inviter, isNull);
      expect(MobCopy.joinHeadline(p), MobCopy.joinTitle);
      final signedIn = MobInvitePreview.fromJson({...mobFixture('lookup_v1.json'), 'inviter': 'Riya'});
      expect(MobCopy.joinHeadline(signedIn), 'Riya invited you to this week\'s 10-question Accountancy paper.');
      expect(MobCopy.joinBody(signedIn), 'A small group, one paper a week. 3 of 5 seats taken.');
      expect(MobCopy.joinBody(p), 'A small group sitting one 10-question Accountancy paper each week. 3 of 5 seats taken.');
    });

    test('a blocked free paper reads as used, never as an error', () {
      final mob = Mob.fromJson({
        'subject': 'accountancy',
        'week': {
          'size': 2,
          'paper': {'count': 10, 'durationSec': 720, 'cost': {'type': 'free'}, 'blocked': 'free_used'},
        },
      });
      expect(mob.week.paper.freeUsed, isTrue);
    });
  });

  group('errors: one sentence for every code the server has', () {
    final errors = (jsonDecode(File('test/fixtures/mob/errors_v1.json').readAsStringSync()) as Map<String, dynamic>);

    test('every code has an app failure and the same sentence as the server', () {
      expect(errors.keys, hasLength(37));
      for (final entry in errors.entries) {
        final body = (entry.value as Map<String, dynamic>)['body'] as Map<String, dynamic>;
        final message = (body['error'] as Map<String, dynamic>)['message'] as String;
        final f = MobFailure.fromCode(entry.key);
        expect(f, isNot(MobFailure.generic), reason: 'no app failure for ${entry.key}');
        expect(f.code, entry.key);
        expect(MobCopy.failure(f), message, reason: entry.key);
      }
    });

    test('the nested { error: { code } } shape reaches the app as a code, with its status', () {
      for (final entry in errors.entries) {
        final status = (entry.value as Map<String, dynamic>)['status'] as int;
        final e = ApiError.fromResponse(status, (entry.value as Map<String, dynamic>)['body']);
        expect(e.hasCode(entry.key), isTrue, reason: '${entry.key} read as ${e.code}');
        expect(mobFailureFor(e), MobFailure.fromCode(entry.key), reason: entry.key);
      }
    });

    test('the Pro gates are named and sell nothing', () {
      expect(MobFailure.proRequired.needsPro, isTrue);
      expect(MobFailure.mobLimit.needsPro, isTrue);
      expect(MobFailure.freePaperUsed.needsPro, isTrue);
      expect(MobFailure.alreadySat.needsPro, isFalse);
    });

    test('offline, a rate limit and an unknown code', () {
      expect(mobFailureFor(const ApiError(kind: ApiErrorKind.network, code: 'network')), MobFailure.offline);
      expect(mobFailureFor(ApiError.fromResponse(429, {'error': {'code': 'RATE_LIMITED'}}, retryAfterHeader: '30')), MobFailure.rateLimited);
      expect(mobFailureFor(const ApiError(kind: ApiErrorKind.server, code: 'SOMETHING_NEW', status: 500)), MobFailure.unavailable);
      expect(mobFailureFor(const ApiError(kind: ApiErrorKind.conflict, code: 'SOMETHING_NEW', status: 409)), MobFailure.generic);
    });

    test('the server switch off hides the Mob', () {
      expect(mobDisabledError(ApiError.fromResponse(404, errors['MOB_DISABLED']['body'])), isTrue);
      expect(mobDisabledError(const ApiError(kind: ApiErrorKind.network, code: 'network')), isFalse);
    });
  });

  group('requests: every call names its Mob, in the shape the server reads', () {
    late FakeHttpAdapter http;
    late ProviderContainer container;
    late List<_Sent> sent;
    const mobId = '7b0c5d8e-1f2a-4b3c-9d4e-5f6a7b8c9d0e';

    setUp(() {
      http = FakeHttpAdapter();
      sent = [];
      http.handler = (RequestOptions o) {
        final data = o.data;
        sent.add(_Sent(o.method, Uri.parse(o.path).path, Map.of(o.queryParameters), data is Map ? Map<String, dynamic>.from(data) : (data is String && data.isNotEmpty ? jsonDecode(data) as Map<String, dynamic> : null)));
        if (o.path.endsWith('/api/mob/compare')) return FakeReply(200, mobFixture('compare_v2.json'));
        if (o.path.endsWith('/api/mob/history')) return FakeReply(200, mobFixture('history_v2.json'));
        if (o.path.contains('/api/mob/join/')) return FakeReply(200, mobFixture('lookup_v1.json'));
        if (o.path.endsWith('/api/mob/nudge')) return const FakeReply(200, {'sent': true, 'to': 2});
        if (o.path.endsWith('/api/mob/leave')) return const FakeReply(200, {'left': true});
        if (o.path.endsWith('/api/mob/extra')) return FakeReply(201, {...mobFixture('get_pro_v2.json'), 'extraId': 'c1a7e5d2-3b94-4e08-9f61-0a2d8b7c4e35'});
        return FakeReply(200, mobFixture('get_pro_v2.json'));
      };
      container = ProviderContainer(overrides: [
        apiClientProvider.overrideWithValue(newApiClient(http)),
        mobRepositoryProvider.overrideWith(_Repo.new),
        mobPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      ]);
      addTearDown(container.dispose);
    });

    MobActions actions() => container.read(mobActionsProvider);

    test('creating and joining name no existing Mob', () async {
      expect(await actions().create(subject: 'accountancy', name: '  Asha ', colour: 1), isNull);
      expect(await actions().join(code: '7KQ2M9XR', name: 'Asha', colour: 1), isNull);
      expect(sent[0].method, 'POST');
      expect(sent[0].path, '/api/mob');
      expect(sent[0].body, {'subject': 'accountancy', 'name': 'Asha', 'colour': 1});
      expect(sent[1].path, '/api/mob/join');
      expect(sent[1].body, {'code': '7KQ2M9XR', 'name': 'Asha', 'colour': 1});
    });

    test('every other write carries the Mob it is for', () async {
      await actions().updateMe(showScore: true);
      await actions().newInvite();
      await actions().remove('K7Q2M9XR4T1A');
      await actions().report(memberId: 'K7Q2M9XR4T1A', reason: 'name');
      await actions().nudge();
      await actions().nudgeSeen();
      await actions().leave(block: 'K7Q2M9XR4T1A');
      expect(sent.map((s) => '${s.method} ${s.path}'), [
        'PATCH /api/mob/me',
        'POST /api/mob/invite',
        'POST /api/mob/remove',
        'POST /api/mob/report',
        'POST /api/mob/nudge',
        'POST /api/mob/nudge/seen',
        'POST /api/mob/leave',
      ]);
      for (final s in sent) {
        expect(s.body!['mob'], mobId, reason: '${s.path} must name its Mob');
      }
      expect(sent[0].body, {'mob': mobId, 'showScore': true});
      expect(sent[2].body, {'mob': mobId, 'memberId': 'K7Q2M9XR4T1A'});
      expect(sent[3].body, {'mob': mobId, 'memberId': 'K7Q2M9XR4T1A', 'reason': 'name', 'alsoLeave': false, 'block': false});
      expect(sent[6].body, {'mob': mobId, 'block': 'K7Q2M9XR4T1A'});
    });

    test('an extra paper sends the chapter and a length the server accepts', () async {
      final (id, failure) = await actions().createExtra(chapter: 'Partnership Accounts', count: 15);
      expect(failure, isNull);
      expect(id, 'c1a7e5d2-3b94-4e08-9f61-0a2d8b7c4e35');
      expect(sent.single.path, '/api/mob/extra');
      expect(sent.single.body, {'mob': mobId, 'chapter': 'Partnership Accounts', 'count': 15});
      expect(MobCopy.extraLengths, [5, 10, 15, 20]);
    });

    test('the side-by-side is read by week or by extra paper, for the Mob on screen', () async {
      final (week, f1) = await actions().compare(week: '2026-10-05');
      expect(f1, isNull);
      expect(week!.questions, isNotEmpty);
      await actions().compare(extra: 'c1a7e5d2-3b94-4e08-9f61-0a2d8b7c4e35');
      await actions().history();
      expect(sent[0].method, 'GET');
      expect(sent[0].path, '/api/mob/compare');
      expect(sent[0].query, {'mob': mobId, 'week': '2026-10-05'});
      expect(sent[1].query, {'mob': mobId, 'extra': 'c1a7e5d2-3b94-4e08-9f61-0a2d8b7c4e35'});
      expect(sent[2].path, '/api/mob/history');
      expect(sent[2].query, {'mob': mobId});
    });

    test('a refused side-by-side names its reason', () async {
      http.handler = (o) => FakeReply(402, (errorOf('PRO_REQUIRED')['body']));
      final (c, f) = await actions().compare();
      expect(c, isNull);
      expect(f, MobFailure.proRequired);
      expect(MobCopy.failure(f!), 'This part of the Mob is included with Pro.');
    });

    test('the public lookup is a plain GET of the code', () async {
      final (p, f) = await actions().preview('7KQ2M9XR');
      expect(f, isNull);
      expect(p!.subject, 'accountancy');
      expect(sent.single.path, '/api/mob/join/7KQ2M9XR');
    });

    test('an expired code and a bad code both read as an unusable invite', () async {
      http.handler = (o) => FakeReply(410, errorOf('INVITE_EXPIRED')['body']);
      expect((await actions().preview('7KQ2M9XR')).$2, MobFailure.inviteExpired);
      http.handler = (o) => FakeReply(404, errorOf('INVITE_INVALID')['body']);
      expect((await actions().preview('7KQ2M9XR')).$2, MobFailure.inviteInvalid);
      expect(MobCopy.failure(MobFailure.inviteExpired), MobCopy.failure(MobFailure.inviteInvalid));
    });

    test('a write that the plan refuses comes back as the plan\'s sentence', () async {
      http.handler = (o) => FakeReply(409, errorOf('MOB_LIMIT')['body']);
      final f = await actions().create(subject: 'economics', name: 'Asha', colour: 0);
      expect(f, MobFailure.mobLimit);
      expect(MobCopy.failure(f!), startsWith('Free includes one Mob.'));
    });
  });

  group('no age gate, no selling', () {
    test('nothing in the Mob asks for an age, a consent, a price or a purchase', () {
      final files = Directory('lib/features/social').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'));
      final text = files.map((f) => f.readAsStringSync()).join('\n');
      expect(RegExp(r'\b(adult|minor|age_?band|ageGate|under.?18|dateOfBirth|consent)\b', caseSensitive: false).hasMatch(text), isFalse);
      expect(RegExp(r'pricing|checkout|purchase|subscribe|₹|rupee', caseSensitive: false).hasMatch(text), isFalse);
    });
  });
}

Map<String, dynamic> errorOf(String code) =>
    (jsonDecode(File('test/fixtures/mob/errors_v1.json').readAsStringSync()) as Map<String, dynamic>)[code] as Map<String, dynamic>;
