// The cheap LOW findings of the v15 emulator walk, each held by a test: an opened mistake shows its question once (the
// one-line preview steps aside), a fold's first block does not open on a blank band, a paid Ask Mobi reply never claims to
// be written "from your record", and the reel's card says why its key is still turning after a long read.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/insights/data/ask_suggestions.dart' show AskSheetCopy;
import 'package:mockmob/features/practice/model/session_analysis.dart' show Observation, ObservationKind, ObservationTone, SessionAnalysis;
import 'package:mockmob/features/practice/result_copy.dart' show ResultCopy;
import 'package:mockmob/features/practice/widgets/observations_panel.dart';
import 'package:mockmob/features/result/widgets/mistake_row.dart' show MistakeStatus, MistakeSummary;
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_model.dart' show SealedHero;
import 'package:mockmob/features/today/widgets/reel_hero.dart' show ReelHeroCard;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

void main() {
  setUpAll(loadAppFonts);

  const stem = 'A and B share profits 3 : 2. C is admitted for a 1/5 share, taken equally from A and B. What is the new ratio?';

  group('an opened mistake shows its question once', () {
    Future<void> pump(WidgetTester tester, {required bool expanded}) => pumpMockmob(
          tester,
          MistakeSummary(number: 4, status: MistakeStatus.repair, expanded: expanded, chapter: 'Admission of a partner', stem: stem, yours: 'B', answer: 'A'),
          size: const Size(390, 600),
          disableAnimations: true,
        );

    testWidgets('closed: the chapter and the one-line preview of the question', (tester) async {
      await pump(tester, expanded: false);
      expect(find.text('Admission of a partner'), findsOneWidget);
      expect(find.text(stem), findsOneWidget);
    });

    testWidgets('open: the preview steps aside, because the full question stands below the row', (tester) async {
      await pump(tester, expanded: true);
      expect(find.text('Admission of a partner'), findsOneWidget);
      expect(find.text(stem), findsNothing);
    });

    testWidgets('opening and closing it again brings the preview back', (tester) async {
      await pump(tester, expanded: true);
      await pump(tester, expanded: false);
      await tester.pumpAndSettle();
      expect(find.text(stem), findsOneWidget);
    });
  });

  testWidgets('what this set shows: the heading follows the fold\'s own title closely, not a section gap', (tester) async {
    const analysis = SessionAnalysis(
      changes: [],
      telemetry: 'self_reported',
      observations: [
        Observation(
          kind: ObservationKind.blank,
          tone: ObservationTone.neutral,
          label: 'Time',
          headline: 'You spent 2m 37s on this set',
          detail: 'About 16s a question.',
          tip: 'Slow down on the long ones.',
          questions: [4],
        ),
      ],
      dwellMs: {'q1': 12000, 'q2': 9000},
    );
    await pumpMockmob(tester, ObservationsPanel(analysis: analysis, onShow: (_) {}), size: const Size(390, 900), disableAnimations: true);
    final panel = tester.getTopLeft(find.byType(ObservationsPanel)).dy;
    final heading = tester.getTopLeft(find.text(ResultCopy.showsTitle)).dy;
    expect(heading - panel, lessThanOrEqualTo(16), reason: 'the walk measured a blank band of about 100 px above the heading');
  });

  test('a paid reply is never described as written from the record', () {
    expect(AskSheetCopy.writing, 'Writing a reply');
    expect(AskSheetCopy.writing.toLowerCase(), isNot(contains('record')));
  });

  group('the reel card says why its key is still turning', () {
    const sealed = SealedHero(attemptId: 'm4', title: 'Mock 4, Accountancy', line: 'Your Accountancy paper, question by question.', questions: 50);

    Future<void> pump(WidgetTester tester, {required bool loading}) =>
        pumpMockmob(tester, ReelHeroCard(sealed: sealed, onPlay: () {}, onLater: () {}, loading: loading), size: const Size(390, 900), disableAnimations: true);

    testWidgets('not at first, then once the read has run past eight seconds, and gone when it ends', (tester) async {
      await pump(tester, loading: true);
      expect(find.text(TodayCopy.reelSlow), findsNothing);
      await tester.pump(ReelHeroCard.slowAfter - const Duration(seconds: 1));
      expect(find.text(TodayCopy.reelSlow), findsNothing);
      await tester.pump(const Duration(seconds: 2));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text(TodayCopy.reelSlow), findsOneWidget);
      await pump(tester, loading: false);
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text(TodayCopy.reelSlow), findsNothing);
    });

    testWidgets('a card that is not reading never says it', (tester) async {
      await pump(tester, loading: false);
      await tester.pump(const Duration(seconds: 20));
      expect(find.text(TodayCopy.reelSlow), findsNothing);
    });
  });
}
