import 'package:timezone/timezone.dart' as tz;

import '../../../core/copy/copy.dart';
import '../copy.dart';

/// What the next reminder is about.
enum NextKind { study, repair, weekly }

/// Why nothing is scheduled.
enum NothingReason {
  /// Every reminder is off, or there is no study window to remind at.
  off,

  /// Quiet hours cover the moment a reminder would arrive.
  quietHours,

  /// The weekly limit is already used.
  weeklyCap,

  /// The one reminder a day is already used.
  dailyCap,

  /// Reminders are muted on this phone and nothing falls after the mute ends within the plan.
  muted,

  /// Android is blocking this app's notifications.
  blocked,
}

/// The next reminder as the real scheduler left it after its last plan: the earliest one that was
/// actually accepted by the notification engine (after quiet hours and the caps), or the reason
/// there is none. Never a guess: it is built from the engine's own outcomes.
class NextReminder {
  const NextReminder.at(DateTime this.at, NextKind this.kind, {this.mistakes})
      : reason = null,
        until = null;

  const NextReminder.nothing(NothingReason this.reason, {this.until})
      : at = null,
        kind = null,
        mistakes = null;

  /// For [NothingReason.muted]: when the mute ends.
  final DateTime? until;

  /// When it will show, in the student's timezone. Null when nothing is scheduled.
  final DateTime? at;
  final NextKind? kind;

  /// For a repair reminder: how many mistakes it promises.
  final int? mistakes;
  final NothingReason? reason;

  bool get isScheduled => at != null;

  /// The minute of the day it lands on (0 to 1439), for the day bar's dot.
  int? get minuteOfDay => at == null ? null : at!.hour * 60 + at!.minute;

  /// "Next reminder: tonight 8:30 PM, repair 3 mistakes", or "Nothing scheduled".
  String headline(DateTime now) {
    final when = at;
    if (when == null) return NotificationsCopy.nextNothing;
    final detail = switch (kind!) {
      NextKind.study => NotificationsCopy.nextStudy,
      NextKind.repair => NotificationsCopy.nextRepair(mistakes ?? 1),
      NextKind.weekly => NotificationsCopy.nextWeekly,
    };
    return '${NotificationsCopy.nextLabel}: ${dayWord(now, when)} ${formatTime12(when)}, $detail';
  }

  /// The reason for "Nothing scheduled", or null when something is.
  String? get why => switch (reason) {
        null => null,
        NothingReason.off => NotificationsCopy.nextReasonOff,
        NothingReason.quietHours => NotificationsCopy.nextReasonQuiet,
        NothingReason.weeklyCap => NotificationsCopy.nextReasonCap,
        NothingReason.dailyCap => NotificationsCopy.nextReasonDaily,
        NothingReason.muted => until == null ? NotificationsCopy.nextReasonMutedPlain : NotificationsCopy.nextReasonMuted(until!),
        NothingReason.blocked => NotificationsCopy.nextReasonBlocked,
      };

  /// The whole line for TalkBack.
  String sentence(DateTime now) => why == null ? headline(now) : '${headline(now)}. $why';

  /// "today" or "tonight" (from 5 PM) for the same day, "tomorrow", else the short weekday and
  /// date ("Mon 19 Oct").
  static String dayWord(DateTime now, DateTime at) {
    final here = at is tz.TZDateTime ? tz.TZDateTime.from(now, at.location) : now;
    final today = DateTime(here.year, here.month, here.day);
    final day = DateTime(at.year, at.month, at.day);
    final diff = day.difference(today).inDays;
    if (diff <= 0) return at.hour >= 17 ? 'tonight' : 'today';
    if (diff == 1) return 'tomorrow';
    return '${weekdayName(at.weekday).substring(0, 3)} ${formatDayMonthShort(at)}';
  }
}

/// The earliest accepted reminder of one planning pass, or why there was none.
///
/// [accepted] are the reminders the engine took (time, kind, mistakes); [skips] the reasons it
/// turned the others away; [planned] how many reminders the plan held at all.
NextReminder nextReminderFrom({
  required List<(DateTime at, NextKind kind, int? mistakes)> accepted,
  required List<NextSkip> skips,
  required int planned,
  DateTime? mutedUntil,
}) {
  if (accepted.isNotEmpty) {
    final first = ([...accepted]..sort((a, b) => a.$1.compareTo(b.$1))).first;
    return NextReminder.at(first.$1, first.$2, mistakes: first.$3);
  }
  // A running mute is the reason, whatever else the plan held: nothing arrives until it ends.
  if (mutedUntil != null) return NextReminder.nothing(NothingReason.muted, until: mutedUntil);
  if (planned == 0) return const NextReminder.nothing(NothingReason.off);
  if (skips.contains(NextSkip.cap)) return const NextReminder.nothing(NothingReason.weeklyCap);
  if (skips.contains(NextSkip.daily)) return const NextReminder.nothing(NothingReason.dailyCap);
  if (skips.contains(NextSkip.stale)) return const NextReminder.nothing(NothingReason.quietHours);
  return const NextReminder.nothing(NothingReason.off);
}

/// A reason the engine turned a reminder away, in the notifications module's own words.
enum NextSkip { cap, daily, stale, off }
