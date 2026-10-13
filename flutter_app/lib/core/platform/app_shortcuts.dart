import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:quick_actions/quick_actions.dart';

import '../auth/auth_state.dart' show AuthStatus;
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

/// The shortcuts for the current state: Resume only while a session can be resumed, then the
/// 10-minute repair and Practice 10. The launcher shows the first ones that fit.
List<ShortcutItem> shortcutItems({required bool hasResume}) => [
      if (hasResume) const ShortcutItem(type: AppShortcutType.resume, localizedTitle: 'Resume'),
      const ShortcutItem(type: AppShortcutType.repair, localizedTitle: '10-min repair'),
      const ShortcutItem(type: AppShortcutType.practice, localizedTitle: 'Practice 10'),
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
  Future<void> sync({required AuthStatus auth, required bool hasResume}) async {
    if (auth == AuthStatus.unknown) return;
    final signature = auth == AuthStatus.signedIn ? (hasResume ? 'resume' : 'plain') : 'none';
    if (signature == _synced) return;
    _synced = signature;
    try {
      if (auth == AuthStatus.signedIn) {
        await surface.set(shortcutItems(hasResume: hasResume));
      } else {
        await surface.clear();
      }
    } on Object {
      _synced = null;
    }
  }
}
