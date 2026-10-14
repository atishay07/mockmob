// Fixes from the You bug hunt: the study-week editor follows the server goal and fits a 360 dp
// phone, an ended pause is neither shown nor sent, the deletion receipt survives a fast phone
// clock, sign out warns when the phone cannot be read and opens one sheet, and the course undo
// goes once a later edit would be overwritten by it.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_client.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/models/rhythm.dart' show Goal;
import 'package:mockmob/core/repositories/notification_prefs_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/data/du_catalog.dart';
import 'package:mockmob/features/onboarding/model/choices.dart' show StudyTime;
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/you/account/account_screen.dart';
import 'package:mockmob/features/you/account/delete_screen.dart';
import 'package:mockmob/features/you/copy.dart';
import 'package:mockmob/features/you/data/goal_pause.dart';
import 'package:mockmob/features/you/data/profile_editor.dart';
import 'package:mockmob/features/you/data/sheet_editor.dart';
import 'package:mockmob/features/you/data/student_target.dart';
import 'package:mockmob/features/you/data/study_length.dart';
import 'package:mockmob/features/you/edit_copy.dart';
import 'package:mockmob/features/you/goal/goal_screen.dart';
import 'package:mockmob/features/you/sheet/sheet_editor_screen.dart';
import 'package:mockmob/features/you/sheet/week_editor.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

/// Accepts the reminder time without a network.
class _FakePrefs extends NotificationPrefsRepository {
  int updates = 0;

  @override
  RemoteState<NotificationPrefs> build() => RemoteState(value: NotificationPrefs.defaults, fetchedAt: DateTime(2026, 10, 12));

  @override
  Future<NotificationPrefs> update({
    String? timezone,
    ClockTime? quietStart,
    ClockTime? quietEnd,
    int? weeklyCap,
    Map<String, bool>? channels,
    StudyWindow? studyWindow,
    bool clearStudyWindow = false,
  }) async {
    updates++;
    return NotificationPrefs.defaults;
  }
}

class _FakeLength extends StudyLength {
  _FakeLength(super.ref);

  @override
  Future<LengthSync> save(int minutes) async => LengthSync.saved;
}

List<Override> _weekOverrides(FakeGoal goal, {StudentTarget? target}) => [
      ...youOverrides(goal: goal, target: target),
      notificationPrefsRepositoryProvider.overrideWith(_FakePrefs.new),
      studyLengthProvider.overrideWith(_FakeLength.new),
    ];

/// Setup answered four days, in the evening, 20 minutes a day.
const _phoneWeek = StudentWeek(days: {0, 1, 3, 5}, window: StudyTime.evening, minutes: 20);
const _phoneTarget = StudentTarget(week: _phoneWeek);

Future<void> _pumpWeek(WidgetTester tester, FakeGoal goal, {StudentTarget target = _phoneTarget, double textScale = 1}) async {
  await pumpMockmob(
    tester,
    const SingleChildScrollView(child: WeekEditor()),
    size: const Size(360, 900),
    textScale: textScale,
    disableAnimations: true,
    overrides: _weekOverrides(goal, target: target),
  );
  await tester.pump();
}

Finder _studyDays() => find.bySemanticsLabel(RegExp(r', study day$'));

void main() {
  group('study days for a goal count (you-02)', () {
    test('keeps the days the student chose and trims from the end of the week', () {
      expect(daysForCount({0, 1, 3, 5}, 2), {0, 1});
      expect(daysForCount({0, 1, 3, 5}, 4), {0, 1, 3, 5});
    });

    test('adds days from Monday on when the goal is higher', () {
      expect(daysForCount({1, 3}, 4), {0, 1, 2, 3});
      expect(daysForCount({0, 1, 3, 5}, 7), {0, 1, 2, 3, 4, 5, 6});
    });

    test('never returns fewer than one day or more than seven', () {
      expect(daysForCount({2}, 0), {2});
      expect(daysForCount({2}, 9), {0, 1, 2, 3, 4, 5, 6});
    });
  });

  group('an ended pause (you-05)', () {
    final now = DateTime(2026, 10, 14, 9);

    test('a pause before today is over; today and later still run', () {
      expect(activePauseEnd('2026-10-03', now), isNull);
      expect(activePauseEnd('2026-10-13', now), isNull);
      expect(activePauseEnd('2026-10-14', now), DateTime(2026, 10, 14));
      expect(activePauseEnd('2026-10-26', now), DateTime(2026, 10, 26));
      expect(activePauseEnd(null, now), isNull);
    });

    test('a save sends a running pause, drops an ended one and keeps what it cannot read', () {
      expect(pauseToKeep('2026-10-26', now), '2026-10-26');
      expect(pauseToKeep('2026-10-03', now), isNull);
      expect(pauseToKeep(null, now), isNull);
      expect(pauseToKeep('later', now), 'later');
    });

    testWidgets('the goal screen does not say paused for a pause that ended, and does not send it back', (tester) async {
      final goal = FakeGoal(goalState(4, pausedUntil: '2026-10-03'));
      await pumpMockmob(tester, const GoalScreen(), wrapInScaffold: false, disableAnimations: true, overrides: youOverrides(goal: goal));
      expect(find.textContaining('paused until'), findsNothing);
      await tester.tap(find.bySemanticsLabel(RegExp('^5 days a week')));
      await tester.pump();
      await tester.tap(find.text('Save goal'));
      await tester.pump();
      await tester.pump();
      expect(goal.saves, [(5, null)]);
    });

    testWidgets('a pause that still runs is kept by the goal screen', (tester) async {
      final goal = FakeGoal(goalState(4, pausedUntil: '2026-10-26'));
      await pumpMockmob(tester, const GoalScreen(), wrapInScaffold: false, disableAnimations: true, overrides: youOverrides(goal: goal));
      await tester.tap(find.bySemanticsLabel(RegExp('^5 days a week')));
      await tester.pump();
      await tester.tap(find.text('Save goal'));
      await tester.pump();
      await tester.pump();
      expect(goal.saves, [(5, '2026-10-26')]);
    });

    test('saving the week drops an ended pause too', () async {
      final goal = FakeGoal(goalState(4, pausedUntil: '2026-10-03'));
      final container = ProviderContainer(overrides: _weekOverrides(goal));
      addTearDown(container.dispose);
      await container.read(profileEditorProvider).saveWeek(days: {0, 1, 2, 3, 4}, window: StudyTime.evening, minutes: 20);
      expect(goal.saves, [(5, null)]);
    });
  });

  group('saving the week against the server goal (you-02)', () {
    test('a week saved without touching the days never changes the goal', () async {
      final goal = FakeGoal(goalState(6));
      final container = ProviderContainer(overrides: _weekOverrides(goal));
      addTearDown(container.dispose);
      final kept = await container
          .read(profileEditorProvider)
          .saveWeek(days: {0, 1, 3, 5}, window: StudyTime.late, minutes: 30, daysEdited: false);
      expect(goal.saves, isEmpty, reason: 'the stale phone copy said 4 days, the server has 6');
      expect(kept.length, 6);
      expect(kept.containsAll({0, 1, 3, 5}), isTrue);
    });

    test('days the student changed are sent', () async {
      final goal = FakeGoal(goalState(6));
      final container = ProviderContainer(overrides: _weekOverrides(goal));
      addTearDown(container.dispose);
      await container.read(profileEditorProvider).saveWeek(days: {0, 1, 3}, window: StudyTime.evening, minutes: 20);
      expect(goal.saves, [(3, null)]);
    });

    testWidgets('the editor shows the server goal, not the stale phone days', (tester) async {
      await _pumpWeek(tester, FakeGoal(goalState(6)));
      expect(_studyDays(), findsNWidgets(6));
      expect(tester.widget<KeyButton>(find.byType(KeyButton)).onPressed, isNull, reason: 'nothing changed yet');
    });

    testWidgets('changing only the time leaves the 6 day goal alone', (tester) async {
      final goal = FakeGoal(goalState(6));
      await _pumpWeek(tester, goal);
      await tester.tap(find.text('Late, 10:00 PM'));
      await tester.pump();
      await tester.tap(find.text(EditCopy.weekSave));
      await tester.pump();
      await tester.pump();
      expect(goal.saves, isEmpty);
      expect(find.textContaining('Goal: 6 days a week'), findsOneWidget);
    });

    testWidgets('the editor follows the goal when it loads after the screen opened', (tester) async {
      final goal = FakeGoal(const RemoteState<Goal>());
      await _pumpWeek(tester, goal);
      expect(_studyDays(), findsNWidgets(4));
      goal.push(goalState(2));
      await tester.pump();
      expect(_studyDays(), findsNWidgets(2));
    });
  });

  group('the study-day picker fits a 360 dp phone (you-01, you-09)', () {
    for (final scale in [1.0, 1.3]) {
      testWidgets('seven targets of at least 48 dp at ${scale}x text, no overflow', (tester) async {
        await _pumpWeek(tester, FakeGoal(goalState(4)), textScale: scale);
        expect(tester.takeException(), isNull);
        for (final name in weekdayLabels) {
          final target = find.bySemanticsLabel(RegExp('^$name, '));
          expect(target, findsOneWidget, reason: name);
          final size = tester.getSize(target);
          expect(size.width, greaterThanOrEqualTo(48), reason: '$name is ${size.width} dp wide');
          expect(size.height, greaterThanOrEqualTo(48));
        }
        // Sunday sits fully inside the screen.
        expect(tester.getTopRight(find.bySemanticsLabel(RegExp('^Sunday, '))).dx, lessThanOrEqualTo(360));
      });

      testWidgets('the goal picker has seven targets of at least 48 dp at ${scale}x text', (tester) async {
        await pumpMockmob(
          tester,
          const GoalScreen(),
          wrapInScaffold: false,
          disableAnimations: true,
          size: const Size(360, 800),
          textScale: scale,
          overrides: youOverrides(goal: FakeGoal(goalState(3))),
        );
        expect(tester.takeException(), isNull);
        for (var n = 1; n <= 7; n++) {
          final size = tester.getSize(find.bySemanticsLabel(RegExp('^$n days? a week')));
          expect(size.width, greaterThanOrEqualTo(48), reason: 'day $n is ${size.width} dp wide');
          expect(size.height, greaterThanOrEqualTo(48));
        }
      });
    }
  });

  group('deletion receipt (you-06)', () {
    Future<void> request(WidgetTester tester, Map<String, Object?> body) async {
      final api = MockApi();
      when(() => api.post('/api/me/delete', body: any(named: 'body'))).thenAnswer((_) async => ApiResponse(200, body));
      await pumpMockmob(
        tester,
        const DeleteScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        size: const Size(360, 1500),
        overrides: youOverrides(api: api, drafts: draftsWithUnsent(0)),
      );
      await tester.pump();
      await tester.enterText(find.byType(TextField), 'DELETE');
      await tester.pump();
      await tester.tap(find.text('Request deletion'));
      await tester.pump();
      await tester.pump();
    }

    // The test clock reads 12 October, 10:39:30 PM.
    testWidgets('a first request on a phone running 19 minutes fast is not called a repeat', (tester) async {
      await request(tester, {'status': 'pending', 'requestedAt': DateTime(2026, 10, 12, 22, 20).toUtc().toIso8601String()});
      expect(find.text(YouCopy.deleteRecordedHeadline), findsOneWidget);
      expect(find.text(YouCopy.deleteAlready), findsNothing);
      expect(find.text('Request recorded at 10:20 PM.'), findsOneWidget);
    });

    testWidgets('a request from days ago is still a repeat', (tester) async {
      await request(tester, {'status': 'pending', 'requestedAt': DateTime(2026, 10, 9, 20).toUtc().toIso8601String()});
      expect(find.text(YouCopy.deleteAlready), findsOneWidget);
      expect(find.textContaining('Requested on'), findsOneWidget);
    });

    testWidgets('the server saying so decides', (tester) async {
      await request(tester, {
        'status': 'pending',
        'alreadyRequested': true,
        'requestedAt': DateTime(2026, 10, 12, 22, 30).toUtc().toIso8601String(),
      });
      expect(find.text(YouCopy.deleteAlready), findsOneWidget);
    });
  });

  group('sign out (you-07)', () {
    MockDrafts unreadable() {
      final drafts = MockDrafts();
      when(drafts.unsentAnswerCount).thenThrow(StateError('database not ready'));
      return drafts;
    }

    Future<FakeAuth> pump(WidgetTester tester, MockDrafts drafts) async {
      final auth = FakeAuth(userWith());
      await pumpMockmob(
        tester,
        const AccountScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        size: const Size(360, 1700),
        overrides: youOverrides(fakeAuth: auth, drafts: drafts),
      );
      return auth;
    }

    testWidgets('a failed read of the phone warns instead of saying nothing is waiting', (tester) async {
      final auth = await pump(tester, unreadable());
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      expect(find.text(YouCopy.signOutUnknown), findsOneWidget);
      expect(find.text(YouCopy.signOutPlain), findsNothing);
      expect(find.text('Stay signed in'), findsOneWidget);
      await tester.tap(find.text('Stay signed in'));
      await tester.pumpAndSettle();
      expect(auth.signOutCalls, 0);

      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sign out anyway'));
      await tester.pumpAndSettle();
      expect(auth.signOutCalls, 1);
    });

    testWidgets('a second tap while the phone is read does not open a second sheet', (tester) async {
      await pump(tester, draftsWithUnsent(0));
      final key = find.text('Sign out');
      await tester.tap(key);
      await tester.tap(key, warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(find.text(YouCopy.signOutTitle), findsOneWidget);
      await tester.tap(find.text('Stay signed in'));
      await tester.pumpAndSettle();
      expect(find.text(YouCopy.signOutTitle), findsNothing, reason: 'one sheet was open, not two');
    });

    testWidgets('the key works again after Staying', (tester) async {
      final auth = await pump(tester, draftsWithUnsent(0));
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Stay signed in'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sign out'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sign out').last);
      await tester.pumpAndSettle();
      expect(auth.signOutCalls, 1);
    });
  });

  group('course undo (you-08)', () {
    testWidgets('a later college pick takes the undo away instead of being overwritten by it', (tester) async {
      final first = DuCatalog.courses.first;
      final second = DuCatalog.courses[1];
      await pumpMockmob(
        tester,
        const SheetEditorScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        size: const Size(384, 1400),
        overrides: youOverrides(target: StudentTarget(courseId: first.id, course: first.short)),
      );
      final container = ProviderScope.containerOf(tester.element(find.byType(SheetEditorScreen)));
      await container.read(onboardingAnswersProvider.future);
      container
          .read(onboardingAnswersProvider.notifier)
          .edit((a) => a.copyWith(courseId: first.id, colleges: [first.offerings[0].college, first.offerings[1].college]));
      await tester.pump();

      await tester.tap(find.text(EditCopy.rowCourse));
      await tester.pumpAndSettle();
      await tester.tap(find.text(second.short));
      await tester.pumpAndSettle();
      await tester.tap(find.text(EditCopy.courseChange));
      await tester.pumpAndSettle();
      expect(find.text(EditCopy.courseUndo), findsOneWidget, reason: 'the undo is offered after the change');

      // The student picks colleges for the new course.
      container.read(sheetEditorProvider).toggleCollege(second.offerings[0].college);
      await tester.pumpAndSettle();
      expect(find.text(EditCopy.courseUndo), findsNothing);
      expect(container.read(onboardingAnswersProvider).value?.colleges, [second.offerings[0].college]);
    });

    testWidgets('an undo nobody overwrote still restores the course and colleges', (tester) async {
      final first = DuCatalog.courses.first;
      final second = DuCatalog.courses[1];
      final colleges = [first.offerings[0].college, first.offerings[1].college];
      await pumpMockmob(
        tester,
        const SheetEditorScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        size: const Size(384, 1400),
        overrides: youOverrides(target: StudentTarget(courseId: first.id, course: first.short)),
      );
      final container = ProviderScope.containerOf(tester.element(find.byType(SheetEditorScreen)));
      await container.read(onboardingAnswersProvider.future);
      container.read(onboardingAnswersProvider.notifier).edit((a) => a.copyWith(courseId: first.id, colleges: colleges));
      await tester.pump();

      await tester.tap(find.text(EditCopy.rowCourse));
      await tester.pumpAndSettle();
      await tester.tap(find.text(second.short));
      await tester.pumpAndSettle();
      await tester.tap(find.text(EditCopy.courseChange));
      await tester.pumpAndSettle();
      await tester.tap(find.text(EditCopy.courseUndo));
      await tester.pumpAndSettle();
      final answers = container.read(onboardingAnswersProvider).value!;
      expect(answers.courseId, first.id);
      expect(answers.colleges, colleges);
      expect(find.text(EditCopy.courseRestored), findsOneWidget);
    });
  });
}

/// Monday to Sunday as the picker names them.
const weekdayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
