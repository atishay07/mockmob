// L01 (owner 15 and 16 Oct: "Could not reach MockMob" over a record printed under it): a partial
// failure is never an error card. Only no attempts at all (no live read, no cache) gives the
// failure card, and that card names its cause, says when it last tried, and on a failed refresh
// with papers in hand the header says "Could not refresh" instead.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/load_problem.dart';
import 'package:mockmob/core/domain/next_move.dart';
import 'package:mockmob/core/models/learning_plan.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/move_builder.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';

import 'support/today_fixtures.dart';

void main() {
  final at = tuesdayEvening;

  TodayInputs withPlan(LearningPlan? plan, {bool attemptsStale = false, DateTime? lastTried}) => TodayInputs(
        now: at,
        firstName: 'Asha',
        subjects: const ['accountancy', 'business_studies', 'economics', 'english'],
        attempts: ashaRecord(at),
        attemptsFetchedAt: at.subtract(const Duration(minutes: 70)),
        attemptsStale: attemptsStale,
        plan: plan,
        week: tuesdayWeek,
        profile: ashaProfile,
        lastTriedAt: lastTried,
      );

  group('papers in hand', () {
    test('a plan that says the record is unavailable still gives a move built from the papers', () {
      final plan = LearningPlan.fromJson({'primary': {'kind': 'ordinary_practice', 'title': 'Practise'}, 'minutes': 10, 'recordState': 'unavailable'});
      expect(plan.recordUnavailable, isTrue);
      final hero = buildMove(withPlan(plan));
      expect(hero.state, isNot(NextMoveState.historyUnavailable));
      expect(hero.primary.target, isNot(isA<RetryLoad>()));
      expect(hero.subjectLine, isNot(TodayCopy.failTitle));
    });

    test('a plan read that failed outright (no plan) still gives a move', () {
      final hero = buildMove(withPlan(null));
      expect(hero.state, isNot(NextMoveState.historyUnavailable));
      expect(hero.primary.target, isNot(isA<RetryLoad>()));
    });

    test('a refresh that failed online keeps the move and says so in the header, with the last try', () {
      final view = buildToday(withPlan(readyPlan(), attemptsStale: true));
      expect(view.hero, isA<MoveHero>());
      expect((view.hero! as MoveHero).state, isNot(NextMoveState.historyUnavailable));
      expect(view.header.refreshable, isTrue);
      expect(view.header.updatedLine, startsWith('Could not refresh. Last loaded '));
      final tried = buildToday(withPlan(readyPlan(), attemptsStale: true, lastTried: at.add(const Duration(minutes: 2))));
      expect(tried.header.updatedLine, contains('Still not loading'));
    });

    test('offline with the cache, the header says offline and is not a retry line', () {
      final view = buildToday(ashaInputs(offline: true));
      expect(view.header.refreshable, isFalse);
      expect(view.header.updatedLine, startsWith('Offline. Last loaded '));
    });
  });

  group('nothing in hand', () {
    MoveHero card({LoadProblem? problem, bool offline = false, DateTime? tried}) => buildMove(
          TodayInputs(now: at, firstName: 'Asha', attemptsFailed: true, readProblem: problem, offline: offline, lastTriedAt: tried),
        );

    test('the card is the failure card, named, with Try again and Practise anyway', () {
      final hero = card(problem: LoadProblem.busy);
      expect(hero.state, NextMoveState.historyUnavailable);
      expect(hero.subjectLine, TodayCopy.failTitle);
      expect(hero.meaning, startsWith(LoadProblem.busy.sentence));
      expect(hero.primary.label, TodayCopy.tryAgain);
      expect(hero.primary.target, isA<RetryLoad>());
      expect(hero.secondary?.label, TodayCopy.practiseAnyway);
      expect(hero.basisLine, isNull);
    });

    test('offline, the card says so, watches for the connection and offers no practice', () {
      final hero = card(problem: LoadProblem.offline, offline: true);
      expect(hero.subjectLine, TodayCopy.failOfflineTitle);
      expect(hero.meaning, TodayCopy.unavailableOffline);
      expect(hero.basisLine, TodayCopy.failOfflineWatch);
      expect(hero.secondary, isNull);
    });

    test('each Try again that changed nothing says its own time, so a repeated tap visibly ran', () {
      final first = card(problem: LoadProblem.slow, tried: DateTime.utc(2026, 10, 13, 17, 11));
      final second = card(problem: LoadProblem.slow, tried: DateTime.utc(2026, 10, 13, 17, 12));
      expect(first.basisLine, startsWith('Tried again at '));
      expect(first.basisLine, endsWith('Still not loading.'));
      expect(first.basisLine, isNot(second.basisLine));
    });

    test('no failure card has a mood bubble: the title says it', () {
      expect(card(problem: LoadProblem.busy).mobiLine, isNull);
    });
  });
}
