import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/motion/reduced_motion.dart';

class _FixedOverride extends ReducedMotionOverride {
  _FixedOverride(this.value);

  final bool value;

  @override
  bool build() => value;
}

class _FakeDriver implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

void main() {
  group('Haptics', () {
    test('maps the four verbs', () async {
      final driver = _FakeDriver();
      final haptics = Haptics(enabled: true, driver: driver);
      await haptics.tick();
      await haptics.settle();
      await haptics.open();
      await haptics.warn();
      expect(driver.calls, ['selection', 'light', 'medium', 'light', 'light']);
    });

    test('does nothing when touch feedback is off', () async {
      final driver = _FakeDriver();
      final haptics = Haptics(enabled: false, driver: driver);
      await haptics.tick();
      await haptics.settle();
      await haptics.open();
      await haptics.warn();
      expect(driver.calls, isEmpty);
    });

    test('provider follows the Touch feedback switch, default on', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(container.read(touchFeedbackProvider), isTrue);
      expect(container.read(hapticsProvider).enabled, isTrue);
      container.read(touchFeedbackProvider.notifier).set(false);
      expect(container.read(hapticsProvider).enabled, isFalse);
    });
  });

  group('Motion', () {
    testWidgets('keeps the spec tokens', (tester) async {
      expect(Motion.press, const Duration(milliseconds: 100));
      expect(Motion.release, const Duration(milliseconds: 140));
      expect(Motion.ui, const Duration(milliseconds: 200));
      expect(Motion.card, const Duration(milliseconds: 240));
      expect(Motion.result, const Duration(milliseconds: 320));
      expect(Motion.figureRoll, const Duration(milliseconds: 500));
      expect(Motion.milestone, const Duration(milliseconds: 500));
    });

    testWidgets('keeps the Night Sheet curves and durations (brief section 7)', (tester) async {
      expect(Motion.glide, const Cubic(0.15, 0.5, 0.5, 1));
      expect(Motion.glideDuration, const Duration(milliseconds: 300));
      expect(Motion.exit, const Cubic(0.4, 0.3, 0.8, 0.6));
      expect(Motion.exitDuration, const Duration(milliseconds: 200));
      expect(Motion.emphasized, const Cubic(0.16, 1, 0.3, 1));
      expect(Motion.emphasizedDuration, const Duration(milliseconds: 420));
      expect(Motion.sweep, const Duration(milliseconds: 700));
      expect(Motion.engrave, const Duration(milliseconds: 280));
      expect(Motion.numberRoll, const Duration(milliseconds: 500));
      expect(Springs.pressedScale, 0.96);
    });

    Future<bool> reducedWith(WidgetTester tester, {required bool system, required bool override}) async {
      late bool result;
      late Duration duration;
      await tester.pumpWidget(
        ProviderScope(
          key: UniqueKey(),
          overrides: [reducedMotionOverrideProvider.overrideWith(() => _FixedOverride(override))],
          child: MediaQuery(
            data: MediaQueryData(disableAnimations: system),
            child: ReducedMotionScope(
              child: Builder(
                builder: (context) {
                  result = Motion.reduced(context);
                  duration = Motion.of(context, Motion.ui);
                  return const SizedBox();
                },
              ),
            ),
          ),
        ),
      );
      expect(duration, result ? Duration.zero : Motion.ui);
      return result;
    }

    testWidgets('combines the system setting with the in-app override', (tester) async {
      expect(await reducedWith(tester, system: false, override: false), isFalse);
      expect(await reducedWith(tester, system: true, override: false), isTrue);
      expect(await reducedWith(tester, system: false, override: true), isTrue);
      expect(await reducedWith(tester, system: true, override: true), isTrue);
    });
  });
}
