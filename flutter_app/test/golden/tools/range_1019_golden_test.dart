// Goldens for 19 Oct G18 and G19: the estimate sheet with 900 to 920 typed (the headline and the
// rows in the same two words), the sheet on "I don't know my range yet", and Today's range card
// (a fresh account, partway, and ready). Each at 360 and 412 dp, Night and Day, and 360 dp at 1.3x
// text.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/core/repositories/quote_repository.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/tools/colleges/colleges_copy.dart';
import 'package:mockmob/features/tools/estimate/estimate_copy.dart';
import 'package:mockmob/features/tools/estimate/estimate_sheet.dart';
import 'package:mockmob/features/tools/estimate/range_choice.dart';
import 'package:mockmob/features/tools/estimate/range_today_card.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/tools/my_colleges_support.dart';
import '../../unit/tools/tools_test_support.dart';
import '../you/you_golden_kit.dart';

typedef _Interact = Future<void> Function(WidgetTester tester);

const _frames = [
  (tag: '360', size: Size(360, 800), scale: 1.0),
  (tag: '412', size: Size(412, 915), scale: 1.0),
  (tag: '360_130', size: Size(360, 800), scale: 1.3),
];

void _golden(String name, Widget Function() screen, {required List<Override> Function() overrides, _Interact? interact, double tallBy = 1}) {
  for (final f in _frames) {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final theme = brightness == Brightness.dark ? 'night' : 'day';
      testWidgets('$name, ${f.tag}, $theme', (tester) async {
        await pumpMockmob(
          tester,
          screen(),
          brightness: brightness,
          size: Size(f.size.width, f.size.height * tallBy),
          textScale: f.scale,
          wrapInScaffold: false,
          disableAnimations: true,
          overrides: overrides(),
        );
        await _settle(tester);
        if (interact != null) await interact(tester);
        await _settle(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/range1019_${name}_${f.tag}_$theme.png'));
      });
    }
  }
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 3; i++) {
    await tester.pumpAndSettle();
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 60)));
  }
  await tester.pumpAndSettle();
}

Attempt _full(String subject, int correct, int wrong) => Attempt.fromJson({
      'id': 'mock-$subject',
      'subject': subject,
      'score': 0,
      'correct': correct,
      'wrong': wrong,
      'unattempted': 50 - correct - wrong,
      'total': 50,
      'mode': 'full',
      'completedAt': DateTime.utc(2026, 10, 12).toIso8601String(),
    });

final _mocks = [
  _full('english', 40, 5),
  _full('accountancy', 30, 10),
  _full('economics', 36, 8),
  _full('business_studies', 42, 4),
  _full('mathematics', 20, 15),
];

const _five = ['english', 'accountancy', 'economics', 'business_studies', 'mathematics'];

FakeMyColleges _ownersFour() => FakeMyColleges(start: [
      mc('b-com-hons', 'Hindu College', 'B.Com. (Hons.)'),
      mc('b-com-hons', 'Lady Shri Ram College for Women (W)', 'B.Com. (Hons.)'),
      mc('b-com-hons', 'Hansraj College', 'B.Com. (Hons.)'),
      mc('b-com-hons', 'Kirori Mal College', 'B.Com. (Hons.)'),
    ]);

/// The quote for any full mock: free as the first in its subject (19 Oct, W5), or 50 credits.
class _Quotes implements QuoteRepository {
  _Quotes({this.firstFree = true});

  final bool firstFree;

  @override
  Future<PracticeQuote> quote({required String subject, required String mode, int? count, String? purpose}) async => PracticeQuote(
        state: 'available',
        launchable: true,
        reasonCode: firstFree ? 'first_full_mock_free' : 'ok',
        creditCost: firstFree ? 0 : 50,
        creditBalance: 90,
        subjectId: subject,
        subjectName: subject,
        modeId: mode,
        count: count,
      );
}

MemoryPrefsStore _unknown() => MemoryPrefsStore()..values[RangeChoiceController.keyFor('u1')] = '{"choice":"unknown"}';

Widget _opener() => Builder(
      builder: (context) => Scaffold(
        body: Center(child: TextButton(onPressed: () => showEstimateSheet(context), child: const Text('open'))),
      ),
    );

/// Today's ground with the card at the page's gutter, as Today lays it out.
Widget _today() => Builder(
      builder: (context) => Scaffold(
        backgroundColor: context.mmColors.ground,
        body: ListView(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s32),
          children: const [RangeTodayBlock()],
        ),
      ),
    );

void main() {
  setUpGoldenFonts();

  Finder field(String label) => find.byWidgetPredicate((w) => w is TextField && w.decoration?.labelText == label);

  // G18: the owner's case. 900 to 920 against his four colleges: all four in reach, one sentence.
  _golden(
    'sheet_typed_900_920',
    _opener,
    overrides: () => toolsOverrides(myColleges: _ownersFour(), prefs: savedCompass('english,accountancy,business_studies,economics')),
    interact: (tester) async {
      await tester.tap(find.text('open'));
      await _settle(tester);
      await tester.enterText(field(CollegesCopy.from), '900');
      await tester.enterText(field(CollegesCopy.to), '920');
    },
  );

  // G19: the sheet on "I don't know my range yet", two of five subjects done.
  _golden(
    'sheet_unknown',
    _opener,
    overrides: () => [
      ...toolsOverrides(sheet: _five, myColleges: _ownersFour(), prefs: _unknown(), attempts: _mocks.take(2).toList()),
      quoteRepositoryProvider.overrideWithValue(_Quotes()),
    ],
    interact: (tester) async {
      await tester.tap(find.text('open'));
      await _settle(tester);
      await tester.scrollUntilVisible(find.text(EstimateCopy.unknownBody), 200, scrollable: find.byType(Scrollable).last);
    },
  );

  // Today's card on a fresh account: five subjects, none done.
  _golden('card_fresh', _today, overrides: () => [...toolsOverrides(sheet: _five), quoteRepositoryProvider.overrideWithValue(_Quotes())]);

  // Partway: four done, so the four papers DU counts already give an early estimate.
  _golden(
    'card_partway',
    _today,
    overrides: () => [
      ...toolsOverrides(sheet: _five, prefs: _unknown(), attempts: _mocks.take(4).toList()),
      quoteRepositoryProvider.overrideWithValue(_Quotes(firstFree: false)),
    ],
  );

  // Ready: every subject has a full mock.
  _golden(
    'card_ready',
    _today,
    overrides: () => [
      ...toolsOverrides(sheet: _five, prefs: _unknown(), attempts: _mocks, myColleges: _ownersFour()),
      quoteRepositoryProvider.overrideWithValue(_Quotes()),
    ],
  );
}
