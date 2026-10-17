// What the Android home-screen widget shows, as plain values built from Today and the rhythm
// week. Pure, so tests can feed fixtures. `home_widget_sync.dart` writes the result to the
// widget's storage as one JSON string; TodayWidgetProvider.kt draws it.
//
// The widget shows the last state the server confirmed, stamped with the time of its oldest read. It never makes
// up urgency: the countdown and the week are worked out on the phone when the widget draws, so
// they stay true on a day the app was not opened, and a week that has ended is not shown.
import 'dart:convert';

import '../../features/rhythm/logic/week_view.dart';
import '../../features/today/copy.dart';
import '../../features/today/logic/today_clock.dart' show endedNoticeWindow;
import '../../features/today/logic/today_inputs.dart';
import '../../features/today/logic/today_model.dart';
import '../domain/cuet_dates.dart';
import '../domain/next_move.dart' show NextMoveState;
import '../router/action_router.dart';
import '../router/routes.dart';
import 'home_widget_copy.dart';

/// The key the widget reads (HomeWidgetPreferences on Android).
const String homeWidgetDataKey = 'mm_today_widget';

/// The provider class the update is sent to. Fully qualified, because debug builds carry an
/// application id suffix and the plugin would otherwise look for the class under it.
const String homeWidgetProviderName = 'in.mockmob.app.platform.TodayWidgetProvider';

/// Bumped when the JSON shape changes; the widget ignores a version it does not know.
const int homeWidgetDataVersion = 1;

/// The site App Links open; the widget's taps go through the same link handling.
const String _site = 'https://www.mockmob.in';

/// The move on the widget and where a tap opens.
class WidgetMove {
  const WidgetMove({required this.overline, required this.title, required this.action, required this.href, this.until});

  final String overline;

  /// "Repair 4 mistakes from Mock 7".
  final String title;

  /// "Start repair".
  final String action;

  /// An https link on www.mockmob.in that ActionRouter opens natively.
  final String href;

  /// When the move stops being true on its own (a session's end): the widget then falls back to
  /// "Open MockMob" instead of offering to resume a session that has closed.
  final DateTime? until;

  Map<String, Object?> toJson() => {
        'overline': overline,
        'title': title,
        'action': action,
        'href': href,
        if (until != null) 'until': until!.millisecondsSinceEpoch,
      };
}

enum WidgetWeekState { open, met, paused }

/// The week ring: study days against the goal, for the week that starts on [start].
class WidgetWeek {
  const WidgetWeek({required this.done, required this.goal, required this.state, required this.label, required this.start});

  final int done;
  final int goal;
  final WidgetWeekState state;

  /// Under the ring: "study days", "Goal met", "Paused".
  final String label;

  /// The week's Monday, `YYYY-MM-DD`. The widget hides the ring once this week is over.
  final String start;

  Map<String, Object?> toJson() => {'done': done, 'goal': goal, 'state': state.name, 'label': label, 'start': start};
}

/// When the server last confirmed the data, with the words for each age the widget may find
/// it at (it picks by comparing [day] with its own date in the student's zone).
class WidgetStamp {
  const WidgetStamp({required this.at, required this.day, required this.today, required this.yesterday, required this.older});

  final DateTime at;

  /// The student's calendar date of [at], `YYYY-MM-DD`.
  final String day;
  final String today;
  final String yesterday;
  final String older;

  Map<String, Object?> toJson() => {
        'at': at.millisecondsSinceEpoch,
        'day': day,
        'today': today,
        'yesterday': yesterday,
        'older': older,
      };
}

class HomeWidgetData {
  const HomeWidgetData({required this.signedIn, required this.timezone, this.move, this.week, this.updated});

  /// Signed out: the widget shows a plain "Open MockMob" and nothing personal.
  const HomeWidgetData.signedOut({required this.timezone})
      : signedIn = false,
        move = null,
        week = null,
        updated = null;

  final bool signedIn;
  final String timezone;
  final WidgetMove? move;
  final WidgetWeek? week;
  final WidgetStamp? updated;

  Map<String, Object?> toJson() => {
        'v': homeWidgetDataVersion,
        'signedIn': signedIn,
        'tz': timezone,
        'cuet': {'start': isoDate(CuetDates.windowStart), 'end': isoDate(CuetDates.windowEnd)},
        if (move != null) 'move': move!.toJson(),
        if (week != null) 'week': week!.toJson(),
        if (updated != null) 'updated': updated!.toJson(),
      };

  String encode() => jsonEncode(toJson());

  @override
  bool operator ==(Object other) => other is HomeWidgetData && other.encode() == encode();

  @override
  int get hashCode => encode().hashCode;
}

/// `YYYY-MM-DD` for a calendar date.
String isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// The widget's data for a signed-in student, or null while Today has not settled (the first
/// load is running, or nothing has been confirmed by the server yet). Null keeps what the
/// widget already shows.
HomeWidgetData? homeWidgetFromToday({
  required TodayView view,
  required TodayInputs inputs,
  WeekView? week,
}) {
  final hero = view.hero;
  if (hero == null) return null;
  // A failed read is not a move: Today shows it as a card with "Try again", and the widget
  // keeps the last move the server confirmed instead of replacing it with an error sentence.
  if (_isErrorCard(hero)) return null;
  final confirmed = [?inputs.attemptsFetchedAt, ?inputs.planFetchedAt];
  if (confirmed.isEmpty) return null;
  // The older of the two reads: the attempts are served from the phone's cache on open while
  // the plan is read again, so the newer time would call a days-old list fresh.
  final at = confirmed.reduce((a, b) => a.isBefore(b) ? a : b);
  return HomeWidgetData(
    signedIn: true,
    timezone: inputs.timezone,
    move: widgetMoveFor(hero, inputs),
    week: week == null ? null : widgetWeekFor(week),
    updated: _stamp(inputs, at),
  );
}

/// Today's "could not load" card, or a notice whose only tap is to retry a read. Neither is a
/// move the widget can offer: its tap only opens Today.
bool _isErrorCard(TodayHero hero) => switch (hero) {
      MoveHero() => hero.state == NextMoveState.historyUnavailable || hero.primary.target is RetryLoad,
      EndedHero() => hero.action.target is RetryLoad,
      ResumeHero() || SealedHero() => false,
    };

WidgetStamp _stamp(TodayInputs i, DateTime at) {
  final clock = i.clock(at);
  final day = i.date(at);
  return WidgetStamp(
    at: at,
    day: isoDate(day),
    today: HomeWidgetCopy.updatedToday(clock),
    yesterday: HomeWidgetCopy.updatedYesterday(clock),
    older: HomeWidgetCopy.updatedOn(day),
  );
}

/// The hero Today shows, as the widget's one move. Whatever wins Today's hero wins the widget.
WidgetMove widgetMoveFor(TodayHero hero, TodayInputs inputs) => switch (hero) {
      MoveHero() => WidgetMove(
          overline: HomeWidgetCopy.moveOverline,
          title: hero.summary,
          // The key is short on the widget: "Start repair, about 10 minutes" becomes "Start repair".
          action: hero.primary.label.split(',').first,
          href: widgetHref(hero.primary.target),
        ),
      ResumeHero() => WidgetMove(
          overline: TodayCopy.resumeOverline,
          title: hero.title,
          action: hero.keyLabel,
          href: widgetHref(GoTo(AppRoutes.run(hero.sessionId))),
          until: inputs.draft?.sessionId == hero.sessionId ? inputs.draft!.endsAt : null,
        ),
      EndedHero() => WidgetMove(
          overline: TodayCopy.endedOverline,
          title: hero.title,
          action: hero.action.label,
          href: widgetHref(hero.action.target),
          // Today drops the notice a day after the session closed, and so does the widget (it
          // falls back to "Open MockMob"), even if the app is not opened again until then.
          until: inputs.draft?.endsAt.add(endedNoticeWindow),
        ),
      // The paper reel plays from Today (D29): the widget opens Today, where it waits once.
      SealedHero() => WidgetMove(
          overline: TodayCopy.reelTitle,
          title: hero.title,
          action: TodayCopy.reelKey,
          href: widgetHref(const GoTo(AppRoutes.today)),
        ),
    };

WidgetWeek? widgetWeekFor(WeekView week) {
  final start = week.days.isEmpty ? null : week.days.first.date;
  if (start == null || week.goal <= 0) return null;
  final state = switch (week.status) {
    WeekStatus.paused => WidgetWeekState.paused,
    WeekStatus.met || WeekStatus.extra => WidgetWeekState.met,
    WeekStatus.open => WidgetWeekState.open,
  };
  return WidgetWeek(
    done: week.studyDays,
    goal: week.goal,
    state: state,
    label: switch (state) {
      WidgetWeekState.open => HomeWidgetCopy.weekOpen,
      WidgetWeekState.met => HomeWidgetCopy.weekMet,
      WidgetWeekState.paused => HomeWidgetCopy.weekPaused,
    },
    start: isoDate(start),
  );
}

/// The https link a widget tap sends, built so `ActionRouter` opens it as a native screen.
///
/// App Links run through ActionRouter, so a practice start becomes the website's `/test?mode=`
/// link: it opens practice setup with the subject, chapter, count and first-use `purpose`
/// already chosen, one tap from starting. Native paths keep the query their screen reads and
/// ActionRouter checks (a repair's `count`), and nothing else. Anything else, and the taps
/// that only make sense inside Today (try again, alternatives), open Today.
String widgetHref(TodayTarget target) {
  const today = '$_site${AppRoutes.today}';
  if (target is! GoTo) return today;
  final uri = Uri.tryParse(target.location);
  if (uri == null) return today;
  final path = uri.path;
  final q = uri.queryParameters;

  String practice(String mode) {
    final params = <String, String>{
      'mode': mode,
      'subject': ?q['subject'],
      'chapter': ?q['chapter'],
      'count': ?q['count'],
      'purpose': ?q['purpose'],
    };
    return '$_site${Uri(path: '/test', queryParameters: params)}';
  }

  final String href;
  if (path == AppRoutes.practiceStart) {
    href = practice(q['mode'] ?? 'quick');
  } else if (path.startsWith('/practice/setup/') && uri.pathSegments.length == 3) {
    href = practice(uri.pathSegments[2]);
  } else if (AppRoutes.isNativePath(path) && !AppRoutes.isAuthPath(path) && path != AppRoutes.dashboard) {
    // The query ActionRouter keeps for this route (the repair's count), so the tap opens the
    // run the student chose, not every mistake in the chapter.
    final kept = ActionRouter.resolve('$_site$path${uri.hasQuery ? '?${uri.query}' : ''}');
    href = '$_site${kept is NativeTarget && kept.location.startsWith(path) ? kept.location : path}';
  } else {
    return today;
  }
  // Belt and braces: a link ActionRouter would not open natively falls back to Today.
  return ActionRouter.resolve(href) is NativeTarget ? href : today;
}
