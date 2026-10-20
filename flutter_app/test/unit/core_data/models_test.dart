import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';

import 'support/fixtures.dart';

void main() {
  group('Attempt', () {
    test('parses counts, details, snapshot and selection meta', () {
      final a = attemptOf(id: 'a1', mode: 'nta', questions: [...chapterOf('Goodwill', right: 2, wrong: 1, blank: 1)]);
      expect(a.id, 'a1');
      expect((a.correct, a.wrong, a.unattempted, a.total), (2, 1, 1, 4));
      expect(a.marks, 9);
      expect(a.maxMarks, 20);
      expect(a.mode, 'nta');
      expect(a.isMock, isTrue);
      expect(a.selectionMeta.isServerScored, isTrue);
      expect(a.questions.first.options.first.text, 'First');
      expect(a.detailFor(a.questions[2].id)!.isWrong, isTrue);
      expect(a.detailFor(a.questions[3].id)!.isBlank, isTrue);
    });

    test('options may be plain strings or key and text objects', () {
      final q = SnapshotQuestion.fromJson({
        'id': 'q',
        'options': ['One', 'Two', {'key': 'C', 'text': 'Three'}],
      });
      expect([for (final o in q.options) '${o.key}:${o.text}'], ['A:One', 'B:Two', 'C:Three']);
    });

    test('completedAt is epoch milliseconds', () {
      final a = attemptOf(completedAt: 1760000000000, questions: chapterOf('A', right: 1));
      expect(a.completedAt.millisecondsSinceEpoch, 1760000000000);
    });

    test('a missing mode reads selectionMeta.mode, and none is not a mock', () {
      final withMeta = attemptOf(mode: 'full', questions: chapterOf('A', right: 1));
      final none = attemptOf(mode: null, questions: chapterOf('A', right: 1));
      expect(withMeta.isMock, isTrue);
      expect(none.isMock, isFalse);
    });
  });

  group('AttemptDetail key rule (design spec 5.7)', () {
    Map<String, dynamic> detailJson({Map<String, dynamic>? reviews, String state = 'ready'}) => {
          ...attemptJson(questions: chapterOf('A', right: 1, wrong: 2)),
          'answerReviews': reviews ?? {},
          'answerReviewState': state,
        };

    test('no review: the stored key and explanation are visible', () {
      final d = AttemptDetail.fromJson(detailJson());
      final id = d.attempt.questions.first.id;
      expect(d.visibleKeyIndex(id), 0);
      expect(d.visibleExplanation(id), 'Because 0.');
    });

    test('a corrected review uses its currentIndex and explanation', () {
      final base = attemptJson(questions: chapterOf('A', right: 1, wrong: 2));
      final id = (base['questionsSnapshot'] as List).first['id'] as String;
      final d = AttemptDetail.fromJson({
        ...base,
        'answerReviews': {
          id: {'state': 'corrected', 'currentIndex': 1, 'explanation': 'Updated.', 'chosenIndex': 0, 'originalMarks': 5, 'correctedMarks': 4, 'adjustment': -1},
        },
        'answerReviewState': 'ready',
      });
      expect(d.visibleKeyIndex(id), 1);
      expect(d.visibleExplanation(id), 'Updated.');
      expect(d.answerReviews[id]!.adjustment, -1);
    });

    test('any held review shows no key and no explanation', () {
      final base = attemptJson(questions: chapterOf('A', right: 1, wrong: 2));
      final ids = [for (final q in base['questionsSnapshot'] as List) q['id'] as String];
      final d = AttemptDetail.fromJson({
        ...base,
        'answerReviews': {
          ids[0]: {'state': 'withdrawn'},
          ids[1]: {'state': 'under_review'},
          ids[2]: {'state': 'key_changed_unverified'},
        },
      });
      for (final id in ids) {
        expect(d.visibleKeyIndex(id), isNull);
        expect(d.visibleExplanation(id), isNull);
      }
      expect(d.hasHeld, isTrue);
      expect(d.heldQuestionIds.length, 3);
    });

    test('unavailable reviews mean no keys or explanations at all', () {
      final d = AttemptDetail.fromJson(detailJson(state: 'unavailable'));
      final id = d.attempt.questions.first.id;
      expect(d.reviewsUnavailable, isTrue);
      expect(d.visibleKeyIndex(id), isNull);
      expect(d.visibleExplanation(id), isNull);
    });

    test('the recap block is optional and parsed when present', () {
      final plain = AttemptDetail.fromJson(detailJson());
      expect(plain.recap, isNull);
      final withRecap = AttemptDetail.fromJson({
        ...detailJson(),
        'recap': {'tone': 'higher', 'previousComparable': {'marks': 92, 'max': 250, 'attemptId': 'a0'}, 'timingReliable': false, 'formatId': 'f'},
      });
      expect(withRecap.recap!.tone, 'higher');
      expect(withRecap.recap!.hasPrevious, isTrue);
      expect(withRecap.recap!.previousMarks, 92);
    });
  });

  group('SessionView', () {
    test('parses a durable session and re-serialises it', () {
      final v = sessionViewOf(count: 3);
      expect(v.questions.length, 3);
      expect(v.isTicketMode, isFalse);
      expect(v.state, 'active');
      final copy = SessionView.fromJson(v.toJson());
      expect(copy.questions.length, 3);
      expect(copy.startedAt, v.startedAt);
      expect(copy.expiresAt, v.expiresAt);
    });

    test('ticket mode keeps the ticket and parses a Z or +00:00 start', () {
      final v = SessionView.fromJson({
        ...sessionViewJson(ticket: 'p2.a.b.c'),
        'startedAt': '2026-10-12T05:00:00.412+00:00',
        'expiresAt': '2026-10-12T05:10:00.412Z',
      });
      expect(v.isTicketMode, isTrue);
      expect(v.meta.sessionTicket, 'p2.a.b.c');
      expect(v.expiresAt.difference(v.startedAt), const Duration(minutes: 10));
    });

    test('answer keys are not part of the view', () {
      final q = sessionViewOf().questions.first;
      expect(q.toJson().containsKey('correctIndex'), isFalse);
    });
  });

  group('PracticeQuote', () {
    test('reads cost, balance, allowance and reason', () {
      final q = PracticeQuote.fromJson({
        'state': 'blocked',
        'launchable': false,
        'reasonCode': 'insufficient_credits',
        'reason': 'You have 8 credits.',
        'expiresAt': '2026-10-12T12:01:00.000Z',
        'creditCost': 10,
        'creditBalance': 8,
        'allowance': {'kind': 'daily_practice', 'state': 'used'},
        'subject': {'id': 'accountancy', 'name': 'Accountancy'},
        'mode': {'id': 'quick'},
      });
      expect(q.launchable, isFalse);
      expect(q.isInsufficientCredits, isTrue);
      expect(q.creditCost, 10);
      expect(q.creditBalance, 8);
      expect(q.freeByAllowance, isFalse);
      expect(q.isExpiredAt(DateTime.utc(2026, 10, 12, 12, 2)), isTrue);
      expect(q.isExpiredAt(DateTime.utc(2026, 10, 12, 12)), isFalse);
    });

    test('an available allowance means free', () {
      final q = PracticeQuote.fromJson({'state': 'available', 'launchable': true, 'reasonCode': 'ok', 'allowance': {'kind': 'baseline:accountancy', 'state': 'available'}});
      expect(q.freeByAllowance, isTrue);
    });
  });

  group('AiCredits', () {
    test('an unknown balance is null, never zero', () {
      final c = AiCredits.fromJson({
        'state': 'available',
        'wallet': {'known': false, 'spendable': null, 'resetAt': '2026-11-01T00:00:00.000Z'},
      });
      expect(c.explanationBalance, isNull);
      expect(c.wallet!.isKnown, isFalse);
      expect(c.resetAt?.month, 11);
    });

    test('a known balance is read', () {
      final c = AiCredits.fromJson({
        'state': 'available',
        'wallet': {'known': true, 'spendable': 7},
        'practiceCredits': {'balance': 120},
      });
      expect(c.explanationBalance, 7);
      expect(c.practiceBalance, 120);
    });

    test('a known zero is zero', () {
      final c = AiCredits.fromJson({'state': 'empty', 'wallet': {'known': true, 'spendable': 0}});
      expect(c.explanationBalance, 0);
    });
  });

  group('RepairResponse', () {
    test('explained needs key_idea', () {
      final r = RepairResponse.fromJson({
        'status': 'explained',
        'repair': {'why_tempting': 'a', 'why_wrong': 'b', 'key_idea': 'c', 'next_step': 'd'},
        'charged': 1,
        'chosenIndex': 1,
        'keyIndex': 0,
        'practiceHref': '/dashboard?mode=quick&count=5',
      });
      expect(r.status, RepairStatus.explained);
      expect(r.status.countsAsRepaired, isTrue);
      expect(r.explanation!.keyIdea, 'c');
      expect(r.charged, 1);
    });

    test('stored without key_idea is rejected', () {
      expect(
        () => RepairResponse.fromJson({'status': 'stored', 'repair': {'why_wrong': 'b'}}),
        throwsA(isA<RepairResponseFormatException>()),
      );
    });

    test('an unknown status is rejected', () {
      expect(() => RepairResponse.fromJson({'status': 'done'}), throwsA(isA<RepairResponseFormatException>()));
    });

    test('held for recheck and not explained never count as repaired', () {
      final held = RepairResponse.fromJson({'status': 'held_for_recheck', 'charged': 0});
      final none = RepairResponse.fromJson({'status': 'not_explained', 'charged': 0});
      expect(held.status.countsAsRepaired, isFalse);
      expect(none.status.countsAsRepaired, isFalse);
    });
  });

  group('LearningPlan', () {
    test('parses primary, alternatives and the blocked content gate', () {
      final p = LearningPlan.fromJson({
        'primary': {'kind': 'ordinary_practice', 'title': 'Practise', 'href': '/dashboard?mode=quick&count=10', 'evidence': ['a'], 'facts': [{'basis': 'record', 'text': 'x'}]},
        'alternatives': [{'kind': 'baseline', 'title': 'Diagnostic'}],
        'minutes': 20,
        'pathwayState': 'blocked_content',
        'recordState': 'ready',
        'tonight': {'state': 'recorded', 'sessionId': 's', 'minutes': 10, 'completedAt': 1760000000000},
        'study': {'dueCards': 12},
      });
      expect(p.primary.kind, 'ordinary_practice');
      expect(p.primary.facts.single.basis, 'record');
      expect(p.alternatives.length, 1);
      expect(p.isBlockedContent, isTrue);
      expect(p.recordUnavailable, isFalse);
      expect(p.tonight!.state, 'recorded');
      expect(p.dueCards, 12);
    });

    test('the record being unavailable is reported', () {
      final p = LearningPlan.fromJson({'primary': {'kind': 'ordinary_practice', 'title': 't'}, 'recordState': 'unavailable'});
      expect(p.recordUnavailable, isTrue);
    });
  });

  group('Rhythm and Goal', () {
    test('parses the week, milestones and the optional B2 fields', () {
      final r = Rhythm.fromJson({
        'timeZone': 'Asia/Kolkata',
        'weekStart': '2026-10-12',
        'studyDays': 2,
        'studyDayDates': ['2026-10-12', '2026-10-13'],
        'daysGoal': 4,
        'metThisWeek': false,
        'paused': false,
        'weeksMetStreak': 3,
        'bestRun': 5,
        'returning': true,
        'milestones': [{'id': 'first_scored_session', 'achievedAt': '2026-09-01T10:00:00.000Z'}, {'id': 'repairs_5', 'achievedAt': null}],
      });
      expect(r.studyDayDates.length, 2);
      expect(r.weeksMetStreak, 3);
      expect(r.milestones.first.earned, isTrue);
      expect(r.milestones.last.earned, isFalse);
      expect(r.history, isNull);
      expect(r.lastClosedWeek, isNull);
    });

    test('B2 history and the last closed week are read when present', () {
      final r = Rhythm.fromJson({
        'weekStart': '2026-10-12',
        'history': [{'weekStart': '2026-10-05', 'studyDays': 4, 'goal': 4, 'met': true}],
        'repairsThisWeek': 2,
        'mocksThisWeek': 1,
        'lastClosedWeek': {'weekStart': '2026-10-05', 'studyDays': 4, 'goal': 4, 'met': true},
      });
      expect(r.history!.single.met, isTrue);
      expect(r.repairsThisWeek, 2);
      expect(r.lastClosedWeek!.weekStart, '2026-10-05');
    });

    test('goal days are clamped to 1 to 7', () {
      expect(Goal.fromJson({'daysPerWeek': 12}).daysPerWeek, 7);
      expect(Goal.fromJson({'daysPerWeek': 0}).daysPerWeek, 1);
      expect(Goal.fromJson({}).daysPerWeek, 4);
    });
  });

  group('NotificationPrefs', () {
    test('defaults are IST, 11 PM to 7 AM', () {
      const p = NotificationPrefs.defaults;
      expect(p.timezone, 'Asia/Kolkata');
      expect(p.quietStart.toWire(), '23:00');
      expect(p.quietEnd.toWire(), '07:00');
    });

    test('parses the wire shape', () {
      final p = NotificationPrefs.fromJson({
        'timezone': 'Asia/Dubai',
        'quietStart': '22:30',
        'quietEnd': '06:15',
        'channels': {'check_due': true, 'weekly_plan': false, 'study_window': true, 'result_ready': true},
        'studyWindow': {'start': '23:30', 'end': '23:50'},
        'weeklyCap': 5,
      });
      expect(p.quietStart, const ClockTime(22, 30));
      expect(p.channelOn('weekly_plan'), isFalse);
      expect(p.studyWindow!.start, const ClockTime(23, 30));
      expect(p.studyWindowInQuietHours, isTrue);
    });

    test('a study window outside quiet hours has no conflict', () {
      final p = NotificationPrefs.fromJson({'studyWindow': {'start': '20:00', 'end': '20:30'}});
      expect(p.studyWindowInQuietHours, isFalse);
    });

    test('ClockTime rejects bad strings', () {
      expect(ClockTime.tryParse('24:00'), isNull);
      expect(ClockTime.tryParse('7:5'), isNull);
      expect(ClockTime.tryParse(null), isNull);
      expect(ClockTime.tryParse('07:05'), const ClockTime(7, 5));
    });
  });

  group('Consent', () {
    test('collects only for an adult who allowed it and has not withdrawn', () {
      expect(Consent.fromJson({'ageBand': 'adult', 'analyticsAllowed': true}).canCollect, isTrue);
      expect(Consent.fromJson({'ageBand': 'adult', 'analyticsAllowed': true, 'withdrawnAt': '2026-10-12T00:00:00Z'}).canCollect, isFalse);
      expect(Consent.fromJson({'ageBand': 'minor', 'analyticsAllowed': true}).canCollect, isFalse);
      expect(Consent.fromJson({'ageBand': 'unknown', 'analyticsAllowed': true}).canCollect, isTrue, reason: 'Rather not say is on (D183)');
      expect(Consent.fromJson({}).canCollect, isFalse);
    });
  });

  group('Study', () {
    test('every unit status maps, including lock_in', () {
      expect(StudyUnitStatus.fromWire('new'), StudyUnitStatus.newUnit);
      expect(StudyUnitStatus.fromWire('in_progress'), StudyUnitStatus.inProgress);
      expect(StudyUnitStatus.fromWire('lock_in'), StudyUnitStatus.lockIn);
      expect(StudyUnitStatus.fromWire('due'), StudyUnitStatus.due);
      expect(StudyUnitStatus.fromWire('learned'), StudyUnitStatus.learned);
      expect(StudyUnitStatus.fromWire('mastered'), StudyUnitStatus.unknown);
    });

    test('catalog, run and unit essentials', () {
      final c = StudyCatalog.fromJson({
        'state': 'ready',
        'units': [{'id': 'u1', 'title': 'Goodwill', 'status': 'lock_in'}],
        'queue': {'dueCount': 12, 'overdueCount': 2, 'newAllowance': 5, 'availableCount': 14, 'newCount': 2, 'pausedNew': false},
        'active': {'id': 'r1', 'mode': 'recall', 'step': 2, 'total': 10},
        'recallEnabled': true,
      });
      expect(c.queue.dueCount, 12);
      expect(c.units.single.status, StudyUnitStatus.lockIn);
      expect(c.active!.id, 'r1');
      expect(c.isDisabled, isFalse);
      final run = StudyRun.fromJson({'id': 'r1', 'state': 'complete', 'cursor': 10, 'revision': 20, 'total': 10});
      expect(run.isComplete, isTrue);
      expect(run.revision, 20);
      final unit = StudyUnit.fromJson({'id': 'u1', 'title': 'Goodwill', 'version': '3', 'contentHash': 'abc', 'recall': {'available': 4}});
      expect(unit.recallAvailable, 4);
      expect(unit.contentHash, 'abc');
    });
  });

  group('Subjects', () {
    test('only supported subjects are offered, public and internal ids are kept apart', () {
      final gat = Subject.fromJson({'id': 'general_test', 'internalId': 'gat', 'name': 'General Test', 'practice': 'supported'});
      final merged = Subject.fromJson({'id': 'applied_mathematics', 'name': 'Applied Mathematics', 'practice': 'merged'});
      expect(gat.isSupported, isTrue);
      expect(gat.internalId, 'gat');
      expect(merged.isSupported, isFalse);
    });

    test('chapters come grouped or flat', () {
      final grouped = ChapterCatalog.fromJson({
        'grouped': true,
        'units': [{'id': 'u', 'name': 'Unit', 'chapters': [{'id': 'c1', 'name': 'Goodwill'}, {'id': 'c2', 'name': 'Ratios'}]}],
      });
      final flat = ChapterCatalog.fromJson({'grouped': false, 'chapters': [{'id': 'c1', 'name': 'Goodwill'}]});
      expect(grouped.allChapters.length, 2);
      expect(flat.allChapters.single.name, 'Goodwill');
    });
  });

  group('AuthMe', () {
    test('parses the profile and drops the payment fields', () {
      final me = AuthMe.fromJson({
        'user': {'id': 'usr_1', 'email': 'a@b.co', 'subjects': [], 'isPremium': false, 'razorpaySubscriptionId': 'sub_secret'},
        'needsOnboarding': true,
      });
      expect(me.user!.id, 'usr_1');
      expect(me.needsOnboarding, isTrue);
      expect(me.user!.isPremium, isFalse);
    });

    test('a body with no user is null', () {
      expect(AuthMe.fromJson({'user': null, 'needsOnboarding': false}).user, isNull);
    });
  });
}
