import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';
import 'package:mockmob/features/insights/widgets/ask_messages.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../golden/insights/insights_golden_support.dart';

void _noop() {}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('a thread of replies holds no Mobi at all: each line carries only the small mark', (tester) async {
    await pumpMockmob(
      tester,
      const Column(children: [
        AskMessageView(message: AskMessage.reply('You lost 35 marks in Partnership.', origin: AskOrigin.phone), onRetry: _noop),
        AskMessageView(message: AskMessage.reply('Try the cash flow chapter next.', origin: AskOrigin.phone), onRetry: _noop, animate: true),
        AskMessageView(message: AskMessage.sending(), onRetry: _noop),
      ]),
      brightness: Brightness.dark,
    );
    expect(find.byType(MobiFace), findsNothing);
    expect(find.byType(MobiCharacter), findsNothing);
    expect(find.byType(MmMark), findsNWidgets(3));
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('the Ask screen shows Mobi once, before and after the first message', (tester) async {
    for (final ask in [const AskState(), const AskState(messages: [AskMessage.student('How is my week going?'), AskMessage.reply('Three sessions.', origin: AskOrigin.phone)])]) {
      await pumpMockmob(
        tester,
        const AskScreen(),
        brightness: Brightness.dark,
        disableAnimations: true,
        overrides: insightsOverrides(ask: ask),
        wrapInScaffold: false,
      );
      expect(find.byType(MobiCharacter), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    }
  });
}
