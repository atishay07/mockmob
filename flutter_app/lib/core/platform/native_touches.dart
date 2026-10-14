import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart' show nowProvider;
import '../auth/auth_state.dart';
import '../domain/session_rules.dart' show submissionGraceMs;
import '../models/session_draft.dart' show SessionDraft;
import '../repositories/session_draft_repository.dart' show latestSessionDraftProvider;
import '../router/quick_start.dart' show quickStartRepairProvider, resumeDraftProvider;
import '../router/router.dart' show intendedRouteProvider, routerProvider;
import 'app_shortcuts.dart';
import 'native_prefs.dart';
import 'play_update.dart';

final playUpdateGatewayProvider = Provider<PlayUpdateGateway>((ref) => const InAppUpdateGateway());

/// Starts the native touches that run for the whole life of the app: launcher shortcuts, the
/// quiet Play update and the first-run mark the review prompt counts from. Watch it once from
/// the app root (`ref.watch(nativeTouchesProvider)`).
final nativeTouchesProvider = Provider<NativeTouches>((ref) {
  final touches = NativeTouches(ref)..start();
  ref.onDispose(touches.dispose);
  return touches;
});

class NativeTouches {
  NativeTouches(this._ref);

  final Ref _ref;
  late final ShortcutDispatcher shortcuts;
  late final PlayUpdateRunner updates;
  AppLifecycleListener? _lifecycle;
  final List<ProviderSubscription<Object?>> _subs = [];

  /// The open session the resume provider last reported, with the wall-clock time after which it
  /// can no longer be resumed. The provider only recomputes when the draft row changes, so this
  /// is never trusted on its own: [_resumeSessionId] checks it against the clock on every read.
  ({String id, int untilMs})? _resume;
  Timer? _resumeExpiry;
  String? _repairLocation;

  /// The id of the session that can be resumed right now, or null once its time has run out.
  String? get _resumeSessionId {
    final resume = _resume;
    if (resume == null) return null;
    return resume.untilMs > _ref.read(nowProvider)().millisecondsSinceEpoch ? resume.id : null;
  }

  AuthStatus get _auth => _ref.read(authSnapshotProvider).status;

  void start() {
    final prefs = _ref.read(nativePrefsProvider);
    shortcuts = ShortcutDispatcher(
      surface: _ref.read(shortcutSurfaceProvider),
      read: () => ShortcutSnapshot(auth: _auth, resumeSessionId: _resumeSessionId, repairLocation: _repairLocation),
      go: _open,
      now: _ref.read(nowProvider),
    );
    updates = PlayUpdateRunner(
      gateway: _ref.read(playUpdateGatewayProvider),
      prefs: prefs,
      now: _ref.read(nowProvider),
      sessionOpen: () => _resumeSessionId != null,
    );

    _subs
      ..add(_ref.listen<({String id, int untilMs})?>(
        resumeDraftProvider.select((d) => d == null ? null : (id: d.sessionId, untilMs: _resumableUntilMs(d))),
        (_, resume) {
          _resume = resume;
          _watchExpiry();
          _sync();
        },
        fireImmediately: true,
      ))
      ..add(_ref.listen<String?>(quickStartRepairProvider.select((r) => r?.shortcutLocation), (_, location) {
        _repairLocation = location;
        _sync();
      }, fireImmediately: true))
      ..add(_ref.listen<AuthStatus>(authSnapshotProvider.select((s) => s.status), (_, status) {
        _sync();
        if (status != AuthStatus.unknown) unawaited(shortcuts.replayPending());
      }));
    _lifecycle = AppLifecycleListener(
      onHide: () => unawaited(updates.onBackground()),
      onShow: () {
        updates.onForeground();
        // A timer can be late while the app was away: look at the clock again.
        _sync();
      },
    );

    unawaited(shortcuts.start());
    // After the first frame and the first read of the open session, so the update dialog never
    // lands on a session in progress.
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_afterFirstFrame(prefs)));
  }

  Future<void> _afterFirstFrame(NativePrefs prefs) async {
    try {
      await prefs.markFirstSeen(_ref.read(nowProvider)());
      _sync();
      await _settled();
      if (_ref.mounted) await updates.onStart();
    } on Object {
      // None of this is worth a visible failure.
    }
  }

  /// Waits (a few seconds at most) until the account and its open session are known.
  Future<void> _settled() async {
    for (var i = 0; _auth == AuthStatus.unknown && i < 24 && _ref.mounted; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }
    if (!_ref.mounted || _auth != AuthStatus.signedIn) return;
    try {
      await _ref.read(latestSessionDraftProvider.future).timeout(const Duration(seconds: 2));
      await Future<void>.delayed(const Duration(milliseconds: 50));
    } on Object {
      // Unknown means no open session as far as the update is concerned.
    }
  }

  /// The last wall-clock millisecond a draft can resume: its deadline, or the end of the submit
  /// grace while a submit is pending (the same rule as `resumableDraft`).
  static int _resumableUntilMs(SessionDraft d) => d.pendingSubmission ? d.endsAtWallMs + submissionGraceMs : d.endsAtWallMs;

  /// Re-syncs the launcher the moment the open session stops being resumable, so the Resume
  /// shortcut does not outlive the mock.
  void _watchExpiry() {
    _resumeExpiry?.cancel();
    _resumeExpiry = null;
    final resume = _resume;
    if (resume == null) return;
    final left = resume.untilMs - _ref.read(nowProvider)().millisecondsSinceEpoch;
    if (left <= 0) return;
    _resumeExpiry = Timer(Duration(milliseconds: left + 50), _sync);
  }

  void _sync() => unawaited(shortcuts.sync(auth: _auth, hasResume: _resumeSessionId != null, repairLocation: _repairLocation));

  /// Opens a shortcut's location: remembered while the account is unknown, else `router.go`.
  void _open(String location) {
    if (_auth == AuthStatus.unknown) {
      _ref.read(intendedRouteProvider).remember(location);
    } else {
      _ref.read(routerProvider).go(location);
    }
  }

  void dispose() {
    _resumeExpiry?.cancel();
    _lifecycle?.dispose();
    for (final sub in _subs) {
      sub.close();
    }
    unawaited(updates.dispose());
  }
}
