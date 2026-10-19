// A Dart port of `readout` and `answerFromInsights` in data/prepos_insights.js, so questions
// about the student's own record are answered on the phone: instantly, offline from the
// cached record, and never billed. Keep the wording in step with the website.

import 'insights_models.dart';
import 'subject_names.dart';

const int _minChapterSample = 4;
const int _maxRecordQuestionChars = 140;

String _sec(int s) => s >= 60 ? '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}' : '${s}s';
String _sign(int n) => n > 0 ? '+$n' : '$n';
String _plural(int n, String word) => '$n $word${n == 1 ? '' : 's'}';

/// "They lost 374 of the 415 marks on offer." Past the offer (6 go for a wrong answer, 5 are on offer) the "of" is left out,
/// as Review leaves it out.
String _lostLine(ChapterLine c) =>
    c.lost > c.offer ? 'They lost ${c.lost} marks.' : 'They lost ${c.lost} of the ${c.offer} marks on offer.';

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
      // The chapter's own name, never its subject's, and Review's figure for it (6 a wrong answer, 5 a blank, of 5 a
      // question on offer), so Ask Mobi, Review and Today say one number for one chapter (final walk, H6).
      headline: 'You lose the most marks in ${top.chapter}',
      detail: '${top.chapter}: ${top.right} right, ${top.wrong} wrong, ${top.skip} left blank, of ${_plural(top.n, 'question')} over '
          '${_plural(top.sessions, 'session')}. ${_lostLine(top)}',
      actionLabel: 'Practise ${top.chapter}',
      // The key says "Practise <chapter>", so the link carries the chapter: without it the app
      // opens all-chapters Quick practice for the subject.
      actionHref: Uri(
        path: '/dashboard',
        queryParameters: {'mode': 'chapter', 'subject': canonicalSubjectId(top.subject), 'chapter': top.chapter},
      ).toString(),
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
          '(${_sign(c.marksGained)} marks) and ${c.losses} hurt (−${c.marksLost}).',
      actionLabel: 'See your replay in Your papers',
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
  // A record question is short, plain and about the student. A pasted question, a quote or the
  // "Explain this question" seed belongs to the model, whatever words it happens to contain.
  final trimmed = text.trim();
  if (trimmed.length > _maxRecordQuestionChars || RegExp(r'["\u201c\u201d\n]').hasMatch(trimmed)) return null;
  final cleaned = trimmed.toLowerCase().replaceAll(RegExp(r'[^a-z0-9\s]'), ' ').replaceAll(RegExp(r'\s+'), ' ').trim();
  if (cleaned.startsWith('explain ') || cleaned.startsWith('solve ')) return null;
  final tokens = cleaned.split(' ');
  final q = ' $cleaned ';
  // Whole words only, so "exchange" is not "change" and "benchmarks" is not "marks". A trailing
  // "*" means any word that starts with it.
  bool has(List<String> words) => words.any((w) => w.endsWith('*') ? tokens.any((t) => t.startsWith(w.substring(0, w.length - 1))) : q.contains(' $w '));
  const recordWords = [
    'lose', 'losing', 'lost', 'leak', 'leaks', 'weak', 'weakest', 'chapter', 'chapters', 'slow', 'pace', 'time', 'change', 'changing', 'changed', //
    'skip', 'skipped', 'blank', 'week', 'progress', 'accuracy', 'improv*', 'marks',
  ];
  if (!has(recordWords)) return null;
  // About me, or just a few words ("which chapter is weak"): not a sentence about something else.
  // Anything longer that is not about the student goes to the server, which answers from the
  // record itself when it is one.
  const self = {'i', 'my', 'me', 'mine', 'myself'};
  if (tokens.length > 4 && !tokens.any(self.contains)) return null;
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
  if (has(['change', 'changing', 'changed', 'second guess'])) {
    hit = pick('changes');
  } else if (has(['slow', 'slowest', 'pace', 'time', 'fast'])) {
    hit = pick('pace');
  } else if (has(['skip', 'skipped', 'blank', 'left'])) {
    hit = pick('skips');
  } else if (has(['week', 'progress', 'improv*'])) {
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
