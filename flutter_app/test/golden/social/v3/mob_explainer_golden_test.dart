// Goldens for the Mob explainer (owner D166, K9): every slide's end frame at 360 dp, Night and Day, and
// slide 3 at 1.3x text; plus a frame strip per slide (six timed moments of its stage, R5), Night and Day,
// and the reduced-motion strips of slides 2, 4 and 7 (the order is the same, the moves are fades).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/billing/billing.dart' show playBillingEnabledProvider;
import 'package:mockmob/features/social/v3/logic/explainer_flow.dart';
import 'package:mockmob/features/social/v3/screens/mob_explainer_screen.dart';
import 'package:mockmob/features/social/v3/widgets/explainer/ex_kit.dart';
import 'package:mockmob/features/social/v3/widgets/explainer/ex_slides.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';
import '../../you/you_golden_kit.dart';

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';
const _both = [Brightness.dark, Brightness.light];

/// The kit's clock (Thursday 22 Oct 2026, IST): the trap's game closes Sunday 25 Oct, the check is Wednesday 28.
final DateTime _now = v3Now;

/// Six moments of each slide (ms from the moment it lands).
const List<List<double>> stripTimes = [
  [200, 450, 700, 950, 1250, 1650],
  [600, 1300, 1800, 2400, 2800, 4400],
  [300, 700, 1000, 1400, 1900, 3000],
  [800, 1500, 2300, 3100, 3700, 4900],
  [600, 1200, 1800, 2300, 3000, 4400],
  [800, 1400, 1800, 2500, 3200, 4300],
  [500, 1000, 1250, 1500, 2300, 2950],
];

class _Strip extends StatelessWidget {
  const _Strip({required this.slide, required this.times, this.reduced = false});
  final int slide;
  final List<double> times;
  final bool reduced;

  static const double frameW = 180;
  static const double frameH = 202;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final fx = ExFx(night: c.isNight, lite: false, billingOn: true, now: _now);
    return Material(
      color: c.ground,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final ms in times)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${(ms / 1000).toStringAsFixed(2)} s', style: context.mmType.caption.copyWith(color: c.ink2)),
                    const SizedBox(height: 4),
                    Container(
                      width: frameW,
                      height: frameH,
                      decoration: BoxDecoration(border: Border.all(color: c.line)),
                      child: FittedBox(
                        child: SizedBox(
                          width: ExStage.w,
                          height: ExStage.h,
                          child: MediaQuery.withNoTextScaling(child: ExSlides.stage(context, slide, ExTime(ms, reduced: reduced), fx)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

void main() {
  setUpGoldenFonts();
  setUpAll(loadFoldManifestForTest);

  Future<void> shot(String name, Brightness b) => expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${_tag(b)}.png'));

  final extra = [playBillingEnabledProvider.overrideWithValue(true)];

  // Each slide's end frame, the whole screen.
  for (var i = 0; i < 7; i++) {
    for (final b in _both) {
      testWidgets('explainer slide ${i + 1} end 360 ${_tag(b)}', (tester) async {
        await pumpMockmob(tester, MobExplainerScreen(via: ExplainerVia.start, initialSlide: i, autoplay: false), brightness: b, size: const Size(360, 780), wrapInScaffold: false, overrides: socialOverrides(SocialServer(scenario: 'fresh'), extra: extra));
        final s = tester.state<MobExplainerScreenState>(find.byType(MobExplainerScreen));
        s.clocks[i].value = 1;
        await tester.pump();
        await settleImages(tester);
        await shot('ex_slide${i + 1}_end_360', b);
      });
    }
  }

  for (final b in _both) {
    testWidgets('explainer slide 3 at 1.3x text ${_tag(b)}', (tester) async {
      await pumpMockmob(tester, const MobExplainerScreen(via: ExplainerVia.start, initialSlide: 2, autoplay: false), brightness: b, size: const Size(360, 780), textScale: 1.3, wrapInScaffold: false, overrides: socialOverrides(SocialServer(scenario: 'fresh'), extra: extra));
      tester.state<MobExplainerScreenState>(find.byType(MobExplainerScreen)).clocks[2].value = 1;
      await tester.pump();
      await settleImages(tester);
      await shot('ex_slide3_end_360_x13', b);
    });

    testWidgets('explainer replay slide 7 ${_tag(b)}', (tester) async {
      await pumpMockmob(tester, const MobExplainerScreen(via: ExplainerVia.replay, initialSlide: 6, autoplay: false), brightness: b, size: const Size(360, 780), wrapInScaffold: false, overrides: socialOverrides(SocialServer(), extra: extra));
      tester.state<MobExplainerScreenState>(find.byType(MobExplainerScreen)).clocks[6].value = 1;
      await tester.pump();
      await settleImages(tester);
      await shot('ex_slide7_replay_360', b);
    });
  }

  // Frame strips (R5).
  for (var i = 0; i < 7; i++) {
    for (final b in _both) {
      testWidgets('explainer strip slide ${i + 1} ${_tag(b)}', (tester) async {
        await pumpMockmob(tester, _Strip(slide: i, times: stripTimes[i]), brightness: b, size: const Size(6 * 188.0 + 16, 240), wrapInScaffold: false, overrides: socialOverrides(SocialServer(scenario: 'fresh'), extra: extra));
        await settleImages(tester);
        await shot('ex_strip_slide${i + 1}', b);
      });
    }
  }
  for (final i in [1, 3, 6]) {
    testWidgets('explainer strip slide ${i + 1} reduced night', (tester) async {
      final times = [for (final t in stripTimes[i]) t * 0.5];
      await pumpMockmob(tester, _Strip(slide: i, times: times, reduced: true), brightness: Brightness.dark, size: const Size(6 * 188.0 + 16, 240), wrapInScaffold: false, overrides: socialOverrides(SocialServer(scenario: 'fresh'), extra: extra));
      await settleImages(tester);
      await shot('ex_strip_slide${i + 1}_reduced', Brightness.dark);
    });
  }
}
