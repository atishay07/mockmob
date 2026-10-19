import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiRation;
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/insights/ask_mobi.dart';
import 'package:mockmob/features/insights/data/ask_question.dart';
import 'package:mockmob/features/insights/data/ask_sheet_controller.dart';
import 'package:mockmob/features/insights/copy.dart' show InsightsCopy;
import 'package:mockmob/features/insights/insights_routes.dart' show EntryRow;
import 'package:mockmob/features/result/full/answer_row.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/result/support/lab_fixtures.dart' show q17Item;
import 'insights_golden_support.dart';

/// The ways in to Ask Mobi on other screens (ASK-MOBI-1018 section 3), judged in the places they
/// sit, at 412, Night and Day: Practice's row among its neighbours, the line under the result's
/// marks, and the quiet second line under an opened mistake's repair.
const _size = Size(412, 420);

class _NoHand extends AskQuestionController {
  @override
  AskQuestionHand? build() => null;

  @override
  Future<void> open(String? raw) async {}
}

void _entryGolden(String name, Widget Function(BuildContext context) build, {Size size = _size}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      MobiRation.reset();
      MobiRation.now = () => DateTime(2026, 10, 13, 19, 30);
      addTearDown(MobiRation.reset);
      final List<Override> overrides = [...insightsOverrides(), askSheetQuestionProvider.overrideWith(_NoHand.new)];
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => Scaffold(
            backgroundColor: context.mmColors.ground,
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s16),
                child: Align(alignment: Alignment.topCenter, child: build(context)),
              ),
            ),
          ),
        ),
        brightness: brightness,
        size: size,
        disableAnimations: true,
        overrides: overrides,
        wrapInScaffold: false,
      );
      await tester.pumpAndSettle();
      await settleImages(tester);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/ask_entries_${name}_$tag.png'));
    });
  }
}

void main() {
  setUpAll(loadAppFonts);

  // Practice: under the subjects loop, in "More ways in", beside the repairs row.
  _entryGolden('practice_row', (context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('More ways in', style: type.title),
        const SizedBox(height: MmSpace.s4),
        EntryRow(icon: LucideIcons.rotateCcw, title: 'Review again', note: '3 repaired mistakes to ask again', onTap: () {}),
        Divider(height: 1, color: colors.line),
        const AskMobiPracticeRow(),
        Divider(height: 1, color: colors.line),
        EntryRow(icon: LucideIcons.layers, title: InsightsCopy.streamEntryTitle, note: InsightsCopy.streamEntryNote, onTap: () {}),
        Divider(height: 1, color: colors.line),
        EntryRow(icon: LucideIcons.compass, title: 'Admission Compass', note: 'See which colleges your score reaches', onTap: () {}),
      ],
    );
  });

  // The result: one quiet line under the marks, then an opened mistake with its repair and its Ask line.
  _entryGolden('result', (context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Accountancy mock · 12 Oct, 9:40 pm', style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s4),
        Text('142 of 250', style: type.screenTitle),
        Text('31 right, 13 wrong, 6 blank', style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s4),
        AskMobiLink(label: askMobiAboutMock, note: 'Free', onTap: () {}),
        const SizedBox(height: MmSpace.s24),
        Divider(height: 1, color: colors.line),
        AnswerRow(item: q17Item(), expanded: true, onToggle: () {}, keysOff: false, onRepair: () {}, onAsk: () {}),
      ],
    );
  }, size: const Size(412, 840));
}
