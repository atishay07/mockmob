// Goldens for this pass's practice work: the finish moment frame by frame (0, 400, 900 ms),
// the result's analysis and Prove step, setup with several chapters and a difficulty, and the
// subject objects of all fifteen practice subjects (owner feedback 1110).
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart' show fallbackSubjectNames;
import 'package:mockmob/features/practice/data/result_actions.dart';
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/practice/widgets/subject_tiles.dart';
import 'package:mockmob/features/result/widgets/mistake_row.dart' show MistakeSummary;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show settleImages;
import '../../unit/core_data/support/fixtures.dart';
import '../../unit/practice/support/harness.dart';

const Size _size = Size(384, 853);

class _ArtSheet extends StatelessWidget {
  const _ArtSheet();

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: context.mmColors.ground,
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final e in [...fallbackSubjectNames.entries, const MapEntry('hindi', 'Hindi')])
              Transform.scale(
                scale: 0.82,
                alignment: Alignment.topLeft,
                child: SizedBox(
                  width: SubjectTiles.width * 0.82,
                  height: SubjectTiles.height * 0.82,
                  child: OverflowBox(
                    alignment: Alignment.topLeft,
                    maxWidth: SubjectTiles.width,
                    maxHeight: SubjectTiles.height,
                    child: SubjectTile(id: e.key, name: e.value, selected: e.key == 'physics', onTap: () {}),
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

List<GoRoute> _routes() => [
  GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
  GoRoute(path: '/practice/result/:attemptId', builder: (c, s) => practiceResultScreen(c, s)),
  GoRoute(path: '/art', builder: (c, s) => const _ArtSheet()),
  stubRoute('/today'),
  stubRoute('/practice'),
  stubRoute('/practice/start'),
  stubRoute('/review/repair/:attemptId/:questionId'),
];

final _set = [
  for (var i = 0; i < 6; i++) ('Admission of a partner', V.right),
  ('Admission of a partner', V.wrong),
  ('Goodwill', V.wrong),
  ('Admission of a partner', V.wrong),
  ('Goodwill', V.blank),
];

/// A great set: nine right, one wrong.
final _great = [
  for (var i = 0; i < 9; i++) ('Admission of a partner', V.right),
  ('Goodwill', V.wrong),
];

AttemptDetail _detail({Map<String, dynamic>? recovery, List<(String, V)>? questions}) => AttemptDetail.fromJson({
  ...attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: questions ?? _set, extraMeta: {'recovery': ?recovery}),
  'answerReviews': <String, dynamic>{},
  'answerReviewState': 'ready',
});

/// A session the phone timed: steady on the right answers, fast on two of the three wrong.
Map<String, dynamic> _telemetry() {
  var at = 0;
  const secs = [48, 52, 39, 61, 44, 57, 12, 70, 9, 30];
  return {
    'telemetry': 'self_reported',
    'timeline': [
      for (var i = 0; i < 10; i++) {'qid': 'p1-q${i + 1}', 'at': (at += i == 0 ? 0 : secs[i - 1] * 1000), 'seq': i},
      {'qid': 'p1-q10', 'at': at + secs[9] * 1000, 'seq': 10},
    ],
    'observed': {
      'answerChanges': [
        {'qid': 'p1-q7', 'before': 0, 'after': 1, 'markEffect': -6},
      ],
    },
  };
}

Future<void> _shot(WidgetTester tester, String name, Brightness b) async {
  final tag = b == Brightness.dark ? 'night' : 'day';
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_$tag.png'));
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir == null || dir.isEmpty) return;
  final boundary = previewBoundary.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    await File('$dir/practice_${name}_$tag.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

Future<void> _pump(WidgetTester tester, String location, Brightness b, List<Override> overrides) =>
    pumpRouted(tester, location: location, routes: _routes(), brightness: b, size: _size, overrides: overrides);

Future<void> _settle(WidgetTester tester, {int ms = 900}) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(Duration(milliseconds: ms ~/ 6));
  }
  await settleImages(tester);
}

void main() {
  setUpAll(loadAppFonts);

  for (final b in [Brightness.dark, Brightness.light]) {
    group('practice finish, ${b.name}', () {
      for (final ms in [0, 400, 900, 2400]) {
        testWidgets('the finish moment at $ms ms', (tester) async {
          final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
          await _pump(tester, '/practice/result/p1', b, resultOverrides(attemptId: 'p1', detail: _detail(), pending: pending, chapter: 'Admission of a partner'));
          await warmSheetStamp(tester);
          // Two frames for the fresh check to resolve; the moment starts on the second.
          await tester.pump();
          await tester.pump();
          // Frames every 50 ms, as a phone would draw them, so state set mid-moment is painted.
          for (var t = 0; t < ms; t += 50) {
            await tester.pump(const Duration(milliseconds: 50));
          }
          // The last frame waits out Mobi's typewriter, so it shows the whole line.
          if (ms == 2400) {
            for (var i = 0; i < 12; i++) {
              await tester.pump(const Duration(milliseconds: 250));
            }
          }
          await _shot(tester, ms == 2400 ? 'finish_settled' : 'finish_${ms}ms', b);
          await tester.pump(const Duration(seconds: 3));
        });
      }

      // The stamp (UI blitz, 14 Oct): the score lands on the mark sheet (20 Oct, K7: after the seal and the marking, about
      // 1.7 s for ten); a great set adds the ring and the burst of volt shards behind it.
      for (final (name, set, ms) in [('finish_stamp_mixed', _set, 1700), ('finish_stamp_great', _great, 1800)]) {
        testWidgets('the stamp, $name at $ms ms', (tester) async {
          final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
          await _pump(
            tester,
            '/practice/result/p1',
            b,
            resultOverrides(attemptId: 'p1', detail: _detail(questions: set), pending: pending, chapter: 'Admission of a partner'),
          );
          await warmSheetStamp(tester);
          await tester.pump();
          await tester.pump();
          for (var t = 0; t < ms; t += 50) {
            await tester.pump(const Duration(milliseconds: 50));
          }
          await _shot(tester, name, b);
          await tester.pump(const Duration(seconds: 4));
        });
      }

      // Finish for now: the sheet is filed under a volt seal, then the receipt line engraves in.
      for (final ms in [350, 1000]) {
        testWidgets('finish for now at $ms ms', (tester) async {
          final pending = FakePendingResults()..receivedAt = DateTime(2026, 10, 12, 23, 51);
          await _pump(tester, '/practice/result/p1', b, resultOverrides(attemptId: 'p1', detail: _detail(), pending: pending));
          for (var i = 0; i < 12; i++) {
            await tester.pump(const Duration(milliseconds: 250));
          }
          await tester.tap(find.text('Finish for now'));
          await tester.pump();
          for (var t = 0; t < ms; t += 50) {
            await tester.pump(const Duration(milliseconds: 50));
          }
          await _shot(tester, 'closing_${ms}ms', b);
          await tester.pump(const Duration(seconds: 2));
        });
      }

      testWidgets('result analysis: what the set shows and the Prove step', (tester) async {
        const replay = ReplayInventory(supported: true, chapters: [ReplayChapter(chapter: 'Admission of a partner', available: true)]);
        await _pump(tester, '/practice/result/p1', b, resultOverrides(attemptId: 'p1', detail: _detail(recovery: _telemetry()), replay: replay));
        await _settle(tester);
        // What the set shows and the proof set live in their folds (RESULT-1017 layer 4): open both.
        final page = find.byType(Scrollable).first;
        for (final title in ['Where the marks went', 'Your rule and proof it stuck']) {
          await tester.scrollUntilVisible(find.text(title), 300, scrollable: page);
          await Scrollable.ensureVisible(tester.element(find.text(title)), alignment: 0.3);
          await tester.pump();
          await tester.tap(find.text(title));
          await _settle(tester, ms: 600);
        }
        await tester.scrollUntilVisible(find.text('What this set shows'), 300, scrollable: page);
        await Scrollable.ensureVisible(tester.element(find.text('What this set shows')), alignment: 0.1);
        await _settle(tester, ms: 600);
        await _shot(tester, 'result_analysis', b);
      });

      testWidgets('result, an open wrong answer with its time, change and report key', (tester) async {
        await _pump(tester, '/practice/result/p1', b, resultOverrides(attemptId: 'p1', detail: _detail(recovery: _telemetry())));
        await _settle(tester);
        // A mistake opens on a tap: its time, its change, the free answer, then the repair entry.
        // The finish moment adds the marks up before the layers (20 Oct, I13): scroll until a row is built.
        for (var i = 0; i < 20 && find.byType(MistakeSummary).evaluate().isEmpty; i++) {
          await tester.drag(find.byType(Scrollable).first, const Offset(0, -300));
          await tester.pump();
        }
        final row = find.byType(MistakeSummary).first;
        await Scrollable.ensureVisible(tester.element(row), alignment: 0.0);
        await tester.pump();
        await tester.tap(row);
        await _settle(tester, ms: 600);
        await _shot(tester, 'result_open_answer', b);
      });

      testWidgets('setup, three chapters and Hard (Pro)', (tester) async {
        const pro = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'a@b.co', subjects: ['accountancy', 'economics'], isPro: true);
        await _pump(
          tester,
          '/practice/setup/chapter?subject=accountancy&count=15&chapters=Admission%20of%20a%20partner&chapters=Goodwill&chapters=Retirement%20and%20death%20of%20a%20partner&difficulty=hard',
          b,
          practiceOverrides(auth: pro, quotes: FakeQuoteRepository((s, m, c, p) => quoteOf(cost: 0, entitlement: 'access', durationSec: (c ?? 10) * 60, count: c ?? 10))),
        );
        await _settle(tester);
        await _shot(tester, 'setup_chapters_hard', b);
      });

      testWidgets('subject objects for every practice subject', (tester) async {
        await _pump(tester, '/art', b, practiceOverrides());
        await _settle(tester);
        await _shot(tester, 'subject_art_all', b);
      });
    });
  }
}
