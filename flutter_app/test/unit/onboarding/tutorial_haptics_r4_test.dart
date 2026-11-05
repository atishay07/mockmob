// R4 (owner, 5 Nov 2026): more haptics in the Mobi tutorial. The deck's Back arrow ticks, the swipe
// preview plays the drag verbs when a finger takes and lets go of the card, and the Touch feedback
// switch silences both. No demo buzz (the auto nudge stays silent, pinned in taste_v15_test).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/learn2/stage/stage_ticks.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/widgets/guide_bar.dart';
import 'package:mockmob/features/onboarding/widgets/swipe_preview.dart';

import '../../helpers/fonts.dart';

class _Driver implements HapticDriver, HapticVerbDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');

  @override
  Future<bool> perform(HapticVerb verb) async {
    calls.add(verb.name);
    return true;
  }
}

Future<void> _pump(WidgetTester tester, Widget child, _Driver driver, {bool enabled = true, Brightness brightness = Brightness.dark}) {
  return tester.pumpWidget(ProviderScope(
    overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: enabled, driver: driver))],
    child: MaterialApp(
      theme: buildTheme(brightness),
      builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
      home: Scaffold(body: child),
    ),
  ));
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('the GuideBar Back arrow fires one selection haptic, and none with Touch feedback off', (tester) async {
    var backs = 0;
    final on = _Driver();
    await _pump(tester, GuideBar(onBack: () => backs++, onSkip: null), on);
    await tester.tap(find.bySemanticsLabel(OnboardingCopy.back));
    await tester.pump();
    expect(backs, 1);
    expect(on.calls, ['selection']);

    final off = _Driver();
    await _pump(tester, GuideBar(onBack: () => backs++, onSkip: null), off, enabled: false);
    await tester.tap(find.bySemanticsLabel(OnboardingCopy.back));
    await tester.pump();
    expect(backs, 2);
    expect(off.calls, isEmpty);
  });

  testWidgets('the swipe preview takes and lets go of the card with the drag verbs', (tester) async {
    final d = _Driver();
    await _pump(tester, const Padding(padding: EdgeInsets.all(20), child: SwipePreviewCard()), d);
    final g = await tester.startGesture(tester.getCenter(find.byType(SwipePreviewCard)) - const Offset(0, 20));
    await g.moveBy(const Offset(20, 0));
    await g.moveBy(const Offset(10, 0));
    await tester.pump();
    expect(d.calls.first, 'gestureStart');
    await g.up();
    await tester.pumpAndSettle();
    expect(d.calls.last, 'gestureEnd');
    expect(d.calls.where((c) => c == 'gestureStart'), hasLength(1));
    expect(d.calls.where((c) => c == 'gestureEnd'), hasLength(1));
  });

  test('on Night the finished tick is brand green but not the same as the filling segment', () {
    final night = MmColors.dark;
    final done = night.accentText.withValues(alpha: 0.6);
    expect(done, isNot(night.volt));
    expect(StageTicks.ahead(night), isNot(done));
  });
}
