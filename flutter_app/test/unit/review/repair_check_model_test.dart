import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/review/data/repair_check_logic.dart';

import 'support/repair_check_fixtures.dart';

void main() {
  group('the repair response check field', () {
    test('every example of the contract parses to its status and reason', () {
      final ex = examples();
      final ready = RepairCheckInfo.tryParse(ex['ready'])!;
      expect(ready.status, RepairCheckStatus.ready);
      expect(ready.available, isTrue);
      expect(ready.reason, isNull);
      expect(ready.askHref, '/mentor?tab=ask&q=att_1:q_1');
      expect(ready.href, '/api/recovery/check?attemptId=att_1&questionId=q_1');

      final none = RepairCheckInfo.tryParse(ex['none'])!;
      expect(none.status, RepairCheckStatus.none);
      expect(none.reason, 'no_unseen');
      expect(none.line, 'No unseen question on this idea yet.');
      expect(none.canRetry, isFalse, reason: 'there is nothing to try again for');

      final answered = RepairCheckInfo.tryParse(ex['answered'])!;
      expect(answered.status, RepairCheckStatus.answered);
      expect(answered.available, isFalse);

      final unchecked = RepairCheckInfo.tryParse(ex['unchecked'])!;
      expect(unchecked.status, RepairCheckStatus.unchecked);
      expect(unchecked.reason, 'check_unavailable');
      expect(unchecked.canRetry, isTrue, reason: 'an unavailable check may come back');
      expect(unchecked.line, 'The check is not available right now. Nothing was charged.');
    });

    test('a missing field, a field that is not an object and an unknown status read as absent', () {
      expect(RepairCheckInfo.tryParse(null), isNull);
      expect(RepairCheckInfo.tryParse('ready'), isNull);
      expect(RepairCheckInfo.tryParse(7), isNull);
      expect(RepairCheckInfo.tryParse({'status': 'something_new'}), isNull);
      expect(RepairCheckInfo.tryParse({'available': true}), isNull);
    });

    test('unknown fields are ignored and a missing reason message falls back to the contract sentence', () {
      final info = RepairCheckInfo.tryParse({'status': 'none', 'reason': 'passage_format', 'future': {'x': 1}})!;
      expect(info.line, contract()['reasons']['passage_format']);
      for (final entry in (contract()['reasons'] as Map).entries) {
        expect(RepairCheckReasons.line(entry.key as String), entry.value, reason: 'reason ${entry.key} reads as the contract says');
      }
    });

    test('RepairResponse carries check for explained and stored only, and never for a held repair', () {
      Map<String, dynamic> body(String status) => {
            'status': status,
            'repair': {'key_idea': 'Split first.'},
            'check': examples()['ready'],
          };
      expect(RepairResponse.fromJson(body('explained')).check?.status, RepairCheckStatus.ready);
      expect(RepairResponse.fromJson(body('stored')).check?.status, RepairCheckStatus.ready);
      expect(RepairResponse.fromJson(body('held_for_recheck')).check, isNull);
      expect(RepairResponse.fromJson(body('not_explained')).check, isNull);
      // An older server sends none: nothing is drawn.
      expect(RepairResponse.fromJson({'status': 'explained', 'repair': {'key_idea': 'Split first.'}}).check, isNull);
    });
  });

  group('the question (GET) and the answer (POST)', () {
    test('ready: no key, no explanation and no marks before the answer', () {
      final body = {'ok': true, 'status': 'ready', 'charged': 0, 'check': checkJson(), 'href': 'x', 'askHref': 'y'};
      final load = CheckLoad.tryParse(body) as CheckReady;
      final q = load.question;
      expect(q.checkQuestionId, 'q_fresh_1');
      expect(q.options.map((o) => o.letter), ['A', 'B', 'C', 'D'], reason: 'the bank\'s own order, A to D as stored');
      expect(q.options.any((o) => o.isKey), isFalse);
      expect(q.basisLine, 'Same topic: Goodwill');
      expect(q.pool!.unseen, 7);
      expect(q.pool!.ofChapter, 41);
      expect(q.rule, 'the repair\'s rule line, or null');
    });

    test('half a question is never shown: three options, a missing stem or an option without text', () {
      List<Map<String, dynamic>> options(int n) => [for (var i = 0; i < n; i++) {'index': i, 'text': 'T$i'}];
      expect(CheckQuestion.tryParse({...checkJson(), 'options': options(3)}), isNull);
      expect(CheckQuestion.tryParse({...checkJson(), 'options': options(5)}), isNull);
      expect(CheckQuestion.tryParse({...checkJson(), 'question': '  '}), isNull);
      final blank = options(4)..[2] = {'index': 2, 'text': ''};
      expect(CheckQuestion.tryParse({...checkJson(), 'options': blank}), isNull);
      expect(CheckLoad.tryParse({'ok': true, 'status': 'ready', 'check': {...checkJson(), 'options': options(3)}}), isNull);
    });

    test('none: the reason and its words, with a retry only for the reasons where trying again can help', () {
      final none = CheckLoad.tryParse((contract()['get'] as Map)['none']['body']) as CheckNone;
      expect(none.reason, 'no_unseen');
      expect(none.line, 'No unseen question on this idea yet.');
      expect(none.canRetry, isFalse);
      expect(none.pool!.unseen, 0);
      final lookup = CheckLoad.tryParse({'ok': true, 'status': 'none', 'reason': 'lookup_failed'}) as CheckNone;
      expect(lookup.canRetry, isTrue);
      expect(lookup.line, contains('Nothing was charged.'));
    });

    test('answered: the stored result comes back as it was, and an unknown status is not shown', () {
      final body = {'ok': true, 'status': 'answered', 'check': checkJson(), 'result': resultJson()};
      final stored = CheckLoad.tryParse(body) as CheckStored;
      expect(stored.result.right, isFalse);
      expect(CheckLoad.tryParse({'ok': true, 'status': 'future'}), isNull);
      expect(CheckLoad.tryParse({'ok': false, 'status': 'ready', 'check': checkJson()}), isNull);
      expect(CheckLoad.tryParse('nope'), isNull);
    });

    test('POST: the verdict, the key row, the pick and the bank explanation', () {
      final ok = (contract()['post'] as Map)['ok']['body'] as Map;
      expect(ok['replayed'], isFalse);
      final answer = CheckAnswer.tryParse({...ok, 'result': resultJson(revise: {'scheduled': true, 'nextAt': '2026-10-16T18:30:00.000Z', 'dueDay': '2026-10-17', 'whenLabel': 'tomorrow', 'cards': 2})})!;
      final r = answer.result;
      expect(answer.replayed, isFalse);
      expect(r.right, isFalse);
      expect(r.keyIndex, 1);
      expect(r.pickIndex, 2);
      expect(r.keyText, 'Debit Goodwill, credit the sacrificing partners');
      expect(r.explanation, startsWith('Goodwill brought in by the new partner'));
      expect(r.ruleLine, 'Split the sacrifice before you subtract.');
      expect(r.revise!.cards, 2);
      expect(r.revise!.dueDay, '2026-10-17');
      expect(CheckAnswer.tryParse({...ok, 'replayed': true, 'result': resultJson()})!.replayed, isTrue);
    });

    test('POST: a result without a verdict, a key or four rows is not shown', () {
      for (final broken in [
        (Map<String, dynamic> r) => r.remove('right'),
        (Map<String, dynamic> r) => r.remove('line'),
        (Map<String, dynamic> r) => r.remove('key'),
        (Map<String, dynamic> r) => r['options'] = (r['options'] as List).take(2).toList(),
      ]) {
        final r = resultJson();
        broken(r);
        expect(CheckResult.tryParse(r), isNull);
      }
      expect(CheckAnswer.tryParse({'ok': true, 'status': 'answered'}), isNull);
    });

    test('an empty explanation reads as none, and a missing revise as no Revise line', () {
      final r = CheckResult.tryParse({...(resultJson()..remove('revise')), 'explanation': '', 'ruleLine': null})!;
      expect(r.explanation, isNull);
      expect(r.ruleLine, isNull);
      expect(r.revise, isNull);
    });
  });

  group('the words around the check', () {
    test('Ask names the mistake by its number and says what Mobi sees', () {
      expect(CheckCopy.askLabel(3), 'Ask Mobi about Q3');
      expect(CheckCopy.askLabel(null), 'Ask Mobi about this mistake');
      expect(CheckCopy.askSees(3), 'Mobi sees Q3, your pick, the key and your rule, and nothing else about you.');
      expect(CheckCopy.askSees(0), contains('this mistake'));
    });

    test('the lead says what the question is tied to only once the server has said', () {
      expect(CheckCopy.lead('concept'), startsWith('One new question on the same idea that you have not seen.'));
      expect(CheckCopy.lead('topic'), contains('on the same topic'));
      expect(CheckCopy.lead('chapter'), contains('from the same chapter'));
      expect(CheckCopy.lead(null), isNot(contains('same')));
      expect(CheckCopy.lead('chapter'), endsWith('no extra credit.'));
    });

    test('the pool line carries both numbers or none', () {
      expect(CheckCopy.poolLine(const CheckPool(unseen: 7, ofChapter: 41)), 'Of the 41 questions in this chapter, 7 are new to you and can be used for a check.');
      expect(CheckCopy.poolLine(const CheckPool(unseen: 1, ofChapter: 41)), contains('1 is new to you'));
      expect(CheckCopy.poolLine(const CheckPool(unseen: 9, ofChapter: 3)), isNull);
      expect(CheckCopy.poolLine(null), isNull);
    });

    test('the Revise line works the day out again from the due day, in India days', () {
      CheckRevise due(String day) => CheckRevise(scheduled: true, dueDay: day, whenLabel: 'tomorrow', cards: 1);
      // 16 Oct 2026 18:00 UTC is 16 Oct 23:30 in India.
      final now = DateTime.utc(2026, 10, 16, 18);
      expect(CheckCopy.reviseLine(due('2026-10-17'), right: true, nowUtc: now), 'This mistake comes back tomorrow.');
      expect(CheckCopy.reviseLine(due('2026-10-17'), right: false, nowUtc: now), 'Both come back tomorrow: this mistake and the question you just missed.');
      // 30 minutes later it is 17 Oct in India: the same stored day is today, and a day that has passed is today too.
      final after = DateTime.utc(2026, 10, 16, 18, 31);
      expect(CheckCopy.reviseLine(due('2026-10-17'), right: true, nowUtc: after), 'This mistake comes back today.');
      expect(CheckCopy.reviseLine(due('2026-10-14'), right: true, nowUtc: after), 'This mistake comes back today.');
      expect(CheckCopy.reviseLine(due('2026-10-20'), right: true, nowUtc: now), 'This mistake comes back on Tue 20 Oct.');
      // No day: the server's own word; none at all: soon.
      expect(CheckCopy.reviseLine(const CheckRevise(scheduled: true, whenLabel: 'tomorrow'), right: true, nowUtc: now), 'This mistake comes back tomorrow.');
      expect(CheckCopy.reviseLine(const CheckRevise(scheduled: true), right: true, nowUtc: now), 'This mistake comes back soon.');
    });

    test('no Revise line when Revise could not be written: it never promises a card that does not exist', () {
      final now = DateTime.utc(2026, 10, 16, 18);
      expect(CheckCopy.reviseLine(null, right: true, nowUtc: now), isNull);
      expect(CheckCopy.reviseLine(const CheckRevise(scheduled: false), right: false, nowUtc: now), isNull);
    });

    test('the tags on an answered row are words', () {
      expect(CheckCopy.tag(isKey: true, isPick: true), 'Your pick and the key');
      expect(CheckCopy.tag(isKey: true, isPick: false), 'Key');
      expect(CheckCopy.tag(isKey: false, isPick: true), 'Your pick');
      expect(CheckCopy.tag(isKey: false, isPick: false), isNull);
    });
  });

  group('Ask Mobi from the AI wallet', () {
    AiCredits credits(String state, {int? total, bool known = true}) => AiCredits.fromJson({
          'state': state,
          'wallet': {'state': state, 'known': known, 'total': ?total},
        });

    test('available: the link and the price, with the balance', () {
      final o = AskOffer.of(credits('available', total: 68));
      expect(o.ask, isTrue);
      expect(o.line, 'One written reply uses 1 AI credit. You have 68.');
    });

    test('not read yet: nothing is shown, so nothing is shown and then taken back', () {
      final o = AskOffer.of(null);
      expect(o.ask, isFalse);
      expect(o.pending, isTrue);
      expect(o.line, isNull);
    });

    test('paused, empty and unreadable: no link, no price and no promise of free asking', () {
      final paused = AskOffer.of(credits('paused', total: 68));
      expect(paused.ask, isFalse);
      expect(paused.line, 'Written replies are paused right now. Nothing is charged.');
      final empty = AskOffer.of(credits('empty', total: 0));
      expect(empty.ask, isFalse);
      expect(empty.line, contains('no AI credits left'));
      final unreadable = AskOffer.of(credits('error', known: false));
      expect(unreadable.ask, isFalse);
      expect(unreadable.line, contains('could not be read'));
      // An available wallet whose count could not be read has no price to promise either.
      expect(AskOffer.of(credits('available', known: false)).ask, isFalse);
      for (final o in [paused, empty, unreadable]) {
        expect(o.line, endsWith('Nothing is charged.'));
        expect(o.line, isNot(contains('1 AI credit')));
        expect(o.line!.toLowerCase(), isNot(contains('free')));
      }
    });
  });

  group('what the screen does with the server\'s answers', () {
    test('GET: ready, answered and none each become their phase', () {
      final ready = planLoaded(CheckLoad.tryParse({'ok': true, 'status': 'ready', 'check': checkJson()})!);
      expect(ready.phase, CheckPhase.ready);
      expect(ready.pool!.ofChapter, 41);
      final stored = planLoaded(CheckLoad.tryParse({'ok': true, 'status': 'answered', 'check': checkJson(), 'result': resultJson()})!);
      expect(stored.phase, CheckPhase.answered);
      expect(stored.replayed, isTrue);
      final none = planLoaded(const CheckNone(reason: 'no_unseen'));
      expect(none.phase, CheckPhase.none);
      expect(none.canRetry, isFalse);
    });

    ApiError http(int status, String code, {String? message}) => ApiError.fromResponse(status, {'ok': false, 'error': code, 'message': ?message});

    test('GET failures: offline and slow retry, 409 repair_first is a reason, 401 404 422 are not retried', () {
      final offline = planLoadFailed(const ApiError(kind: ApiErrorKind.network, code: 'network'));
      expect(offline.phase, CheckPhase.loadError);
      expect(offline.message, 'The question could not be loaded. Nothing was charged.');
      expect(offline.canRetry, isTrue);
      expect(planLoadFailed(const ApiError(kind: ApiErrorKind.timeout, code: 'timeout')).canRetry, isTrue);
      final rate = planLoadFailed(http(429, 'rate_limited'));
      expect(rate.phase, CheckPhase.loadError);
      expect(rate.message, 'Please wait a moment before the next check.');
      final first = planLoadFailed(http(409, 'repair_first', message: RepairCheckReasons.repairFirst));
      expect(first.phase, CheckPhase.none);
      expect(first.message, RepairCheckReasons.repairFirst);
      expect(first.canRetry, isFalse);
      for (final s in [401, 404, 422]) {
        final v = planLoadFailed(http(s, 'whatever'));
        expect(v.phase, CheckPhase.none, reason: '$s');
        expect(v.canRetry, isFalse, reason: '$s');
      }
      final lookup = planLoadFailed(http(503, 'lookup_failed', message: RepairCheckReasons.lookupFailed));
      expect(lookup.phase, CheckPhase.none);
      expect(lookup.canRetry, isTrue, reason: 'a failed lookup may work next time');
      expect(planLoadFailed(http(500, 'server_error')).phase, CheckPhase.loadError);
    });

    test('POST failures: withdrawn asks for another question, a plain bad pick can be fixed, the rest retry with the same id', () {
      final changed = planAnswerFailed(http(409, 'check_changed', message: RepairCheckReasons.checkChanged));
      expect(changed.refetch, isTrue);
      expect(changed.canRetry, isFalse);
      expect(changed.message, 'That question was withdrawn before it was marked. Nothing was recorded.');
      final pick = planAnswerFailed(http(422, 'invalid_pick', message: RepairCheckReasons.invalidPick));
      expect(pick.canRetry, isTrue);
      expect(pick.refetch, isFalse);
      // "Not the question that was offered" cannot be fixed by picking: the way on is another question.
      final stale = planAnswerFailed(http(422, 'invalid_pick', message: 'That is not the question that was offered for this repair. Open the check again.'));
      expect(stale.refetch, isTrue);
      expect(stale.canRetry, isFalse);
      expect(stale.message, contains('Open the check again'));
      final offline = planAnswerFailed(const ApiError(kind: ApiErrorKind.network, code: 'network'));
      expect(offline.message, 'We could not confirm the mark. Try again. Your answer is counted once.');
      expect(offline.canRetry, isTrue);
      expect(planAnswerFailed(http(429, 'rate_limited')).canRetry, isTrue);
      expect(planAnswerFailed(http(409, 'repair_first', message: RepairCheckReasons.repairFirst)).canRetry, isFalse);
      expect(planAnswerFailed(http(500, 'server_error')).canRetry, isTrue);
    });
  });
}
