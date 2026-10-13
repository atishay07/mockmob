// Demo records for the insights tests and goldens. Test data only: never shipped in lib/.

import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/data/practice_question.dart';

import '../../core_data/support/fixtures.dart';

Map<String, dynamic> _rate(int pct, int low, int high, int n) => {'pct': pct, 'low': low, 'high': high, 'n': n};

Map<String, dynamic> _chapter(String subject, String name, String chapter, int r, int w, int s, int sessions, Map<String, dynamic> acc) => {
      'key': '$subject::$chapter',
      'subject': subject,
      'subjectName': name,
      'chapter': chapter,
      'right': r,
      'wrong': w,
      'skip': s,
      'n': r + w + s,
      'sessions': sessions,
      'accuracy': acc,
      'open': (w + s) * 5,
      'last': 1760000000000,
    };

/// A student with seven scored sessions across two subjects.
Map<String, dynamic> richInsightsJson() => {
      'ok': true,
      'insights': {
        'state': 'ready',
        'sessions': 7,
        'questions': 112,
        'window': {'first': 1759300000000, 'last': 1760300000000},
        'ledger': {'gained': 345, 'penalty': 21, 'net': 324, 'openWrong': 105, 'openSkipped': 110, 'open': 215},
        'accuracy': _rate(77, 68, 84, 90),
        'attemptRate': 80,
        'chapters': {
          'ranked': [
            _chapter('accountancy', 'Accountancy', 'Partnership: admission of a partner', 6, 4, 3, 3, _rate(60, 31, 83, 10)),
            _chapter('economics', 'Economics', 'Money and banking', 7, 3, 2, 2, _rate(70, 40, 89, 10)),
            _chapter('accountancy', 'Accountancy', 'Cash flow statement', 9, 2, 2, 3, _rate(82, 52, 95, 11)),
            _chapter('economics', 'Economics', 'National income accounting', 10, 1, 1, 2, _rate(91, 62, 98, 11)),
          ],
          'thin': [
            _chapter('accountancy', 'Accountancy', 'Issue of debentures', 1, 1, 1, 1, _rate(50, 9, 91, 2)),
          ],
        },
        'difficulty': [
          {'level': 'easy', 'n': 30, 'right': 25, 'wrong': 3, 'skip': 2, 'accuracy': _rate(89, 73, 96, 28)},
        ],
        'pace': {
          'usable': true,
          'questionsTimed': 64,
          'sessionsTimed': 4,
          'medianSec': 41,
          'p90Sec': 96,
          'medianRightSec': 37,
          'medianWrongSec': 58,
          'shareOnWrong': 22,
          'slowest': [
            {'chapter': 'Cash flow statement', 'subject': 'accountancy', 'position': 7, 'seconds': 184, 'outcome': 'wrong'},
          ],
        },
        'changes': {'sessionsWithTelemetry': 4, 'count': 9, 'gains': 3, 'losses': 6, 'marksGained': 18, 'marksLost': 36, 'net': -18},
        'week': {
          'thisWeek': {'sessions': 3, 'questions': 40, 'right': 27, 'wrong': 7, 'skip': 6, 'net': 128, 'accuracy': _rate(79, 63, 90, 34)},
          'lastWeek': {'sessions': 2, 'questions': 30, 'right': 18, 'wrong': 6, 'skip': 6, 'net': 84, 'accuracy': _rate(75, 55, 88, 24)},
          'activeDaysLast14': 5,
        },
      },
      'findings': [
        {
          'id': 'chapter',
          'kind': 'leak',
          'n': 13,
          'headline': 'Partnership: admission of a partner is where the most marks are open',
          'detail': 'Accountancy: 6 right, 4 wrong, 3 left blank out of 13 questions over 3 sessions. Those 7 questions were worth 35 marks.',
          'action': {'label': 'Practise Partnership: admission of a partner', 'href': '/dashboard?subject=accountancy&mode=quick'},
        },
        {
          'id': 'changes',
          'kind': 'leak',
          'n': 9,
          'headline': 'Changing answers has cost 18 marks net',
          'detail': '9 changes across 4 timed sessions: 3 helped (+18 marks) and 6 hurt (-36). Both directions are counted.',
          'action': {'label': 'See your replay in Review', 'href': '/review'},
        },
        {
          'id': 'skips',
          'kind': 'info',
          'n': 112,
          'headline': '20% of questions were left blank',
          'detail': '22 blank questions were worth 110 marks. Blank costs nothing under CUET marking, but it gains nothing either; a wrong answer costs 1.',
          'action': {'label': 'Review skipped questions', 'href': '/review'},
        },
      ],
      'basis': 'Your server-scored sessions. Timing comes from device events.',
    };

/// Two sessions, chapters too thin to rank.
Map<String, dynamic> thinInsightsJson() => {
      'ok': true,
      'insights': {
        'state': 'ready',
        'sessions': 1,
        'questions': 10,
        'window': {'first': 1760300000000, 'last': 1760300000000},
        'ledger': {'gained': 35, 'penalty': 2, 'net': 33, 'openWrong': 10, 'openSkipped': 5, 'open': 15},
        'accuracy': _rate(78, 45, 94, 9),
        'attemptRate': 90,
        'chapters': {
          'ranked': [],
          'thin': [_chapter('accountancy', 'Accountancy', 'Partnership: fundamentals', 2, 1, 0, 1, _rate(67, 21, 94, 3))],
        },
        'difficulty': [],
        'pace': {'usable': false, 'questionsTimed': 0, 'sessionsTimed': 0, 'slowest': []},
        'changes': {'sessionsWithTelemetry': 0, 'count': 0, 'gains': 0, 'losses': 0, 'marksGained': 0, 'marksLost': 0, 'net': 0},
        'week': {
          'thisWeek': {'sessions': 1, 'questions': 10, 'right': 7, 'wrong': 2, 'skip': 1, 'net': 33, 'accuracy': _rate(78, 45, 94, 9)},
          'lastWeek': {'sessions': 0, 'questions': 0, 'right': 0, 'wrong': 0, 'skip': 0, 'net': 0, 'accuracy': {'pct': null, 'n': 0}},
          'activeDaysLast14': 1,
        },
      },
      'findings': [
        {
          'id': 'thin',
          'kind': 'info',
          'n': 3,
          'headline': 'Not enough questions in any one chapter to rank them yet',
          'detail': 'Most recent miss: Partnership: fundamentals (3 questions so far). Chapters are ranked once there are 4 or more answered in each.',
          'action': {'label': 'Practise another set', 'href': '/dashboard?mode=quick'},
        },
      ],
    };

Map<String, dynamic> emptyInsightsJson() => {
      'ok': true,
      'insights': {'state': 'empty', 'sessions': 0, 'questions': 0},
      'findings': [],
    };

PrepInsights rich() => PrepInsights.fromJson(richInsightsJson());
PrepInsights thin() => PrepInsights.fromJson(thinInsightsJson());
PrepInsights empty() => PrepInsights.fromJson(emptyInsightsJson());

const _day = 86400000;
const _t0 = 1759300000000;

/// Four Quick 10s in Accountancy and one full Economics mock.
List<Attempt> trendAttempts() => [
      attemptOf(id: 'a1', mode: 'quick', completedAt: _t0, questions: chapterOf('Partnership', right: 5, wrong: 3, blank: 2)),
      attemptOf(id: 'a2', mode: 'quick', completedAt: _t0 + 2 * _day, questions: chapterOf('Partnership', right: 6, wrong: 2, blank: 2)),
      attemptOf(id: 'e1', subject: 'economics', mode: 'full', completedAt: _t0 + 3 * _day, questions: chapterOf('Money', right: 31, wrong: 9, blank: 10)),
      attemptOf(id: 'a3', mode: 'quick', completedAt: _t0 + 5 * _day, questions: chapterOf('Cash flow', right: 5, wrong: 4, blank: 1)),
      attemptOf(id: 'a4', mode: 'quick', completedAt: _t0 + 8 * _day, questions: chapterOf('Cash flow', right: 8, wrong: 1, blank: 1)),
    ];

Map<String, dynamic> questionJson(
  String id, {
  String chapter = 'Partnership: admission of a partner',
  bool saved = false,
  Object? key = 'A',
  String? passage,
  String subject = 'accountancy',
  String? body,
}) =>
    {
      'id': id,
      'subject': subject,
      'chapter': chapter,
      'difficulty': 'medium',
      'body': body ?? 'A and B share profits 3:2. C is admitted for a 1/5 share, taken equally from A and B. What is the new ratio?',
      'options': [
        {'key': 'A', 'text': '5:3:2'},
        {'key': 'B', 'text': '3:2:1'},
        {'key': 'C', 'text': '12:8:5'},
        {'key': 'D', 'text': '2:2:1'},
      ],
      'passage_text': passage,
      'correct_answer': key,
      'explanation': 'C takes 1/5, half from each partner: A gives 1/10 and B gives 1/10. A keeps 3/5 - 1/10 = 5/10, '
          'B keeps 2/5 - 1/10 = 3/10, and C has 2/10. The new ratio is 5:3:2.',
      'upvotes': 14,
      'downvotes': 1,
      'userVote': null,
      'saved': saved,
    };

PracticeQuestion question(String id, {bool saved = false, Object? key = 'A', String? passage, String subject = 'accountancy', String? chapter, String? body}) =>
    PracticeQuestion.fromJson(questionJson(
      id,
      saved: saved,
      key: key,
      passage: passage,
      subject: subject,
      chapter: chapter ?? 'Partnership: admission of a partner',
      body: body,
    ));
