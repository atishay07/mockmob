import 'dart:ui' show Tristate;

import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/runner/nta/nta_copy.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// The A- / A+ keys on the paper (bug hunt runner-nta-06): 48 dp targets, and at either end of
/// the scale the key on that side is dimmed, unavailable to TalkBack, and does nothing.
void main() {
  setUpAll(loadAppFonts);

  Future<RunnerHarness> pump(WidgetTester tester, int step) async {
    final prefs = MemoryPrefsStore()..values['nta.textStep'] = step;
    final h = await pumpRunner(tester, session: FakeRunnerSession(mode: 'nta'), prefs: prefs);
    await settle(tester);
    return h;
  }

  SemanticsData key(WidgetTester tester, String label) => tester.getSemantics(find.bySemanticsLabel(label)).getSemanticsData();

  testWidgets('both keys are 48 dp targets', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester, 1);
    for (final label in [NtaCopy.smaller, NtaCopy.larger]) {
      final rect = tester.getSemantics(find.bySemanticsLabel(label)).rect;
      expect(rect.width, greaterThanOrEqualTo(48), reason: label);
      expect(rect.height, greaterThanOrEqualTo(48), reason: label);
    }
    handle.dispose();
  });

  testWidgets('at the largest size A+ is unavailable and A- still works', (tester) async {
    final handle = tester.ensureSemantics();
    final h = await pump(tester, 3);
    expect(key(tester, NtaCopy.larger).flagsCollection.isEnabled, Tristate.isFalse);
    expect(key(tester, NtaCopy.smaller).flagsCollection.isEnabled, Tristate.isTrue);

    await tester.tap(find.text('A+'));
    await settle(tester);
    expect(h.prefs.values['nta.textStep'], 3);

    await tester.tap(find.text('A−'));
    await settle(tester);
    expect(h.prefs.values['nta.textStep'], 2);
    expect(key(tester, NtaCopy.larger).flagsCollection.isEnabled, Tristate.isTrue);
    handle.dispose();
  });

  testWidgets('at the smallest size A- is unavailable', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester, 0);
    expect(key(tester, NtaCopy.smaller).flagsCollection.isEnabled, Tristate.isFalse);
    expect(key(tester, NtaCopy.larger).flagsCollection.isEnabled, Tristate.isTrue);
    handle.dispose();
  });
}
