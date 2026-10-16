import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/my_colleges.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';
import 'package:mockmob/features/onboarding/state/colleges_move.dart';
import 'package:mockmob/features/tools/data/my_colleges_actions.dart';

const _picks = ['Shri Ram College of Commerce', 'Hindu College', 'Hansraj College'];

MyCollege _entry(String college, {String programme = 'b-com-hons'}) => MyCollege(programmeId: programme, college: college, programme: 'B.Com. (Hons.)');

Future<CollegesMove> _move(
  MyCollegesView view, {
  List<String> colleges = _picks,
  String? course = 'b-com-hons',
}) async {
  final memory = MemoryPrefsStore();
  memory.values[AnswersStore.key] = jsonEncode(OnboardingAnswers(courseId: course, colleges: colleges).toJson());
  final c = ProviderContainer(overrides: [
    answersStoreProvider.overrideWithValue(AnswersStore(memory)),
    myCollegesProvider.overrideWithValue(view),
  ]);
  addTearDown(c.dispose);
  await c.read(onboardingAnswersProvider.future);
  return c.read(collegesMoveProvider);
}

void main() {
  group('the picked colleges are called saved only when the server list has them', () {
    test('a sheet without colleges has nothing to move', () async {
      expect(await _move(const MyCollegesView(status: MyCollegesStatus.ready), colleges: const []), CollegesMove.none);
      expect(await _move(const MyCollegesView(status: MyCollegesStatus.ready), course: null), CollegesMove.none);
    });

    test('while the list loads, or before the move has run, nothing is claimed', () async {
      expect(await _move(const MyCollegesView(status: MyCollegesStatus.loading)), CollegesMove.pending);
      expect(await _move(const MyCollegesView(status: MyCollegesStatus.signedOut)), CollegesMove.pending);
      expect(await _move(const MyCollegesView(status: MyCollegesStatus.ready)), CollegesMove.pending, reason: 'read, but empty: the move has not run yet');
    });

    test('a partial list is still pending, not saved', () async {
      final view = MyCollegesView(status: MyCollegesStatus.ready, list: MyColleges(colleges: [_entry(_picks[0]), _entry(_picks[1])]));
      expect(await _move(view), CollegesMove.pending);
    });

    test('all three on the server list is moved', () async {
      final view = MyCollegesView(status: MyCollegesStatus.ready, list: MyColleges(colleges: [for (final p in _picks) _entry(p)]));
      expect(await _move(view), CollegesMove.moved);
    });

    test('more colleges than the three picked on the list is still moved', () async {
      final view = MyCollegesView(
        status: MyCollegesStatus.ready,
        list: MyColleges(colleges: [for (final p in _picks) _entry(p), _entry('Ramjas College')]),
      );
      expect(await _move(view), CollegesMove.moved);
    });

    test('a college in another programme does not count', () async {
      final view = MyCollegesView(
        status: MyCollegesStatus.ready,
        list: MyColleges(colleges: [for (final p in _picks) _entry(p, programme: 'b-com')]),
      );
      expect(await _move(view), CollegesMove.pending);
    });

    test('a copy kept on the phone is not the server, so it never says moved', () async {
      final view = MyCollegesView(
        status: MyCollegesStatus.ready,
        stale: true,
        list: MyColleges(colleges: [for (final p in _picks) _entry(p)]),
      );
      expect(await _move(view), CollegesMove.later);
    });

    test('a failed read, or a save the server refused, says the colleges are still here', () async {
      expect(await _move(const MyCollegesView(status: MyCollegesStatus.failed, offline: true)), CollegesMove.later);
      expect(await _move(const MyCollegesView(status: MyCollegesStatus.ready, notice: 'Could not save that.')), CollegesMove.later);
      expect(await _move(const MyCollegesView(status: MyCollegesStatus.ready, busy: true, notice: 'x')), CollegesMove.pending, reason: 'a save is still running');
    });
  });

  group('the saved line', () {
    test('names the colleges only once they are on the account, and never claims what is not so', () {
      expect(OnboardingCopy.savedWhatColleges, contains('colleges are on your account'));
      expect(OnboardingCopy.savedWhat, isNot(contains('college')));
      expect(OnboardingCopy.savedWhatCollegesLater, contains('still on this phone'));
      expect(OnboardingCopy.savedWhatCollegesLater, contains('back online'));
    });
  });
}
