// What Mobi (and the page) answers on Today, decided from real events only: a refresh that
// brought changes, a read that failed, a duration chip picked, today newly counted by the server.
// Nothing here guesses: every cue is the diff of two real views or a real tap.
//
// [todayMobiCue] is the one place those cues are published. The hero Mobi reacts to them at once
// through his controller; the header's round Mobi can subscribe later without Today changing.
import 'package:flutter/foundation.dart';

import '../../../core/domain/next_move.dart' show NextMoveState;
import '../../../core/mascot/mascot.dart' show MobiAct, MobiEvent, MobiMoments, MobiRation;
import '../../rhythm/logic/plan_week.dart';
import 'today_model.dart';

/// A notifier that tells its listeners about every cue, even when it is the same act twice in a
/// row (a plain [ValueNotifier] would swallow the second one). The value is the act of the
/// latest cue; [count] says how many have been sent, so a listener can tell a new one apart.
class MobiCueNotifier extends ValueNotifier<MobiAct?> {
  MobiCueNotifier() : super(null);

  int _count = 0;
  int get count => _count;

  /// Sends [act] to every listener now.
  void cue(MobiAct act) {
    _count++;
    if (value == act) {
      notifyListeners();
    } else {
      value = act;
    }
  }

  /// Clears the latest cue (a listener has played it). Does not notify.
  void clear() => value = null;
}

/// Today's Mobi cue, for the hero Mobi (now) and the header Mobi (when it subscribes).
final MobiCueNotifier todayMobiCue = MobiCueNotifier();

/// What changed between two views of Today.
class TodayChange {
  const TodayChange({required this.changed, required this.todayNewlyCounted, required this.failedRead});

  /// Something the student can see is different (a number, a mark, a paper, a hero).
  final bool changed;

  /// Today's bubble was open and the server now counts it.
  final bool todayNewlyCounted;

  /// The new view is a read that failed.
  final bool failedRead;

  static const none = TodayChange(changed: false, todayNewlyCounted: false, failedRead: false);
}

abstract final class TodayReactions {
  /// Whether [view]'s week shows today as counted.
  static bool todayCounted(TodayView view) {
    final days = view.header.week?.days;
    if (days == null) return false;
    for (final d in days) {
      if (d.isToday) return d.mark == PlanDayMark.done;
    }
    return false;
  }

  /// The view's read of the record failed (the hero is the error card, not a move).
  static bool failedRead(TodayView view) {
    final hero = view.hero;
    return hero is MoveHero && hero.state == NextMoveState.historyUnavailable;
  }

  /// Everything a student can read on the page, as one string: two views with the same signature
  /// look the same, so a refresh between them is "unchanged" and does nothing.
  static String signature(TodayView view) {
    final b = StringBuffer();
    final week = view.header.week;
    if (week != null) {
      b
        ..write(week.count)
        ..write('|${week.outlook}|${week.met}|${week.paused}|');
      for (final d in week.days) {
        b.write('${d.mark.index}${d.isToday ? 't' : ''},');
      }
    }
    switch (view.hero) {
      case MoveHero h:
        b.write('|move:${h.state.name}:${h.number}:${h.meaning}:${h.primary.label}:${h.subjectLine}');
      case ResumeHero h:
        b.write('|resume:${h.sessionId}:${h.answered}/${h.total}');
      case SealedHero h:
        b.write('|sealed:${h.attemptId}');
      case EndedHero h:
        b.write('|ended:${h.title}:${h.action.label}');
      case OpenPaperHero h:
        b.write('|open:${h.paper.identity}:${h.line}');
      case null:
        b.write('|none');
    }
    for (final s in view.also) {
      b.write('|also:${s.title}:${s.action.label}');
    }
    for (final r in view.sheet) {
      b.write('|row:${r.attemptId}:${r.marks}:${r.sealed}:${r.change}');
    }
    final road = view.road;
    if (road != null) b.write('|road:${road.weeks}:${road.daysToWindow}:${road.daysLeft}');
    return b.toString();
  }

  /// The change from [before] to [after].
  static TodayChange compare(TodayView before, TodayView after) {
    if (before.hero == null) {
      // The page was still loading: arriving is not a change to react to, but a failure is.
      return TodayChange(changed: false, todayNewlyCounted: false, failedRead: failedRead(after));
    }
    return TodayChange(
      changed: signature(before) != signature(after),
      todayNewlyCounted: !todayCounted(before) && todayCounted(after),
      failedRead: failedRead(after) && !failedRead(before),
    );
  }

  /// The act Mobi plays for [change], or null for nothing. A counted today is the best news (a
  /// small hop); a refresh that only changed numbers is a quiet nod; a read that failed is one
  /// shrug a run.
  static MobiAct? actFor(TodayChange change) {
    if (change.failedRead) return MobiRation.oopsRun('today') ? MobiMoments.act(MobiEvent.setback) : null;
    if (change.todayNewlyCounted) return MobiMoments.act(MobiEvent.dayCounted);
    if (change.changed) return MobiMoments.act(MobiEvent.saveConfirmed);
    return null;
  }
}
