import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/widgets/confirm_sheet.dart';
import 'package:mockmob/features/practice/widgets/practice_composer.dart';

void main() {
  testWidgets('the confirm sheet disposes its composer controller when its content unmounts', (tester) async {
    final controller = ComposerController(PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy', count: 10));
    await tester.pumpWidget(MaterialApp(home: ComposerLifetime(controller: controller, child: const SizedBox())));
    // Alive while mounted: listening works.
    controller.addListener(() {});

    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    // Disposed with the sheet: a disposed ChangeNotifier refuses new listeners (debug assert).
    expect(() => controller.addListener(() {}), throwsFlutterError);
  });
}
