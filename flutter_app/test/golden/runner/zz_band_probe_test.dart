import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/runner/nta/nta_paper_theme.dart';

import '../../helpers/fonts.dart';
import '../../unit/runner/support/exam_font.dart';
import '../../unit/runner/support/fake_session.dart';
import '../../unit/runner/support/harness.dart';

class _Mm extends NtaStyleNotifier {
  @override
  NtaStyle build() => NtaStyle.mockmob;
}

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadExamFont();
  });
  for (final (name, size) in [('a', const Size(360, 780)), ('b', const Size(384, 853))]) {
    for (final style in ['nta', 'mm']) {
      testWidgets('probe $name $style', (tester) async {
        await pumpRunner(tester, session: FakeRunnerSession(mode: 'nta'), brightness: Brightness.dark, size: size, systemInsets: const EdgeInsets.only(top: 28, bottom: 24),
          overrides: style == 'mm' ? [ntaStyleProvider.overrideWith(_Mm.new)] : const []);
        await settle(tester);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('zz_probe_${name}_$style.png'));
      });
    }
  }
}
