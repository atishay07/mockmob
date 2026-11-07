// R8 APP-01: after a try that changed the pick, the folded line keeps the paper's pick as the coral one and never calls
// a right retry "Your answer"; the trap heading names the paper's pick.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/review/copy.dart';
import 'package:mockmob/features/review/widgets/mistake_view.dart' show FoldLine;

import '../core/motion/motion_harness.dart' show motionApp;

void main() {
  test('the folded line after a try names the paper pick, the retry and the key', () {
    expect(ReviewCopy.foldedRetry(3, 'B', 'C', 'C'), 'Q3. Paper pick B. Now C. Key C.');
    expect(ReviewCopy.foldedQuestion(3, 'B', 'C'), 'Q3. Your pick B. Key C.');
    expect(ReviewCopy.whyLookedRight('B'), 'Why B looked right');
  });

  testWidgets('a right retry: the paper pick in coral, the key as "Now right", no "Your answer"', (tester) async {
    await tester.pumpWidget(motionApp(const FoldLine(line: 'Q3. Paper pick B. Now C. Key C.', number: 3, pick: 'C', answer: 'C', paperPick: 'B')));
    expect(find.text(ReviewCopy.paperPick), findsOneWidget);
    expect(find.text(ReviewCopy.nowRight), findsOneWidget);
    expect(find.text(ReviewCopy.yourAnswer), findsNothing);
    expect(find.text(ReviewCopy.correctAnswer), findsNothing);
    expect(find.bySemanticsLabel('Q3. Paper pick B. Now C. Key C.'), findsOneWidget);
  });

  testWidgets('a wrong retry keeps the retry in coral beside the paper pick and the key', (tester) async {
    await tester.pumpWidget(motionApp(const FoldLine(line: 'Q3. Paper pick B. Now D. Key C.', number: 3, pick: 'D', answer: 'C', paperPick: 'B')));
    expect(find.text(ReviewCopy.paperPick), findsOneWidget);
    expect(find.text(ReviewCopy.yourRetry), findsOneWidget);
    expect(find.text(ReviewCopy.correctAnswer), findsOneWidget);
  });

  testWidgets('with no try the line is as before', (tester) async {
    await tester.pumpWidget(motionApp(const FoldLine(line: 'Q3. Your pick B. Key C.', number: 3, pick: 'B', answer: 'C')));
    expect(find.text(ReviewCopy.yourAnswer), findsOneWidget);
    expect(find.text(ReviewCopy.correctAnswer), findsOneWidget);
    expect(find.text(ReviewCopy.paperPick), findsNothing);
  });
}
