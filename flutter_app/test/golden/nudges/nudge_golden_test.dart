// Smart nudges (D191) at 360 dp, Night and Day, text 1.0 and 1.3: Mobi's card for each of the six card kinds, and
// the two sheets (a friend's reward, a friend's game).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/nudges/nudges.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/nudges/nudge_test_kit.dart';
import '../../unit/social/v3/mob_v3_test_kit.dart' show loadFoldManifestForTest;
import '../you/you_golden_kit.dart' show setUpGoldenFonts;

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';
String _scale(double s) => s == 1.0 ? '100' : '130';

const _cardKinds = [NudgeKind.chainRisk, NudgeKind.repairOpen, NudgeKind.practiceToday, NudgeKind.creditsLow, NudgeKind.friendJoined, NudgeKind.goodResult];

void main() {
  setUpGoldenFonts();
  setUpAll(loadFoldManifestForTest);

  for (final b in [Brightness.dark, Brightness.light]) {
    for (final scale in [1.0, 1.3]) {
      testWidgets('nudge cards ${_scale(scale)} ${_tag(b)}', (tester) async {
        await pumpMockmob(
          tester,
          SampleColumn(
            children: [
              for (final kind in _cardKinds) Sample(kind.name, NudgeCard(view: nudgeViewOf(kind), enter: false, onKey: () {}, onSecondary: () {}, onDismiss: () {})),
            ],
          ),
          brightness: b,
          textScale: scale,
          size: Size(360, scale == 1.0 ? 1300 : 1560),
        );
        await tester.pump(const Duration(milliseconds: 400));
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/nudge_cards_${_scale(scale)}_${_tag(b)}.png'));
      });

      for (final kind in [NudgeKind.friendPaid, NudgeKind.mobGame]) {
        testWidgets('nudge sheet ${kind.name} ${_scale(scale)} ${_tag(b)}', (tester) async {
          final view = nudgeViewOf(kind);
          await pumpMockmob(
            tester,
            Builder(
              builder: (context) => Center(
                child: TextButton(
                  onPressed: () => showNudgeSheet(context, view, onKey: () {}, onSecondary: () {}, enter: false),
                  child: const Text('open'),
                ),
              ),
            ),
            brightness: b,
            textScale: scale,
          );
          await tester.tap(find.text('open'));
          await tester.pump(const Duration(milliseconds: 600));
          await settleImages(tester);
          await tester.pump(const Duration(milliseconds: 800));
          expect(find.text(view.title), findsOneWidget);
          await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/nudge_sheet_${kind.name}_${_scale(scale)}_${_tag(b)}.png'));
        });
      }
    }
  }
}
