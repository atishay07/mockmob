import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/platform/share_image.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/review/data/repair_state.dart';
import 'package:mockmob/features/review/screens/repair_ending_screen.dart';
import 'package:mockmob/features/review/widgets/share_card.dart';

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/review_fixtures.dart';

class _Share implements ShareSurface {
  final List<({Uint8List png, String name, String text})> shared = [];
  bool ok = true;

  @override
  Future<bool> shareImage({required Uint8List png, required String name, required String text}) async {
    if (!ok) return false;
    shared.add((png: png, name: name, text: text));
    return true;
  }
}

/// A screen with one button that opens the preview sheet, as a host would.
class _Host extends StatelessWidget {
  const _Host(this.data);

  final ShareCardData data;

  @override
  Widget build(BuildContext context) => Center(
        child: KeyButton(label: 'Open', onPressed: () => showShareCardSheet(context, data: data)),
      );
}

final _repair = ShareCardData.repair(repaired: 3, day: DateTime(2026, 10, 14, 22, 5), subject: 'Accountancy');

Future<void> _open(WidgetTester tester, ShareCardData data, _Share share) async {
  await pumpMockmob(
    tester,
    _Host(data),
    size: const Size(384, 900),
    disableAnimations: true,
    overrides: [shareSurfaceProvider.overrideWithValue(share)],
  );
  await tester.tap(find.text('Open'));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(loadAppFonts);

  group('ShareCardData', () {
    test('a repair says how many, on which day, in plain words', () {
      expect(_repair.number, '3');
      expect(_repair.unit, 'repaired');
      expect(_repair.dateLine, '14 Oct');
      expect(_repair.shareText, '3 mistakes repaired on MockMob.');
      expect(ShareCardData.repair(repaired: 1, day: DateTime(2026, 10, 14)).shareText, '1 mistake repaired on MockMob.');
    });

    test('a week says the days studied and the dates', () {
      final week = ShareCardData.week(studyDays: 4, start: DateTime.utc(2026, 10, 5), end: DateTime.utc(2026, 10, 11));
      expect(week.number, '4');
      expect(week.unit, 'days');
      expect(week.dateLine, '5 Oct to 11 Oct');
      expect(week.shareText, '4 study days this week on MockMob.');
    });

    test('no copy carries an exclamation mark, an em dash or a score', () {
      final texts = [
        for (final d in [_repair, ShareCardData.week(studyDays: 1, start: DateTime.utc(2026, 10, 5), end: DateTime.utc(2026, 10, 11))])
          ...[d.kicker, d.number, d.unit, d.dateLine, d.shareText],
      ];
      for (final t in texts) {
        expect(t, isNot(contains('!')));
        expect(t, isNot(contains('—')));
        expect(t.toLowerCase(), isNot(contains('marks')));
        expect(t.toLowerCase(), isNot(contains('weak')));
        expect(t, isNot(contains('%')));
      }
    });
  });

  group('ShareCard', () {
    testWidgets('shows the count and the date and never the subject by default', (tester) async {
      await pumpMockmob(tester, Center(child: ShareCard(data: _repair)), size: const Size(384, 600), disableAnimations: true);
      expect(find.text('Mistake repair'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('repaired'), findsOneWidget);
      expect(find.text('14 Oct'), findsOneWidget);
      expect(find.text('mockmob.in'), findsOneWidget);
      expect(find.text('Accountancy'), findsNothing);
      expect(tester.getSize(find.byType(ShareCard)), ShareCard.size);
    });

    testWidgets('shows the subject only when asked', (tester) async {
      await pumpMockmob(tester, Center(child: ShareCard(data: _repair, showSubject: true)), size: const Size(384, 600), disableAnimations: true);
      expect(find.text('Accountancy'), findsOneWidget);
    });
  });

  group('preview sheet', () {
    testWidgets('previews the card and shares the picture and one plain line', (tester) async {
      final share = _Share();
      await _open(tester, _repair, share);

      expect(find.text('Share a card'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('Accountancy'), findsNothing, reason: 'the subject is off until the student turns it on');
      expect(find.text('Add the subject'), findsOneWidget);

      await tester.tap(find.widgetWithText(KeyButton, 'Share'));
      // The picture is made by the real engine, outside the fake clock.
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 600)));
      await tester.pumpAndSettle();

      expect(share.shared, hasLength(1));
      final sent = share.shared.single;
      expect(sent.text, '3 mistakes repaired on MockMob.');
      expect(sent.name, 'mockmob-repair.png');
      // A PNG, at 3x the card's size: 1080 by 1350.
      expect(sent.png.sublist(1, 4), [0x50, 0x4E, 0x47]);
      final view = ByteData.sublistView(sent.png);
      expect(view.getUint32(16), 1080);
      expect(view.getUint32(20), 1350);
      expect(find.text('Share a card'), findsNothing, reason: 'the sheet closes after sharing');
    });

    testWidgets('the subject switch changes the card and nothing else', (tester) async {
      final share = _Share();
      await _open(tester, _repair, share);
      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      expect(find.text('Accountancy'), findsOneWidget);
    });

    testWidgets('a week has no subject switch', (tester) async {
      final week = ShareCardData.week(studyDays: 4, start: DateTime.utc(2026, 10, 5), end: DateTime.utc(2026, 10, 11));
      await _open(tester, week, _Share());
      expect(find.byType(Switch), findsNothing);
      expect(find.text('5 Oct to 11 Oct'), findsOneWidget);
    });

    testWidgets('not now closes it and shares nothing', (tester) async {
      final share = _Share();
      await _open(tester, _repair, share);
      await tester.tap(find.text('Not now'));
      await tester.pumpAndSettle();
      expect(find.text('Share a card'), findsNothing);
      expect(share.shared, isEmpty);
    });

    testWidgets('when the share sheet cannot open it says so and stays', (tester) async {
      final share = _Share()..ok = false;
      await _open(tester, _repair, share);
      await tester.tap(find.widgetWithText(KeyButton, 'Share'));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 600)));
      await tester.pumpAndSettle();
      expect(find.text('Could not make the card. Try again.'), findsOneWidget);
      expect(find.text('Share a card'), findsOneWidget);
    });
  });

  group('repair ending', () {
    testWidgets('offers a share card for the repairs just done, and the preview carries no marks', (tester) async {
      await pumpMockmob(
        tester,
        const RepairEndingScreen(attemptId: 'm7'),
        size: const Size(384, 2400),
        disableAnimations: true,
        wrapInScaffold: false,
        overrides: [
          ...reviewOverrides(
            records: [repairedRecord],
            run: runOf(phase: RepairPhase.ending, outcomes: [explained, explained2], index: 1),
          ),
          shareSurfaceProvider.overrideWithValue(_Share()),
        ],
      );
      final key = find.widgetWithText(KeyButton, 'Share a card');
      expect(key, findsOneWidget);
      await tester.tap(key);
      await tester.pumpAndSettle();
      expect(find.text('Mistake repair'), findsOneWidget);
      expect(find.text('Add the subject'), findsOneWidget);
      final card = find.byType(ShareCard);
      expect(find.descendant(of: card, matching: find.textContaining('marks')), findsNothing);
      expect(find.descendant(of: card, matching: find.textContaining('Partnership')), findsNothing, reason: 'a chapter is a weak area and never goes on the card');
      expect(find.descendant(of: card, matching: find.text('Accountancy')), findsNothing);
    });
  });
}
