import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

Widget _keys() {
  Widget letter(String l) => Builder(
        builder: (context) => Text(l, style: Theme.of(context).textTheme.labelLarge),
      );
  return SampleColumn(
    gap: 12,
    children: [
      Sample('Primary, rest (4 dp lip)', KeyButton(label: 'Start repair', onPressed: () {})),
      const Sample('Primary, pressed (flush)', KeyButtonFace(label: 'Start repair', depth: 1)),
      const Sample(
        'Primary, disabled with reason',
        KeyButton(label: 'Start repair', onPressed: null, disabledReason: 'Connect to start.'),
      ),
      Sample('Primary, loading', KeyButton(label: 'Starting', onPressed: () {}, loading: true)),
      Sample('Secondary', KeyButton.secondary(label: 'Leave the mock', onPressed: () {})),
      Sample(
        'Quiet',
        Align(alignment: Alignment.centerLeft, child: KeyButton.quiet(label: 'Why this?', onPressed: () {})),
      ),
      Sample(
        'Answer option, rest',
        KeyButton.option(label: 'Admission of a partner', selected: false, leading: letter('A'), onPressed: () {}),
      ),
      Sample(
        'Answer option, selected',
        KeyButton.option(label: 'Retirement of a partner', selected: true, leading: letter('B'), onPressed: () {}),
      ),
      const Sample('Primary, keyboard focus', KeyButtonFace(label: 'Save and next', focused: true)),
    ],
  );
}

void main() {
  setUpAll(loadAppFonts);

  for (final brightness in Brightness.values) {
    testWidgets('key button states, ${brightness.name}', (tester) async {
      await pumpMockmob(tester, _keys(), brightness: brightness, size: const Size(360, 860), disableAnimations: true);
      await expectLater(find.byType(Scaffold), matchesGoldenFile('goldens/key_button_${brightness.name}.png'));
    });
  }
}
