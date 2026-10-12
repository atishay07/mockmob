import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

Widget _states() {
  return Column(
    children: [
      Expanded(
        child: StateView(
          kind: StateViewKind.empty,
          title: 'Nothing to repair yet',
          message: 'Finish a mock and the mistakes you can repair will appear here.',
          primary: StateAction('Start a mock', () {}),
        ),
      ),
      Expanded(
        child: StateView(
          kind: StateViewKind.error,
          title: 'We could not load this week',
          message: 'Your record is as you left it.',
          primary: StateAction('Try again', () {}),
          secondary: StateAction('Go to Today', () {}),
        ),
      ),
      Expanded(
        child: StateView(
          kind: StateViewKind.offline,
          title: 'You are offline',
          message: 'Connect to start. Your downloaded reviews still work.',
          primary: StateAction('Open Review', () {}),
        ),
      ),
    ],
  );
}

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in Brightness.values) {
    testWidgets('state view, ${brightness.name}', (tester) async {
      await pumpMockmob(tester, _states(), brightness: brightness, size: const Size(360, 1000));
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/state_view_${brightness.name}.png'));
    });
  }
}
