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

/// The haptic vocabulary (Night Sheet brief, section 7). Every call is skipped when the in-app
/// "Touch feedback" switch is off; the system setting is honoured by Android itself.
///
/// | Moment | Verb |
/// | --- | --- |
/// | Tab change, option select, unfold and drag thresholds, chips | [selection] (`selectionClick`) |
/// | Start, a flip, a primary commit | [light] (`lightImpact`) |
/// | The seal landing, the unfold opening, the finish stamp | [medium] (`mediumImpact`) |
/// | Server acknowledged a submission, a repair, a milestone | [success] (only after the ack) |
///
/// Opening a sheet gets nothing: the tap that opened it already ticked (MOTION.md 1.6). Nothing on
/// a wrong answer and nothing on errors.
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

  /// The seal landing, the unfold opening, the finish stamp. Not a sheet opening.
  Future<void> open() async {
    if (enabled) await driver.mediumImpact();
  }

  /// `selectionClick`: tab change, option, thresholds.
  Future<void> selection() => tick();

  /// `lightImpact`: Start, flips, commits.
  Future<void> light() => settle();

  /// `mediumImpact`: the seal completes.
  Future<void> medium() => open();

  /// The success pattern: a medium then a light impact 90 ms apart. Call it only after the
  /// server acknowledged the work (brief section 10).
  Future<void> success() async {
    if (!enabled) return;
    await driver.mediumImpact();
    await Future<void>.delayed(const Duration(milliseconds: 90));
    await driver.lightImpact();
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
