import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quick_actions/quick_actions.dart';

import '../auth/auth_state.dart' show AuthStatus;
import '../domain/repair_candidates.dart' show repairDurationOptions;
import '../router/action_router.dart';

/// The launcher's shortcut list (long-press on the app icon). Swapped for a fake in tests.
abstract class ShortcutSurface {
  /// Registers [onType]; Android also delivers the shortcut that launched the app, right away.
  Future<void> initialize(void Function(String type) onType);
  Future<void> set(List<ShortcutItem> items);
  Future<void> clear();
}

class QuickActionsSurface implements ShortcutSurface {
  const QuickActionsSurface();

  @override
  Future<void> initialize(void Function(String type) onType) => const QuickActions().initialize(onType);

  @override
  Future<void> set(List<ShortcutItem> items) => const QuickActions().setShortcutItems(items);

  @override
  Future<void> clear() => const QuickActions().clearShortcutItems();
}

final shortcutSurfaceProvider = Provider<ShortcutSurface>((ref) => const QuickActionsSurface());

/// The launcher icons, by drawable name: android/app/src/main/res/drawable/ic_shortcut_*.xml.
/// The quick_actions plugin looks them up by name, so res/raw/keep.xml keeps them from resource
/// shrinking.
abstract final class ShortcutIcons {
  static const String resume = 'ic_shortcut_resume';
  static const String repair = 'ic_shortcut_repair';
  static const String practice = 'ic_shortcut_practice';
}

/// True when [repairLocation] opens a repair of exactly what the 10-minute chip holds (Today's
/// table: 3 mistakes). With fewer open mistakes the table has no 10-minute chip and the repair
/// is shorter, so the shortcut must not promise 10 minutes.
bool opensTenMinuteRepair(String? repairLocation) {
  final raw = repairLocation == null ? null : Uri.tryParse(repairLocation)?.queryParameters['count'];
  final count = raw == null ? null : int.tryParse(raw);
  if (count == null) return false;
  return repairDurationOptions(count).any((o) => o.minutes == 10 && o.mistakes == count);
}

/// The shortcuts for the current state: Resume only while a session can be resumed, then the
/// repair and Practice 10. The launcher shows the first ones that fit. The repair says
/// "10-min repair" only when [tenMinuteRepair] (see [opensTenMinuteRepair]), else "Repair a
/// mistake".
List<ShortcutItem> shortcutItems({required bool hasResume, bool tenMinuteRepair = false}) => [
      if (hasResume) const ShortcutItem(type: AppShortcutType.resume, localizedTitle: 'Resume', icon: ShortcutIcons.resume),
      ShortcutItem(
        type: AppShortcutType.repair,
        localizedTitle: tenMinuteRepair ? '10-min repair' : 'Repair a mistake',
        icon: ShortcutIcons.repair,
      ),
      const ShortcutItem(type: AppShortcutType.practice, localizedTitle: 'Practice 10', icon: ShortcutIcons.practice),
    ];

/// What the dispatcher needs to know, read when it acts.
class ShortcutSnapshot {
  const ShortcutSnapshot({required this.auth, this.resumeSessionId, this.repairLocation});

  final AuthStatus auth;

  /// The open session that can be resumed, if any.
  final String? resumeSessionId;

  /// Tonight's first mistake (`/review/repair/...`), if there is one.
  final String? repairLocation;
}

/// Keeps the launcher shortcuts in step with the app and sends a tapped shortcut where it goes,
/// through [ActionRouter]. It handles both starts: a shortcut that launched the app waits until
/// the account is known (then it is replayed once, if still fresh), and one tapped while the app
/// is open goes at once. Signed out, a shortcut does nothing: the student is on sign-in.
class ShortcutDispatcher {
  ShortcutDispatcher({
    required this.surface,
    required this.read,
    required this.go,
    required this.now,
    Future<void> Function(Duration)? wait,
    this.resumePatience = const Duration(seconds: 3),
    this.repairPatience = const Duration(milliseconds: 1200),
  }) : _wait = wait ?? Future<void>.delayed;

  /// A shortcut that launched the app is forgotten after this long.
  static const Duration pendingMaxAge = Duration(minutes: 10);
  static const Duration _step = Duration(milliseconds: 150);

  final ShortcutSurface surface;
  final ShortcutSnapshot Function() read;

  /// Opens an in-app location (`router.go`).
  final void Function(String location) go;
  final DateTime Function() now;
  final Future<void> Function(Duration) _wait;

  /// How long a tap waits for the open session, or tonight's repair, to load on a cold start.
  final Duration resumePatience;
  final Duration repairPatience;

  String? _pending;
  DateTime? _pendingAt;
  String? _synced;

  /// Registers the tap handler. Call once.
  Future<void> start() async {
    try {
      await surface.initialize((type) => unawaited(handle(type)));
    } on Object {
      // No launcher shortcuts on this device: the app works the same.
    }
  }

  /// A shortcut was tapped.
  Future<void> handle(String type) async {
    if (!AppShortcutType.all.contains(type)) return;
    if (read().auth == AuthStatus.unknown) {
      _pending = type;
      _pendingAt = now();
      return;
    }
    await _run(type);
  }

  /// The account is known now: opens the shortcut that launched the app, once, if still fresh.
  Future<void> replayPending() async {
    final type = _pending;
    final at = _pendingAt;
    _pending = null;
    _pendingAt = null;
    if (type == null || at == null || now().difference(at) > pendingMaxAge) return;
    await _run(type);
  }

  Future<void> _run(String type) async {
    if (read().auth != AuthStatus.signedIn) return;
    final sessionId = type == AppShortcutType.resume ? await _until(() => read().resumeSessionId, resumePatience) : null;
    final repair = type == AppShortcutType.repair ? await _until(() => read().repairLocation, repairPatience) : null;
    final target = ActionRouter.forShortcut(type, sessionId: sessionId, repairLocation: repair);
    if (target is NativeTarget) go(target.location);
  }

  Future<String?> _until(String? Function() value, Duration patience) async {
    var waited = Duration.zero;
    var v = value();
    while (v == null && waited < patience) {
      await _wait(_step);
      waited += _step;
      v = value();
    }
    return v;
  }

  /// Puts the launcher list in step with the app: set while signed in, cleared on sign-out,
  /// untouched while the account is unknown so a cold launch still has its shortcuts.
  Future<void> sync({required AuthStatus auth, required bool hasResume, String? repairLocation}) async {
    if (auth == AuthStatus.unknown) return;
    final tenMinute = opensTenMinuteRepair(repairLocation);
    final signature = auth == AuthStatus.signedIn ? '${hasResume ? 'resume' : 'plain'}${tenMinute ? '-10' : ''}' : 'none';
    if (signature == _synced) return;
    _synced = signature;
    try {
      if (auth == AuthStatus.signedIn) {
        await surface.set(shortcutItems(hasResume: hasResume, tenMinuteRepair: tenMinute));
      } else {
        await surface.clear();
      }
    } on Object {
      _synced = null;
    }
  }
}
