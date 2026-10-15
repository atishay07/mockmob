import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../motion/motion_tokens.g.dart';

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

/// Android's own haptic verbs (`HapticFeedbackConstants`), which a phone tunes to its motor: one
/// clean click for a confirm instead of two impacts. Names match `haptics.verbs` in
/// `shared/motion-tokens.json` and `HapticsChannel.kt`.
enum HapticVerb {
  /// Something is truly saved: the server acknowledged it (`CONFIRM`, Android 11+).
  confirm,

  /// A drag that commits has been picked up (`GESTURE_START`, Android 11+).
  gestureStart,

  /// That drag has been let go (`GESTURE_END`, Android 11+).
  gestureEnd,

  /// One stop of a dial or a scrub (`SEGMENT_TICK`, Android 14+).
  segmentTick,

  /// A switch turned on (`TOGGLE_ON`, Android 14+).
  toggleOn,

  /// A switch turned off (`TOGGLE_OFF`, Android 14+).
  toggleOff,
}

/// A driver that can also play [HapticVerb]s. [perform] answers false when this phone has no such
/// verb (an older Android), and [Haptics] then plays the verb's fallback through [HapticDriver].
abstract interface class HapticVerbDriver {
  Future<bool> perform(HapticVerb verb);
}

/// The phone: Flutter's `HapticFeedback` for the base calls, and the app's own channel
/// (`in.mockmob.app/haptics`, `HapticsChannel.kt`) for the verbs. Which verbs the phone has is asked
/// until it has been answered once, then kept.
class PlatformHapticDriver implements HapticDriver, HapticVerbDriver {
  const PlatformHapticDriver();

  static const MethodChannel channel = MethodChannel('in.mockmob.app/haptics');

  /// The answer, kept once it arrives. Only the answer is kept, never the question in flight: a
  /// question whose zone ended before the reply (a finished widget test) must not leave every
  /// later haptic waiting on a future that can no longer complete.
  static Set<HapticVerb>? _verbs;

  @visibleForTesting
  static void resetForTest() => _verbs = null;

  static Future<Set<HapticVerb>> _available() async {
    final known = _verbs;
    if (known != null) return known;
    try {
      final names = await channel.invokeListMethod<String>('verbs') ?? const <String>[];
      return _verbs = {
        for (final v in HapticVerb.values)
          if (names.contains(v.name)) v,
      };
    } on MissingPluginException {
      return _verbs = const {};
    } on PlatformException {
      return _verbs = const {};
    }
  }

  @override
  Future<void> selectionClick() => HapticFeedback.selectionClick();

  @override
  Future<void> lightImpact() => HapticFeedback.lightImpact();

  @override
  Future<void> mediumImpact() => HapticFeedback.mediumImpact();

  @override
  Future<bool> perform(HapticVerb verb) async {
    final verbs = await _available();
    if (!verbs.contains(verb)) return false;
    try {
      // The phone's own Touch feedback setting may silence it; that is still an answer, so the
      // fallback never plays on top.
      await channel.invokeMethod<bool>('perform', verb.name);
      return true;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }
}

/// The haptic grammar (Night Sheet brief, section 7; motion wave M1). Every call is skipped when
/// the in-app "Touch feedback" switch is off; the system setting is honoured by Android itself.
///
/// | Moment | Verb |
/// | --- | --- |
/// | Tab change, option select, unfold and drag thresholds, chips | [selection] (`selectionClick`) |
/// | Start, a flip, a primary commit | [light] (`lightImpact`) |
/// | The seal landing, the unfold opening, the finish stamp | [medium] (`mediumImpact`) |
/// | A stop of a dial or a scrub | [segmentTick] (`SEGMENT_TICK`, else `selectionClick`) |
/// | A switch turning on or off | [toggle] (`TOGGLE_ON` / `TOGGLE_OFF`, else `selectionClick`) |
/// | A commit drag picked up and let go | [gestureStart] / [gestureEnd] (Android 11+, else nothing) |
/// | Server acknowledged a submission, a repair, a milestone | [success] = [confirm] (only after the ack) |
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

  /// Something is truly saved. Call it only after the server acknowledged the work (brief section
  /// 10): one `CONFIRM` click where the phone has it (Android 11+), else today's pattern, a medium
  /// then a light impact 90 ms apart.
  Future<void> confirm() => _verb(HapticVerb.confirm, () async {
        await driver.mediumImpact();
        await Future<void>.delayed(MotionHaptics.confirmFallbackGap);
        await driver.lightImpact();
      });

  /// The success moment: one [confirm], after the server acknowledged the work.
  Future<void> success() => confirm();

  /// One stop of a dial or a scrub: `SEGMENT_TICK` (Android 14+), else `selectionClick`.
  Future<void> segmentTick() => _verb(HapticVerb.segmentTick, driver.selectionClick);

  /// A switch reaching [on]: `TOGGLE_ON` / `TOGGLE_OFF` (Android 14+), else `selectionClick`.
  Future<void> toggle(bool on) => _verb(on ? HapticVerb.toggleOn : HapticVerb.toggleOff, driver.selectionClick);

  /// A commit drag picked up: `GESTURE_START` (Android 11+), else nothing (as before).
  Future<void> gestureStart() => _verb(HapticVerb.gestureStart, null);

  /// That drag let go: `GESTURE_END` (Android 11+), else nothing (as before).
  Future<void> gestureEnd() => _verb(HapticVerb.gestureEnd, null);

  /// Destructive confirms: two light impacts 80 ms apart.
  Future<void> warn() async {
    if (!enabled) return;
    await driver.lightImpact();
    await Future<void>.delayed(MotionHaptics.warnGap);
    await driver.lightImpact();
  }

  Future<void> _verb(HapticVerb verb, Future<void> Function()? fallback) async {
    if (!enabled) return;
    final d = driver;
    if (d is HapticVerbDriver && await (d as HapticVerbDriver).perform(verb)) return;
    if (fallback != null) await fallback();
  }
}

final hapticsProvider = Provider<Haptics>((ref) => Haptics(enabled: ref.watch(touchFeedbackProvider)));

/// The app's [Haptics] from the nearest `ProviderScope`, or null outside one (a bare widget in a
/// test), so a motion primitive never needs Riverpod to build.
Haptics? hapticsOf(BuildContext context) {
  try {
    return ProviderScope.containerOf(context, listen: false).read(hapticsProvider);
  } catch (_) {
    return null;
  }
}
