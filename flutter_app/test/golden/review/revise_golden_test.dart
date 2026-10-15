import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/lab_loop.dart' show RulesRead;
import 'package:mockmob/core/models/mistake_lab_traps.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/review/revise/revise_data.dart';
import 'package:mockmob/features/review/revise/revise_screen.dart';
import 'package:mockmob/features/rules/data/traps_data.dart';
import 'package:mockmob/features/rules/screens/rule_book_screen.dart';

import 'review_golden_support.dart';

Map<String, dynamic> _later() => jsonDecode(File('test/fixtures/mistake_lab/contract_later_v1.json').readAsStringSync()) as Map<String, dynamic>;
Map<String, dynamic> _contract(String name) => jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

RemoteState<RulesRead> rulesState() => RemoteState(
      value: RulesRead.parse({'book': _contract('rules')['book'], 'acrossMocks': _contract('across')}),
      fetchedAt: DateTime.utc(2026, 10, 15, 9),
    );

Map<String, dynamic> _traps() => jsonDecode(File('test/fixtures/mistake_lab/contract_traps_v1.json').readAsStringSync()) as Map<String, dynamic>;

/// Revise as the website's contract serves it. Each recall answers at once with the next queued grade.
class _Api implements ReviseApi {
  _Api(this.answers);

  final List<Object> answers;

  @override
  Future<ReviseRead> read({required int cap}) async => ReviseRead.parse({...(_later()['revise'] as Map<String, dynamic>), 'cap': cap});

  @override
  Future<ReviseAnswer> answer({required String questionId, required int choice, required int cap}) async {
    final next = answers.removeAt(0);
    if (next is ReviseAnswer) return next;
    throw next;
  }
}

class _TrapsApi implements TrapsApi {
  @override
  Future<TrapsMeet> read() async => TrapsMeet.tryParse(_traps()['sheet'])!;
}

ReviseAnswer _answer(String which, {bool? correct, int? box}) {
  final base = Map<String, dynamic>.from((_later()['answers'] as Map)[which] as Map);
  return ReviseAnswer.tryParse({...base, 'correct': ?correct, 'box': ?box})!;
}

Future<void> _settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

/// Revise and "Traps you meet" (Mistake Lab v4 slice 4) at 360 dp, Night and Day: the first card,
/// a right recall with its explanation, a wrong recall with the key, the end of a run, and the
/// opened disclosure in the Rule book.
void main() {
  const size = Size(360, 1180);

  reviewGolden(
    'revise_card',
    () => const ReviseScreen(),
    overrides: () => [...reviewOverrides(), reviseApiProvider.overrideWithValue(_Api([])), revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore())],
    size: size,
    after: _settle,
  );

  reviewGolden(
    'revise_right',
    () => const ReviseScreen(),
    overrides: () => [
      ...reviewOverrides(),
      reviseApiProvider.overrideWithValue(_Api([_answer('right')])),
      revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    ],
    size: size,
    after: (tester) async {
      await _settle(tester);
      await tester.tap(find.text('B. Illustrative option 5b'));
      await _settle(tester);
    },
  );

  reviewGolden(
    'revise_wrong',
    () => const ReviseScreen(),
    overrides: () => [
      ...reviewOverrides(),
      reviseApiProvider.overrideWithValue(_Api([_answer('wrong', correct: false)])),
      revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    ],
    size: size,
    after: (tester) async {
      await _settle(tester);
      await tester.tap(find.text('A. Illustrative option 5a'));
      await _settle(tester);
    },
  );

  reviewGolden(
    'revise_end',
    () => const ReviseScreen(),
    overrides: () => [
      ...reviewOverrides(),
      reviseApiProvider.overrideWithValue(_Api([_answer('right'), _answer('wrong', correct: false), _answer('right'), _answer('done')])),
      revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    ],
    // Tall while the run is answered (a list builds only what is on screen), then the end at phone height.
    size: size,
    after: (tester) async {
      await _settle(tester);
      for (var i = 0; i < 4; i++) {
        await tester.tap(find.text('B. Illustrative option ${[5, 1, 2, 3][i]}b'));
        await _settle(tester);
        final label = i == 3 ? 'Finish' : 'Next question';
        final next = find.byWidgetPredicate((w) => w is KeyButton && w.label == label);
        await tester.ensureVisible(next);
        await tester.tap(next);
        await _settle(tester);
      }
      tester.view.physicalSize = const Size(360, 640) * 2;
      await _settle(tester);
    },
  );

  reviewGolden(
    'revise_unavailable',
    () => const ReviseScreen(),
    overrides: () => [
      ...reviewOverrides(),
      reviseApiProvider.overrideWithValue(_Unavailable()),
      revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    ],
    size: const Size(360, 640),
    after: _settle,
  );

  reviewGolden(
    'traps_meet',
    () => const RuleBookScreen(),
    overrides: () => [...reviewOverrides(rules: rulesState()), trapsApiProvider.overrideWithValue(_TrapsApi())],
    size: const Size(360, 900),
    after: (tester) async {
      await _settle(tester);
      final head = find.text('Your traps across mocks');
      await tester.scrollUntilVisible(head, 300, scrollable: find.byType(Scrollable).first);
      await tester.tap(head);
      await _settle(tester);
      await tester.scrollUntilVisible(find.text('Still catching you'), 300, scrollable: find.byType(Scrollable).first);
      await tester.pump(const Duration(milliseconds: 400));
    },
  );
}

class _Unavailable implements ReviseApi {
  @override
  Future<ReviseRead> read({required int cap}) async => ReviseRead.notAvailable;

  @override
  Future<ReviseAnswer> answer({required String questionId, required int choice, required int cap}) async =>
      throw const ApiError(kind: ApiErrorKind.unavailable, code: 'unavailable', status: 503);
}
