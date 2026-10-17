import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/cuet_dates.dart';
import 'package:mockmob/core/domain/next_move.dart';
import 'package:mockmob/core/home_widget/home_widget_data.dart';
import 'package:mockmob/core/home_widget/home_widget_sync.dart';
import 'package:mockmob/core/router/action_router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/features/rhythm/logic/week_view.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_clock.dart' show endedNoticeWindow;
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';

import '../today/support/today_fixtures.dart';

/// 9:40 PM on Tuesday 13 October 2026 in Kolkata.
final DateTime _fetched = DateTime.utc(2026, 10, 13, 16, 10);

TodayInputs _inputs({DateTime? attemptsAt, DateTime? planAt, TodayDraft? draft}) => TodayInputs(
      now: DateTime.utc(2026, 10, 13, 16, 30),
      attempts: const [],
      attemptsFetchedAt: attemptsAt,
      planFetchedAt: planAt,
      draft: draft,
    );

MoveHero _move({TodayTarget target = const GoTo('/review/repair/m7/m7-q3?count=4'), String label = 'Start repair, about 15 minutes'}) =>
    MoveHero(
      state: NextMoveState.ready,
      mood: TodayMood.normal,
      overline: "Tonight's move",
      art: const HeroArt.object(),
      meaning: 'All 4 in Partnership fundamentals, from Mock 7 on 11 Oct.',
      primary: TodayAction(label, target),
      summary: 'Repair 4 mistakes from Mock 7',
    );

TodayView _view(TodayHero? hero) => TodayView(
      header: const HeaderModel(dateLine: 'Tuesday, 13 October', greeting: 'Good evening'),
      hero: hero,
    );

WeekView _week({int done = 2, int goal = 4, WeekStatus status = WeekStatus.open, bool dated = true}) => WeekView(
      days: [
        for (var i = 0; i < 7; i++)
          WeekDayMark(date: dated ? DateTime.utc(2026, 10, 12 + i) : null, studyDay: i < done, isToday: i == 1),
      ],
      studyDays: done,
      goal: goal,
      status: status,
      label: '$done of $goal study days',
    );

/// Where ActionRouter sends [href], or null when it would not open a native screen.
String? _native(String href) => switch (ActionRouter.resolve(href)) {
      NativeTarget(:final location) => location,
      _ => null,
    };

void main() {
  group('the move', () {
    test("tonight's move: its summary, a short key and a link straight to the repair", () {
      final m = widgetMoveFor(_move(), _inputs());
      expect(m.overline, 'Next move');
      expect(m.title, 'Repair 4 mistakes from Mock 7');
      expect(m.action, 'Start repair');
      // The count the student's chosen length holds travels with the tap.
      expect(m.href, 'https://www.mockmob.in/review/repair/m7/m7-q3?count=4');
      expect(_native(m.href), '${AppRoutes.reviewRepair('m7', 'm7-q3')}?count=4');
      expect(m.until, isNull);
    });

    test('a practice start opens practice setup with the subject, chapter and count chosen', () {
      final href = widgetHref(GoTo(Uri(path: AppRoutes.practiceStart, queryParameters: {
        'mode': 'chapter',
        'subject': 'accountancy',
        'count': '10',
        'chapter': 'Partnership fundamentals',
        'purpose': 'check',
      }).toString()));
      expect(href, startsWith('https://www.mockmob.in/test?mode=chapter'));
      final location = Uri.parse(_native(href)!);
      expect(location.path, AppRoutes.practiceSetup('chapter'));
      expect(location.queryParameters, {'subject': 'accountancy', 'chapter': 'Partnership fundamentals', 'count': '10'});
    });

    test('a first-use practice keeps its baseline purpose, and a repair keeps its count', () {
      final practice = widgetHref(GoTo(Uri(path: AppRoutes.practiceStart, queryParameters: {
        'mode': 'quick',
        'subject': 'accountancy',
        'count': '10',
        'purpose': 'baseline',
      }).toString()));
      expect(_native(practice), '${AppRoutes.practiceSetup('quick')}?subject=accountancy&count=10&purpose=baseline');

      final repair = widgetHref(const GoTo('/review/repair/m7/m7-q3?count=3&minutes=10&x=1'));
      expect(repair, 'https://www.mockmob.in/review/repair/m7/m7-q3?count=3');
      expect(_native(repair), '/review/repair/m7/m7-q3?count=3');
    });

    test('a quick practice with no mode is quick', () {
      final href = widgetHref(const GoTo('${AppRoutes.practiceStart}?subject=economics'));
      expect(_native(href), '${AppRoutes.practiceSetup('quick')}?subject=economics');
    });

    test('a full mock opens its setup for the pre-start sheet', () {
      final href = widgetHref(GoTo('${AppRoutes.practiceSetup('full')}?subject=accountancy'));
      expect(_native(href), '${AppRoutes.practiceSetup('full')}?subject=accountancy');
    });

    test('taps that only make sense inside Today, and unknown places, open Today', () {
      for (final target in const <TodayTarget>[RetryLoad(), OpenAlternatives(), GoTo('/nowhere'), GoTo('/sign-in')]) {
        final href = widgetHref(target);
        expect(href, 'https://www.mockmob.in/today', reason: '$target');
        expect(_native(href), AppRoutes.today);
      }
    });

    test('a fresh paper opens Today, where it plays back once (D29)', () {
      const hero = SealedHero(attemptId: 'a9', title: 'Mock 8, Accountancy', line: 'Your Accountancy paper, question by question.');
      final m = widgetMoveFor(hero, _inputs());
      expect(m.overline, TodayCopy.reelTitle);
      expect(m.title, 'Mock 8, Accountancy');
      expect(m.action, TodayCopy.reelKey);
      expect(_native(m.href), AppRoutes.today);
    });

    test('an open session resumes, and says when it stops being open', () {
      final ends = DateTime.utc(2026, 10, 13, 17);
      final draft = TodayDraft(
        sessionId: 's1',
        subject: 'accountancy',
        isMock: true,
        mockNumber: 8,
        total: 50,
        answered: 12,
        acknowledgedAnswered: 12,
        endsAt: ends,
        resumable: true,
      );
      const hero = ResumeHero(sessionId: 's1', title: 'Mock 8, Accountancy', answered: 12, total: 50, line: '', keyLabel: 'Resume Mock 8');
      final m = widgetMoveFor(hero, _inputs(draft: draft));
      expect(m.overline, TodayCopy.resumeOverline);
      expect(m.action, 'Resume Mock 8');
      expect(_native(m.href), AppRoutes.run('s1'));
      expect(m.until, ends);
      expect(m.toJson()['until'], ends.millisecondsSinceEpoch);
    });

    test('a mock that ended while away keeps its own key', () {
      final hero = EndedHero(
        title: 'Mock 8, Accountancy',
        line: 'Mock 8 ended at 9:00 PM.',
        action: TodayAction(TodayCopy.openResult, GoTo(AppRoutes.result('s1'))),
      );
      final m = widgetMoveFor(hero, _inputs());
      expect(m.overline, TodayCopy.endedOverline);
      expect(m.action, TodayCopy.openResult);
      expect(_native(m.href), AppRoutes.result('s1'));
    });

    test('the ended notice leaves the widget when it leaves Today, a day after the session closed', () {
      final ends = DateTime.utc(2026, 10, 13, 15, 30);
      final draft = TodayDraft(
        sessionId: 's1',
        subject: 'accountancy',
        isMock: true,
        mockNumber: 8,
        total: 50,
        answered: 12,
        acknowledgedAnswered: 12,
        endsAt: ends,
        resumable: false,
      );
      final hero = EndedHero(
        title: 'Mock 8, Accountancy',
        line: 'Mock 8 ended at 9:00 PM.',
        action: TodayAction(TodayCopy.openResult, GoTo(AppRoutes.result('s1'))),
      );
      final m = widgetMoveFor(hero, _inputs(draft: draft));
      expect(m.until, ends.add(endedNoticeWindow));
      expect(m.toJson()['until'], ends.add(const Duration(hours: 24)).millisecondsSinceEpoch);
    });
  });

  group('a failed read is not a move', () {
    test('the could-not-load card keeps the last move on the widget', () {
      final inputs = TodayInputs(now: DateTime.utc(2026, 10, 13, 16, 30), attemptsFailed: true, planFetchedAt: _fetched);
      final view = buildToday(inputs);
      final hero = view.hero! as MoveHero;
      expect(hero.state, NextMoveState.historyUnavailable);
      expect(homeWidgetFromToday(view: view, inputs: inputs), isNull);
    });

    test('a move whose only tap is to try the read again is not written', () {
      expect(homeWidgetFromToday(view: _view(_move(target: const RetryLoad())), inputs: _inputs(planAt: _fetched)), isNull);
    });

    test('an ended notice that only offers to check again is not written', () {
      const hero = EndedHero(title: 'Mock 8, Accountancy', line: 'Mock 8 ended at 9:00 PM.', action: TodayAction('Try again', RetryLoad()));
      expect(homeWidgetFromToday(view: _view(hero), inputs: _inputs(planAt: _fetched)), isNull);
    });

    test('a real move is still written', () {
      expect(homeWidgetFromToday(view: _view(_move()), inputs: _inputs(planAt: _fetched)), isNotNull);
    });
  });

  group('the week ring', () {
    test('an open week: days done of the goal, from its Monday', () {
      final w = widgetWeekFor(_week())!;
      expect((w.done, w.goal, w.state, w.label, w.start), (2, 4, WidgetWeekState.open, 'study days', '2026-10-12'));
    });

    test('a met week, extra days included, says goal met', () {
      expect(widgetWeekFor(_week(done: 4, status: WeekStatus.met))!.label, 'Goal met');
      final extra = widgetWeekFor(_week(done: 5, status: WeekStatus.extra))!;
      expect((extra.state, extra.done), (WidgetWeekState.met, 5));
    });

    test('a paused week says paused', () {
      final w = widgetWeekFor(_week(done: 0, status: WeekStatus.paused))!;
      expect((w.state, w.label), (WidgetWeekState.paused, 'Paused'));
    });

    test('no ring without the week dates', () {
      expect(widgetWeekFor(_week(dated: false)), isNull);
    });
  });

  group('the whole widget', () {
    test('nothing is written while Today is still loading', () {
      expect(homeWidgetFromToday(view: _view(null), inputs: _inputs(attemptsAt: _fetched)), isNull);
    });

    test('nothing is written before the server has confirmed anything', () {
      expect(homeWidgetFromToday(view: _view(_move()), inputs: _inputs()), isNull);
    });

    test('stamped with the older read, in 12-hour time, for each age it may be read at', () {
      final data = homeWidgetFromToday(
        view: _view(_move()),
        inputs: _inputs(attemptsAt: _fetched, planAt: _fetched.add(const Duration(hours: 2))),
        week: _week(),
      )!;
      final stamp = data.updated!;
      expect(stamp.at, _fetched);
      expect(stamp.day, '2026-10-13');
      expect(stamp.today, 'Updated 9:40 PM');
      expect(stamp.yesterday, 'Updated yesterday, 9:40 PM');
      expect(stamp.older, 'Updated 13 Oct');
    });

    test('attempts served from the phone days after they were read are not stamped as fresh', () {
      final cached = _fetched.subtract(const Duration(days: 3));
      final data = homeWidgetFromToday(view: _view(_move()), inputs: _inputs(attemptsAt: cached, planAt: _fetched))!;
      expect(data.updated!.at, cached);
      expect(data.updated!.older, 'Updated 10 Oct');
    });

    test('with one read confirmed, that read is the stamp', () {
      expect(homeWidgetFromToday(view: _view(_move()), inputs: _inputs(planAt: _fetched))!.updated!.at, _fetched);
      expect(homeWidgetFromToday(view: _view(_move()), inputs: _inputs(attemptsAt: _fetched))!.updated!.at, _fetched);
    });

    test('the JSON the Android widget reads', () {
      final json = jsonDecode(homeWidgetFromToday(view: _view(_move()), inputs: _inputs(attemptsAt: _fetched), week: _week())!.encode());
      expect(json, {
        'v': homeWidgetDataVersion,
        'signedIn': true,
        'tz': 'Asia/Kolkata',
        'cuet': {'start': '2027-05-01', 'end': '2027-05-31'},
        'move': {
          'overline': 'Next move',
          'title': 'Repair 4 mistakes from Mock 7',
          'action': 'Start repair',
          'href': 'https://www.mockmob.in/review/repair/m7/m7-q3?count=4',
        },
        'week': {'done': 2, 'goal': 4, 'state': 'open', 'label': 'study days', 'start': '2026-10-12'},
        'updated': {
          'at': _fetched.millisecondsSinceEpoch,
          'day': '2026-10-13',
          'today': 'Updated 9:40 PM',
          'yesterday': 'Updated yesterday, 9:40 PM',
          'older': 'Updated 13 Oct',
        },
      });
    });

    test('the Kotlin widget falls back to the same CUET window as cuet_dates.dart', () {
      final kotlin = File('android/app/src/main/kotlin/in/mockmob/app/platform/TodayWidgetProvider.kt').readAsStringSync();
      String constant(String name) =>
          RegExp('const val $name = "' r'(\d{4}-\d{2}-\d{2})' '"').firstMatch(kotlin)!.group(1)!;
      expect(constant('CUET_START'), isoDate(CuetDates.windowStart));
      expect(constant('CUET_END'), isoDate(CuetDates.windowEnd));
    });

    test('the 2x2 stamp is measured by how it really wraps, and the 4x2 never cuts it', () {
      final kotlin = File('android/app/src/main/kotlin/in/mockmob/app/platform/TodayWidgetProvider.kt').readAsStringSync();
      expect(kotlin, contains('linesNeeded(context, updated, 11f, inner, medium = false)'));
      expect(kotlin, contains('lines <= 2 && middleDp - needed >= titleLine'));
      expect(kotlin, isNot(contains('textWidthDp(context, updated, 11f) <= inner')), reason: 'a one-line test lets a three-line stamp through');
      // The wide stamp is measured against its row, and the overline gives way before it.
      expect(kotlin, contains('showUpdated = updated != null && stampWidth <= innerWidth - leading'));
      expect(kotlin, contains('visibleIf(showUpdated)'));
      expect(kotlin, contains('visibleIf(showOverline)'));
    });

    test('the countdown says the exam date is expected, as Today does', () {
      final strings = File('android/app/src/main/res/values/widget_strings.xml').readAsStringSync();
      final items = RegExp(r'<item quantity="(?:one|other)">([^<]+)</item>').allMatches(strings).map((m) => m.group(1)!).toList();
      expect(items, ['day to expected CUET', 'days to expected CUET']);
      expect(strings, contains('translatable="false">days to expected CUET</string>'), reason: 'the picker preview too');
      expect(strings, isNot(matches(RegExp(r'(?<!expected )CUET</'))), reason: 'no bare "to CUET" countdown');
      // Today's own copy, which the widget agrees with.
      expect(TodayCopy.daysToWindowLabel(199), contains('expected'));
    });

    test('the 2x2 layout carries the compact start key, and the 4x2 centres its move', () {
      const res = 'android/app/src/main/res/layout';
      final small = File('$res/widget_today_small.xml').readAsStringSync();
      final wide = File('$res/widget_today_wide.xml').readAsStringSync();
      expect(small, contains('@+id/widget_action'));
      // No empty weighted spacer between the top row and the title: the move fills that band.
      expect(small, isNot(matches(RegExp(r'<FrameLayout\s+android:layout_width="match_parent"\s+android:layout_height="0dp"'))));
      // The 4x2's middle row centres the title and the ring in the space the key and header leave.
      expect(wide, matches(RegExp(r'android:gravity="center_vertical"\s+android:orientation="horizontal">\s+<TextView\s+android:id="@\+id/widget_title"')));
    });

    test('rhythm turned off: no ring', () {
      final data = homeWidgetFromToday(view: _view(_move()), inputs: _inputs(attemptsAt: _fetched));
      expect(data!.toJson().containsKey('week'), isFalse);
    });

    test('signed out: the plain state with nothing personal', () {
      final json = const HomeWidgetData.signedOut(timezone: 'Asia/Kolkata').toJson();
      expect(json.keys, unorderedEquals(['v', 'signedIn', 'tz', 'cuet']));
      expect(json['signedIn'], isFalse);
    });

    test("built from Today's real builder, the widget shows Today's hero", () {
      final inputs = ashaInputs();
      final view = buildToday(inputs);
      final hero = view.hero! as MoveHero;
      final data = homeWidgetFromToday(view: view, inputs: inputs)!;
      expect(data.move!.title, hero.summary);
      expect(data.move!.action, isNot(contains(',')));
      expect(_native(data.move!.href), isNotNull);
      expect(data.updated!.today, 'Updated 7:30 PM');
    });
  });

  group('sync', () {
    late _FakeWriter writer;
    late ProviderContainer container;

    setUp(() {
      writer = _FakeWriter();
      container = ProviderContainer(overrides: [
        homeWidgetWriterProvider.overrideWithValue(writer),
        homeWidgetSettleProvider.overrideWithValue(Duration.zero),
        homeWidgetRetryProvider.overrideWithValue(const Duration(milliseconds: 4)),
        homeWidgetDataProvider.overrideWith((ref) => ref.watch(_data)),
      ]);
      addTearDown(container.dispose);
      // Listened, as app.dart watches it (Riverpod pauses a provider nobody listens to).
      container.listen(homeWidgetSyncProvider, (_, _) {});
    });

    Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 5));

    test('writes what settles, once, and keeps the last state while Today is not settled', () async {
      const signedOut = HomeWidgetData.signedOut(timezone: 'Asia/Kolkata');
      container.read(_data.notifier).set(signedOut);
      await settle();
      expect(writer.writes, [signedOut.encode()]);

      container.read(_data.notifier).set(const HomeWidgetData.signedOut(timezone: 'Asia/Kolkata'));
      container.read(_data.notifier).set(null);
      await settle();
      expect(writer.writes, hasLength(1));

      final signedIn = homeWidgetFromToday(view: _view(_move()), inputs: _inputs(attemptsAt: _fetched))!;
      container.read(_data.notifier).set(signedIn);
      await settle();
      expect(writer.writes, [signedOut.encode(), signedIn.encode()]);
    });

    test('signing out is written at once, with no settle delay', () async {
      final slow = ProviderContainer(overrides: [
        homeWidgetWriterProvider.overrideWithValue(writer),
        homeWidgetSettleProvider.overrideWithValue(const Duration(hours: 1)),
        homeWidgetDataProvider.overrideWith((ref) => ref.watch(_data)),
      ]);
      addTearDown(slow.dispose);
      slow.listen(homeWidgetSyncProvider, (_, _) {});

      final signedIn = homeWidgetFromToday(view: _view(_move()), inputs: _inputs(attemptsAt: _fetched))!;
      slow.read(_data.notifier).set(signedIn);
      await settle();
      expect(writer.writes, isEmpty, reason: 'signed-in changes still wait to settle');

      const signedOut = HomeWidgetData.signedOut(timezone: 'Asia/Kolkata');
      slow.read(_data.notifier).set(signedOut);
      // Written as soon as the change reaches the sync, not after the hour-long settle.
      await pumpEventQueue();
      expect(writer.writes, [signedOut.encode()]);
      await settle();
      expect(writer.writes, [signedOut.encode()], reason: 'the pending signed-in write was dropped');
    });

    test('a failed write is tried again, and the sign-out write is not dropped as a duplicate', () async {
      writer.failures = 2;
      const signedOut = HomeWidgetData.signedOut(timezone: 'Asia/Kolkata');
      container.read(_data.notifier).set(signedOut);
      // The retry waits 4 ms, then 8 ms.
      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(writer.attempts, [signedOut.encode(), signedOut.encode(), signedOut.encode()]);
      expect(writer.writes, [signedOut.encode()], reason: 'only the third write reached the widget');

      // Once it landed, the same data is a duplicate again.
      container.read(_data.notifier).set(const HomeWidgetData.signedOut(timezone: 'Asia/Kolkata'));
      await Future<void>.delayed(const Duration(milliseconds: 30));
      expect(writer.attempts, hasLength(3));
    });

    test('a signed-in write that failed is tried again too', () async {
      final signedIn = homeWidgetFromToday(view: _view(_move()), inputs: _inputs(attemptsAt: _fetched))!;
      writer.failures = 1;
      container.read(_data.notifier).set(signedIn);
      await Future<void>.delayed(const Duration(milliseconds: 60));
      expect(writer.writes, [signedIn.encode()]);
      expect(writer.attempts, hasLength(2));
    });

    test('newer data replaces a failed write instead of retrying the old one', () async {
      final first = homeWidgetFromToday(view: _view(_move()), inputs: _inputs(attemptsAt: _fetched))!;
      final second = homeWidgetFromToday(view: _view(_move(label: 'Start practice')), inputs: _inputs(attemptsAt: _fetched))!;
      writer.failures = 1;
      container.read(_data.notifier).set(first);
      await pumpEventQueue();
      container.read(_data.notifier).set(second);
      await Future<void>.delayed(const Duration(milliseconds: 60));
      expect(writer.writes, [second.encode()]);
    });

    test('a burst of changes is one write of the last one', () async {
      final first = homeWidgetFromToday(view: _view(_move()), inputs: _inputs(attemptsAt: _fetched))!;
      final last = homeWidgetFromToday(view: _view(_move(label: 'Start practice')), inputs: _inputs(attemptsAt: _fetched))!;
      container.read(_data.notifier).set(first);
      container.read(_data.notifier).set(last);
      await settle();
      expect(writer.writes, [last.encode()]);
    });
  });
}

class _FakeWriter implements HomeWidgetWriter {
  /// What reached the widget.
  final writes = <String>[];

  /// Every attempt, failed ones too.
  final attempts = <String>[];

  /// How many of the next writes fail.
  int failures = 0;

  @override
  bool get available => true;

  @override
  Future<bool> write(String json) async {
    attempts.add(json);
    if (failures > 0) {
      failures--;
      return false;
    }
    writes.add(json);
    return true;
  }
}

class _DataNotifier extends Notifier<HomeWidgetData?> {
  @override
  HomeWidgetData? build() => null;

  void set(HomeWidgetData? data) => state = data;
}

final _data = NotifierProvider<_DataNotifier, HomeWidgetData?>(_DataNotifier.new);
