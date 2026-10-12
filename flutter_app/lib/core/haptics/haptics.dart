import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The in-app "Touch feedback" switch (spec 3.3). On by default. The You module persists it.
class TouchFeedbackSwitch extends Notifier<bool> {
  @override
  bool build() => true;

  void set(bool value) => state = value;
}

final touchFeedbackProvider = NotifierProvider<TouchFeedbackSwitch, bool>(TouchFeedbackSwitch.new);

/// How a haptic reaches the phone. Replaced by a fake in tests.
abstract interface class HapticDriver {
  Future<void> selectionClick();
  Future<void> lightImpact();
  Future<void> mediumImpact();
}

class PlatformHapticDriver implements HapticDriver {
  const PlatformHapticDriver();

  @override
  Future<void> selectionClick() => HapticFeedback.selectionClick();

  @override
  Future<void> lightImpact() => HapticFeedback.lightImpact();

  @override
  Future<void> mediumImpact() => HapticFeedback.mediumImpact();
}

/// The haptic vocabulary: three verbs plus a guard (spec 3.3). Every call is skipped when the
/// in-app "Touch feedback" switch is off. The system setting is honoured by Android itself.
/// Errors and wrong answers have no haptic.
class Haptics {
  const Haptics({required this.enabled, this.driver = const PlatformHapticDriver()});

  final bool enabled;
  final HapticDriver driver;

  /// Tab change, option select, time chooser, palette cell, recap card snap, sheet drag thresholds.
  Future<void> tick() async {
    if (enabled) await driver.selectionClick();
  }

  /// Key commit on release, an acknowledged repair step, a 5-minute or 1-minute warning.
  Future<void> settle() async {
    if (enabled) await driver.lightImpact();
  }

  /// Sheet opened, submission acknowledged by the server, repair finished, weekly goal met.
  Future<void> open() async {
    if (enabled) await driver.mediumImpact();
  }

  /// Destructive confirms: two light impacts 80 ms apart.
  Future<void> warn() async {
    if (!enabled) return;
    await driver.lightImpact();
    await Future<void>.delayed(const Duration(milliseconds: 80));
    await driver.lightImpact();
  }
}

final hapticsProvider = Provider<Haptics>((ref) => Haptics(enabled: ref.watch(touchFeedbackProvider)));
