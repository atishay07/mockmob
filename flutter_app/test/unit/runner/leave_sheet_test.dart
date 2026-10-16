import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/runner/copy.dart';
import 'package:mockmob/features/runner/widgets/leave_sheet.dart';

import '../../helpers/fonts.dart';

void main() {
  setUpAll(loadAppFonts);

  Future<void> pump(WidgetTester tester, {required bool isMock}) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildTheme(Brightness.dark),
      home: Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: LeaveSheet(isMock: isMock, until: DateTime(2026, 10, 16, 23, 42), showMobi: true),
        ),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 600));
  }

  testWidgets('a timed mock leave sheet has no Mobi, the real end time and the two keys (AP3-07, A20)', (tester) async {
    await pump(tester, isMock: true);
    expect(find.byType(MobiCharacter), findsNothing);
    expect(find.text('The clock keeps running. You can continue until 11:42 PM.'), findsOneWidget);
    expect(find.text(RunnerCopy.keepGoing), findsOneWidget);
    expect(find.text(RunnerCopy.leaveKey(true)), findsOneWidget);
  });

  testWidgets('a practice keeps Mobi beside the words', (tester) async {
    await pump(tester, isMock: false);
    expect(find.byType(MobiCharacter), findsOneWidget);
  });
}
