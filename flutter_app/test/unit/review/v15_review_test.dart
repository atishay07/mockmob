// Review's mistakes in v15 (spec 3.2): the trap named in plain words on a mistake, and the try-first line over an opened
// chapter's mistakes ("Try it again before you see the answer").
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/data/mistake_index.dart';
import 'package:mockmob/features/review/data/review_providers.dart';
import 'package:mockmob/features/review/widgets/mistake_map.dart';

import '../../helpers/fonts.dart';
import '../../golden/review/review_golden_support.dart' show reviewOverrides;
import '../../helpers/golden_harness.dart';
import 'support/review_fixtures.dart';

void main() {
  setUpAll(loadAppFonts);

  final index = buildReviewIndex(allAttempts, const []);
  final clock = ReviewClock('Asia/Kolkata', () => eveningUtc);

  Future<void> pumpMap(WidgetTester tester, {String? Function(MistakeItem item)? trapOf}) => pumpMockmob(
    tester,
    SingleChildScrollView(
      child: MistakeMap(groups: index.openGroups, clock: clock, onOpen: (_) {}, initialOpen: 0, trapOf: trapOf),
    ),
    size: const Size(384, 1600),
    disableAnimations: true,
    overrides: reviewOverrides(),
  );

  testWidgets('an opened chapter says once that every mistake starts with a try', (tester) async {
    await pumpMap(tester);
    expect(find.text(ReviewCopy.threadTryFirst), findsOneWidget);
    expect(ReviewCopy.threadTryFirst, startsWith('Try it again before you see the answer'));
  });

  testWidgets('a mistake with a named trap says it in plain words under where it was found; the others say nothing', (tester) async {
    final first = index.openGroups.first.items.first;
    await pumpMap(tester, trapOf: (item) => item.key == first.key ? 'Trap: a look-alike term' : null);
    expect(find.text('Trap: a look-alike term'), findsOneWidget);
    expect(find.byType(MistakeRow), findsWidgets);
  });

  testWidgets('without a trap the row is as it was', (tester) async {
    await pumpMap(tester);
    expect(find.textContaining('Trap:'), findsNothing);
  });
}
