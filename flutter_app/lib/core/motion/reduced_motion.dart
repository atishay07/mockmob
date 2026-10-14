import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The in-app "Reduce motion" override. Off by default. The You module persists it and
/// calls [ReducedMotionOverride.set]; the system "Remove animations" setting is read
/// separately through `MediaQuery.disableAnimations`.
class ReducedMotionOverride extends Notifier<bool> {
  @override
  bool build() => false;

  void set(bool value) => state = value;
}

final reducedMotionOverrideProvider = NotifierProvider<ReducedMotionOverride, bool>(ReducedMotionOverride.new);

/// Publishes the in-app override down the tree so widgets can combine it with the system
/// setting through `Motion.reduced(context)`. Wrap it around the app, below the `ProviderScope`
/// (see [ReducedMotionScope]).
class ReducedMotionSetting extends InheritedWidget {
  const ReducedMotionSetting({super.key, required this.enabled, required super.child});

  final bool enabled;

  /// The in-app override only. Prefer `Motion.reduced(context)`, which also checks the system.
  static bool of(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<ReducedMotionSetting>()?.enabled ?? false;
  }

  @override
  bool updateShouldNotify(ReducedMotionSetting oldWidget) => enabled != oldWidget.enabled;
}

/// Reads [reducedMotionOverrideProvider] and provides it as a [ReducedMotionSetting].
class ReducedMotionScope extends ConsumerWidget {
  const ReducedMotionScope({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ReducedMotionSetting(enabled: ref.watch(reducedMotionOverrideProvider), child: child);
  }
}
