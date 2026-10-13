// A Dart port of `readout` and `answerFromInsights` in data/prepos_insights.js, so questions
// about the student's own record are answered on the phone: instantly, offline from the
// cached record, and never billed. Keep the wording in step with the website.

import 'insights_models.dart';

const int _minChapterSample = 4;

String _sec(int s) => s >= 60 ? '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}' : '${s}s';
String _sign(int n) => n > 0 ? '+$n' : '$n';
String _plural(int n, String word) => '$n $word${n == 1 ? '' : 's'}';

/// Plain-language findings, strongest first, each with its sample size.
List<Finding> readout(PrepInsights insights, {int limit = 4}) {
  if (!insights.isReady) return const [];
  final out = <Finding>[];
  final top = insights.ranked.isEmpty ? null : insights.ranked.first;
  if (top != null) {
    out.add(Finding(
      id: 'chapter',
      kind: 'leak',
      n: top.n,
      headline: '${top.chapter} is where the most marks are open',
      detail: '${top.subjectName}: ${top.right} right, ${top.wrong} wrong, ${top.skip} left blank out of ${top.n} questions over '
          '${_plural(top.sessions, 'session')}. Those ${top.wrong + top.skip} questions were worth ${top.open} marks.',
      actionLabel: 'Practise ${top.chapter}',
      actionHref: '/dashboard?subject=${Uri.encodeComponent(top.subject)}&mode=quick',
    ));
  } else if (insights.thin.isNotEmpty) {
    final t = insights.thin.first;
    out.add(Finding(
      id: 'thin',
      kind: 'info',
      n: t.n,
      headline: 'Not enough questions in any one chapter to rank them yet',
      detail: 'Most recent miss: ${t.chapter} (${_plural(t.n, 'question')} so far). Chapters are ranked once there are '
          '$_minChapterSample or more answered in each.',
      actionLabel: 'Practise another set',
      actionHref: '/dashboard?mode=quick',
    ));
  }
  final c = insights.changes;
  if (c.count >= 2) {
    out.add(Finding(
      id: 'changes',
      kind: c.net < 0 ? 'leak' : (c.net > 0 ? 'good' : 'info'),
      n: c.count,
      headline: c.net < 0
          ? 'Changing answers has cost ${-c.net} marks net'
          : (c.net > 0 ? 'Changing answers has gained ${c.net} marks net' : 'Changing answers has been about even'),
      detail: '${c.count} changes across ${_plural(c.sessionsWithTelemetry, 'timed session')}: ${c.gains} helped '
          '(${_sign(c.marksGained)} marks) and ${c.losses} hurt (-${c.marksLost}).',
      actionLabel: 'See your replay in Review',
      actionHref: '/review',
    ));
  }
  final p = insights.pace;
  if (p.usable && p.slowest.isNotEmpty && p.medianSec != null && p.medianSec! > 0) {
    final s = p.slowest.first;
    final share = p.shareOnWrong == null ? '' : 'About ${p.shareOnWrong}% of your timed minutes went on questions you got wrong. ';
    out.add(Finding(
      id: 'pace',
      kind: 'info',
      n: p.questionsTimed,
      headline: 'Your slowest question took ${_sec(s.seconds)}, against a typical ${_sec(p.medianSec!)}',
      detail: '${s.chapter} (question ${s.position ?? '?'}). ${share}Timed across ${p.questionsTimed} questions.',
      actionLabel: 'Do a paced 10-question set',
      actionHref: '/dashboard?mode=quick&count=10',
    ));
  }
  final blankShare = insights.attemptRate == null ? 0 : 100 - insights.attemptRate!;
  if (blankShare >= 15 && insights.ledger.openSkipped > 0) {
    out.add(Finding(
      id: 'skips',
      kind: 'info',
      n: insights.questions,
      headline: '$blankShare% of questions were left blank',
      detail: '${insights.ledger.openSkipped ~/ 5} blank questions were worth ${insights.ledger.openSkipped} marks. Blank costs '
          'nothing under CUET marking, but it gains nothing either; a wrong answer costs 1.',
      actionLabel: 'Review skipped questions',
      actionHref: '/review',
    ));
  }
  for (final d in insights.difficulty) {
    if (d.level != 'easy') continue;
    final answered = d.right + d.wrong;
    final pct = d.accuracy.pct;
    if (answered >= 8 && pct != null && pct < 70) {
      out.add(Finding(
        id: 'easy',
        kind: 'leak',
        n: answered,
        headline: 'Easy questions are right $pct% of the time',
        detail: '${d.right} of $answered (likely range ${d.accuracy.low} to ${d.accuracy.high}%). Misses on easy questions usually '
            'point to speed or care rather than gaps.',
        actionLabel: 'Review your easy misses',
        actionHref: '/review',
      ));
    }
  }
  return out.take(limit).toList();
}

/// A reply computed from the record, with the places it can send the student.
class RecordAnswer {
  const RecordAnswer(this.reply, {this.actions = const []});

  final String reply;

  /// (label, web href) pairs; the screen maps each href to an in-app route or hides it.
  final List<(String, String)> actions;
}

/// Deterministic answers to questions about the record. Null when [text] is not about it.
RecordAnswer? answerFromInsights(String text, PrepInsights insights, {bool pro = true}) {
  final cleaned = text.toLowerCase().replaceAll(RegExp(r'[^a-z0-9\s]'), ' ').replaceAll(RegExp(r'\s+'), ' ').trim();
  final q = ' $cleaned ';
  bool has(List<String> words) => words.any((w) => q.contains(' $w') || q.contains('$w '));
  const recordWords = [
    'lose', 'losing', 'lost', 'leak', 'weak', 'chapter', 'slow', 'pace', 'time', 'change', 'changing', 'skip', 'blank', //
    'week', 'progress', 'accuracy', 'improv', 'marks',
  ];
  if (!has(recordWords)) return null;
  if (!insights.isReady) {
    return const RecordAnswer(
      'There is nothing to analyse yet. Finish one practice session and your record will show where your marks went.',
      actions: [('Start a practice set', '/dashboard?mode=quick')],
    );
  }
  final found = readout(insights, limit: 6);
  Finding? pick(String id) {
    for (final f in found) {
      if (f.id == id) return f;
    }
    return null;
  }

  Finding? hit;
  if (has(['change', 'changing', 'second guess'])) {
    hit = pick('changes');
  } else if (has(['slow', 'pace', 'time', 'fast'])) {
    hit = pick('pace');
  } else if (has(['skip', 'blank', 'left'])) {
    hit = pick('skips');
  } else if (has(['week', 'progress', 'improv'])) {
    final t = insights.thisWeek;
    final l = insights.lastWeek;
    if (t.sessions == 0) return const RecordAnswer('You have not finished a session in the last 7 days.');
    final acc = t.accuracy.known ? ', ${t.accuracy.pct}% accuracy (likely range ${t.accuracy.low} to ${t.accuracy.high}%)' : '';
    final before = l.sessions > 0
        ? 'The week before: ${_plural(l.sessions, 'session')}, ${l.net} net marks.'
        : 'There is no earlier week to compare with yet.';
    return RecordAnswer(
      'Last 7 days: ${_plural(t.sessions, 'session')}, ${t.questions} questions, ${t.net} net marks$acc. $before',
    );
  } else {
    hit = pick('chapter') ?? pick('thin') ?? (found.isEmpty ? null : found.first);
  }
  hit ??= found.isEmpty ? null : found.first;
  if (!pro && hit != null && (hit.id == 'changes' || hit.id == 'pace')) {
    return RecordAnswer(
      '${hit.id == 'changes' ? 'Changed-answer detail' : 'Pace detail'} is part of Pro. Your chapters, marks ledger and weekly summary are free.',
    );
  }
  if (hit == null) {
    return const RecordAnswer(
      'Nothing stands out yet.',
      actions: [('Start a practice set', '/dashboard?mode=quick')],
    );
  }
  final label = hit.actionLabel;
  final href = hit.actionHref;
  return RecordAnswer('${hit.headline}. ${hit.detail}', actions: [if (label != null && href != null) (label, href)]);
}
