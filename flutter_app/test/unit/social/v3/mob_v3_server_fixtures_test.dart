// The server's own fixtures (web/1019pm-mob-v3, data/tests/fixtures/mob_v3, taken from real responses
// on the server's tests; copied into test/fixtures/mob_v3/server) parse with the app's models, with the
// server's documented differences from spec section 3 (MOB-SERVER-A.md): q is 0-based and `number` is
// the 1-based question number; moment keys carry the Mob id; micFrom is {memberId, name}.

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';

Map<String, dynamic> sx(String name) => jsonDecode(File('test/fixtures/mob_v3/server/$name').readAsStringSync()) as Map<String, dynamic>;

void main() {
  test('every server fixture is valid JSON', () {
    final files = Directory('test/fixtures/mob_v3/server').listSync().whereType<File>().where((f) => f.path.endsWith('.json')).toList();
    expect(files.length, greaterThanOrEqualTo(30));
    for (final f in files) {
      expect(() => jsonDecode(f.readAsStringSync()), returnsNormally, reason: f.path);
    }
  });

  test('den: v3 sits inside the Mob', () {
    final read = MobRead.fromJson(sx('den_get.json'));
    expect(read.mob, isNotNull);
    final v3 = read.v3!;
    expect(v3.name.text, 'Chai Circle');
    expect(v3.members.length, 4);
    expect(v3.members.firstWhere((m) => m.you).name, 'Aarav');
    expect(v3.quest.target, greaterThan(0));
  });

  test('game, run, answers, finish', () {
    final g = MobGame.fromEnvelope(sx('game_get.json'));
    expect(g.title, "Kabir's sprint");
    expect(g.ghosts.length, 2);
    final open = MobGame.fromEnvelope(sx('game_open_201.json'));
    expect(open.id, isNotEmpty);
    final run = RunStart.fromJson(sx('run_start.json'));
    expect(run.questions.length, 5);
    expect(run.questions.first.q, 0);
    expect(jsonEncode(sx('run_start.json')), isNot(contains('correctIndex')));
    expect(jsonEncode(sx('run_start.json')), isNot(contains('explanation')));
    final resume = RunStart.fromJson(sx('run_resume.json'));
    expect(resume.run.answers, isNotEmpty);
    expect(AnswerResult.fromJson(sx('answer_right.json')).delta, 5);
    expect(AnswerResult.fromJson(sx('answer_wrong.json')).delta, -1);
    expect(AnswerResult.fromJson(sx('answer_skip.json')).correct, isNull);
    for (final f in ['answer_right.json', 'answer_wrong.json', 'answer_skip.json', 'answer_retry.json']) {
      expect(jsonEncode(sx(f)), isNot(contains('correctIndex')), reason: f);
    }
  });

  test('podium so far and closed: places, tie, trap number, moments', () {
    final so = Podium.fromJson(sx('podium_so_far.json'));
    expect(so.soFar, isTrue);
    expect(so.trap, isNull);
    final p = Podium.fromJson(sx('podium_closed.json'));
    expect(p.places.map((x) => x.place), [1, 2, 2, 4]);
    expect(p.tie!.names, ['You', 'Kabir']);
    expect([p.right, p.of], [15, 20]);
    expect([p.trap!.q, p.trap!.number], [3, 4]);
    final fastest = p.moments.firstWhere((m) => m.kind == MomentKind.fastestRight);
    expect([fastest.q, fastest.number], [0, 1]);
    expect(MobV3Copy.moment(fastest, 5), 'Fastest right answer: question 1 in 10 seconds.');
    expect(MobV3Copy.trapCaught(p.trap!.number), 'Question 4 caught most of you.');
  });

  test('review and fix', () {
    final r = Review.fromJson(sx('review.json'));
    expect(r.trap!.number, 4);
    expect(r.trap!.fix.check.state, 'not_yet');
    final fs = FixStart.fromJson(sx('fix_start.json'));
    expect([fs.trapQ, fs.trapNumber, fs.answered], [3, 4, false]);
    final fa = FixAnswer.fromJson(sx('fix_answer.json'));
    expect(fa.fixedOf, 3);
  });

  test('starts: free, used, mic (micFrom is an object), pro', () {
    final mic = StartRight.fromJson(sx('starts_mic.json'));
    expect([mic.via, mic.mics, mic.micFrom], [StartVia.freeWeekly, 1, 'Riya']);
    expect(StartRight.fromJson(sx('starts_used.json')).can, isFalse);
    expect(StartRight.fromJson(sx('starts_pro.json')).via, StartVia.pro);
    expect(StartRight.fromJson(sx('starts_free.json')).freeLeft, 1);
  });

  test('shelf, chain, invite, lookup', () {
    final s = Shelf.fromJson(sx('shelf.json'));
    expect(s.folds.length, 12);
    final c = ChainState.fromJson(sx('chain.json'));
    expect(c.todayNeeded, 5);
    final inv = InviteV3.fromJson(sx('invite.json'));
    expect(inv.code.length, 6);
    final lk = JoinPreview.fromJson(sx('lookup.json'));
    expect([lk.valid, lk.name], [true, 'Chai Circle']);
  });

  test('moment keys carry the Mob id', () {
    final k = MomentKey.parse('quest_done:uuid-2:2026-10-19');
    expect([k.kind, k.mobId, k.week], ['quest_done', 'uuid-2', '2026-10-19']);
    expect(MomentKey.parse('stitch:2026-10-19').week, '2026-10-19');
    expect(MomentKey.parse('reveal:hop').fold, FoldKey.hop);
    expect(MomentKey.parse('chain:14').days, 14);
  });

  test('every server error code gets the server sentence', () {
    final errs = sx('errors_v3.json');
    for (final e in errs.entries) {
      final body = ((e.value as Map)['body'] as Map)['error'] as Map;
      final status = (e.value as Map)['status'] as int;
      final err = ApiError(kind: status == 429 ? ApiErrorKind.rateLimited : ApiErrorKind.conflict, code: e.key, status: status);
      final said = MobV3Copy.error(err);
      expect(said, isNot(MobV3Copy.generic), reason: e.key);
      if (MobV3Copy.errors.containsKey(e.key)) expect(said, body['message'], reason: e.key);
    }
  });

  test('RUN_EXPIRED keeps the stored run; NOT_YET codes keep opensAt; nothing else is kept', () {
    final e = ApiError.fromResponse(410, {
      'error': {'code': 'RUN_EXPIRED', 'message': 'x', 'detail': {'run': {'finished': true, 'marks': 14, 'answered': 4, 'count': 5, 'picks': [1, 2]}, 'other': 'y'}},
    });
    expect(e.details['run'], {'finished': true, 'marks': 14, 'answered': 4, 'count': 5});
    final r = ApiError.fromResponse(409, {
      'error': {'code': 'REVIEW_NOT_YET', 'message': 'x', 'detail': {'opensAt': '2026-10-23T08:35:00.000Z'}},
    });
    expect(r.details['opensAt'], '2026-10-23T08:35:00.000Z');
    expect(r.details.containsKey('message'), isFalse);
  });
}
