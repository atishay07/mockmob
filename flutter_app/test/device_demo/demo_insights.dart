// The record ("Your record" in Review) as the server would compute it from the demo's papers:
// the same sessions, questions, marks and chapters every other screen shows. Demo only.
import 'dart:math' as math;

import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/router/quick_start.dart' show subjectDisplayName;
import 'package:mockmob/features/insights/data/insights_models.dart';

/// A share with a rough 90% interval (Wilson), as the server reports it.
Map<String, dynamic> _rate(int right, int n) {
  if (n == 0) return {'pct': null, 'n': 0};
  const z = 1.645;
  final p = right / n;
  final denom = 1 + z * z / n;
  final centre = (p + z * z / (2 * n)) / denom;
  final half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom;
  return {'pct': (p * 100).round(), 'low': ((centre - half) * 100).round().clamp(0, 100), 'high': ((centre + half) * 100).round().clamp(0, 100), 'n': n};
}

String _publicSubject(String s) => s == 'gat' ? 'general_test' : s;

PrepInsights demoInsights(List<Attempt> attempts, DateTime nowUtc) {
  var right = 0, wrong = 0, skip = 0;
  final chapters = <String, ({String subject, String chapter, int right, int wrong, int skip, Set<String> sessions, int last})>{};
  for (final a in attempts) {
    right += a.correct;
    wrong += a.wrong;
    skip += a.unattempted;
    final chapterOf = {for (final q in a.questions) q.id: q.chapter ?? 'Other questions'};
    for (final d in a.details) {
      final chapter = chapterOf[d.qid] ?? 'Other questions';
      final key = '${a.subject}::$chapter';
      final c = chapters[key] ?? (subject: a.subject, chapter: chapter, right: 0, wrong: 0, skip: 0, sessions: <String>{}, last: 0);
      chapters[key] = (
        subject: c.subject,
        chapter: chapter,
        right: c.right + (d.isCorrect == true ? 1 : 0),
        wrong: c.wrong + (d.isCorrect == false ? 1 : 0),
        skip: c.skip + (d.isCorrect == null ? 1 : 0),
        sessions: {...c.sessions, a.id},
        last: math.max(c.last, a.completedAt.millisecondsSinceEpoch),
      );
    }
  }
  final questions = right + wrong + skip;
  Map<String, dynamic> line(String key, ({String subject, String chapter, int right, int wrong, int skip, Set<String> sessions, int last}) c) => {
        'key': key,
        'subject': _publicSubject(c.subject),
        'subjectName': subjectDisplayName(_publicSubject(c.subject)),
        'chapter': c.chapter,
        'right': c.right,
        'wrong': c.wrong,
        'skip': c.skip,
        'n': c.right + c.wrong + c.skip,
        'sessions': c.sessions.length,
        'accuracy': _rate(c.right, c.right + c.wrong),
        'open': (c.wrong + c.skip) * 5,
        'last': c.last,
      };
  final ranked = chapters.entries.toList()..sort((a, b) => ((b.value.wrong + b.value.skip) * 5).compareTo((a.value.wrong + a.value.skip) * 5));
  final top = ranked.isEmpty ? null : ranked.first.value;

  Map<String, dynamic> weekOf(Iterable<Attempt> list) {
    var r = 0, w = 0, s = 0;
    for (final a in list) {
      r += a.correct;
      w += a.wrong;
      s += a.unattempted;
    }
    return {'sessions': list.length, 'questions': r + w + s, 'right': r, 'wrong': w, 'skip': s, 'net': r * 5 - w, 'accuracy': _rate(r, r + w)};
  }

  final weekAgo = nowUtc.subtract(const Duration(days: 7));
  final twoWeeksAgo = nowUtc.subtract(const Duration(days: 14));
  final times = [for (final a in attempts) a.completedAt.millisecondsSinceEpoch];
  final activeDays = {for (final a in attempts) if (a.completedAt.isAfter(twoWeeksAgo)) '${a.completedAt.year}-${a.completedAt.month}-${a.completedAt.day}'};
  return PrepInsights.fromJson({
    'ok': true,
    'insights': {
      'state': attempts.isEmpty ? 'empty' : 'ready',
      'sessions': attempts.length,
      'questions': questions,
      'window': {'first': times.isEmpty ? null : times.reduce(math.min), 'last': times.isEmpty ? null : times.reduce(math.max)},
      'ledger': {'gained': right * 5, 'penalty': wrong, 'net': right * 5 - wrong, 'openWrong': wrong * 5, 'openSkipped': skip * 5, 'open': (wrong + skip) * 5},
      'accuracy': _rate(right, right + wrong),
      'attemptRate': questions == 0 ? null : ((right + wrong) * 100 / questions).round(),
      'chapters': {
        'ranked': [for (final e in ranked.where((e) => e.value.right + e.value.wrong + e.value.skip >= 4).take(6)) line(e.key, e.value)],
        'thin': [for (final e in ranked.where((e) => e.value.right + e.value.wrong + e.value.skip < 4)) line(e.key, e.value)],
      },
      'difficulty': [],
      'pace': {'usable': false, 'questionsTimed': 0, 'sessionsTimed': 0, 'slowest': []},
      'changes': {'sessionsWithTelemetry': 0, 'count': 0, 'gains': 0, 'losses': 0, 'marksGained': 0, 'marksLost': 0, 'net': 0},
      'week': {
        'thisWeek': weekOf(attempts.where((a) => a.completedAt.isAfter(weekAgo))),
        'lastWeek': weekOf(attempts.where((a) => a.completedAt.isAfter(twoWeeksAgo) && !a.completedAt.isAfter(weekAgo))),
        'activeDaysLast14': activeDays.length,
      },
    },
    'findings': [
      if (top != null)
        {
          'id': 'chapter',
          'kind': 'leak',
          'n': top.right + top.wrong + top.skip,
          'headline': '${top.chapter} is where the most marks are open',
          'detail':
              '${subjectDisplayName(_publicSubject(top.subject))}: ${top.right} right, ${top.wrong} wrong, ${top.skip} left blank out of ${top.right + top.wrong + top.skip} questions over ${top.sessions.length} sessions.',
          'action': {'label': 'Practise ${top.chapter}', 'href': '/dashboard?subject=${_publicSubject(top.subject)}&mode=quick'},
        },
    ],
    'basis': 'Your server-scored sessions.',
  });
}
