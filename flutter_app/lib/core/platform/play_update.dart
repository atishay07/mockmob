import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:in_app_update/in_app_update.dart';

import 'native_prefs.dart';

/// What Play says about the installed build.
class PlayUpdateOffer {
  const PlayUpdateOffer({required this.flexibleAllowed, required this.downloaded, this.downloading = false});

  /// A newer build exists and Play allows a flexible (background) update.
  final bool flexibleAllowed;

  /// A newer build is already downloaded and only needs installing.
  final bool downloaded;

  /// A download started earlier (maybe before the app was last closed) is still running.
  final bool downloading;
}

/// Play could not be asked (offline, Play services busy, a timeout). Not the same as "no update".
class PlayCheckFailed implements Exception {
  const PlayCheckFailed();

  @override
  String toString() => 'PlayCheckFailed';
}

/// Google Play in-app updates. Swapped for a fake in tests.
abstract class PlayUpdateGateway {
  /// The offer, or null when Play answered that there is none or this is not a Play install (a
  /// sideloaded build on web, iOS or a non-Android device). Throws [PlayCheckFailed] when Play
  /// could not be asked, so a failed check is never mistaken for "no update".
  Future<PlayUpdateOffer?> check();

  /// Asks Play to start the flexible download. True when the student accepted.
  Future<bool> startFlexible();

  /// Emits once when the download has finished and the update only needs installing.
  Stream<void> get downloaded;

  Future<void> install();
}

class InAppUpdateGateway implements PlayUpdateGateway {
  const InAppUpdateGateway();

  @override
  Future<PlayUpdateOffer?> check() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return null;
    try {
      final info = await InAppUpdate.checkForUpdate();
      if (info.installStatus == InstallStatus.downloaded) {
        return const PlayUpdateOffer(flexibleAllowed: true, downloaded: true);
      }
      if (info.installStatus == InstallStatus.downloading || info.installStatus == InstallStatus.pending) {
        return const PlayUpdateOffer(flexibleAllowed: true, downloaded: false, downloading: true);
      }
      if (info.updateAvailability != UpdateAvailability.updateAvailable) return null;
      return PlayUpdateOffer(flexibleAllowed: info.flexibleUpdateAllowed, downloaded: false);
    } on Object {
      // Not installed from Play, no Play services, or no network: the answer is not known.
      throw const PlayCheckFailed();
    }
  }

  @override
  Future<bool> startFlexible() async {
    try {
      return await InAppUpdate.startFlexibleUpdate() == AppUpdateResult.success;
    } on Object {
      return false;
    }
  }

  @override
  Stream<void> get downloaded =>
      InAppUpdate.installUpdateListener.where((s) => s == InstallStatus.downloaded).map<void>((_) {}).handleError((Object _) {});

  @override
  Future<void> install() async {
    try {
      await InAppUpdate.completeFlexibleUpdate();
    } on Object {
      // Play installs it on the next launch anyway.
    }
  }
}

/// A quiet flexible update: a new download is offered at most once a day and never while the
/// student is in the middle of a session. A finished download is installed only when the app is
/// hidden, so it never restarts the app under someone who is studying. A sideloaded build never
/// sees any of it.
class PlayUpdateRunner {
  PlayUpdateRunner({required this.gateway, required this.prefs, required this.now, required this.sessionOpen});

  static const Duration spacing = Duration(hours: 24);

  final PlayUpdateGateway gateway;
  final NativePrefs prefs;
  final DateTime Function() now;

  /// True while a session can be resumed: the update dialog and the install both wait.
  final bool Function() sessionOpen;

  bool _ready = false;
  bool _started = false;
  bool _hidden = false;
  StreamSubscription<void>? _sub;

  /// True once a downloaded update is waiting for the app to go to the background.
  bool get readyToInstall => _ready;

  /// On app start. Always asks Play what it has (a local, cheap question) so a download that
  /// finished while the app was closed is picked up; only a new download is limited to once a day.
  Future<void> onStart() async {
    if (_started || sessionOpen()) return;
    _started = true;
    try {
      final PlayUpdateOffer? offer;
      try {
        offer = await gateway.check();
      } on Object {
        // Could not ask (offline, Play busy): nothing is stamped, so the next launch asks again.
        return;
      }
      if (offer == null) return;
      if (offer.downloaded) {
        _markReady();
        return;
      }
      if (offer.downloading) {
        _listen();
        return;
      }
      if (!offer.flexibleAllowed) return;
      final last = await prefs.updateCheckedAt();
      final at = now();
      if (last != null && at.difference(last) < spacing) return;
      await prefs.setUpdateCheckedAt(at);
      _listen();
      if (!await gateway.startFlexible()) await _drop();
    } on Object {
      // An update is never worth a visible failure.
    }
  }

  /// When the app leaves the screen: install a finished download, unless a session is open.
  Future<void> onBackground() async {
    _hidden = true;
    if (!_ready || sessionOpen()) return;
    _ready = false;
    await gateway.install();
  }

  /// When the app comes back to the screen.
  void onForeground() => _hidden = false;

  void _listen() {
    _sub ??= gateway.downloaded.listen((_) => _markReady());
  }

  /// A download is finished. If the student already left the app, install now: nothing else
  /// would run [onBackground] again until the next time they leave.
  void _markReady() {
    _ready = true;
    if (_hidden) unawaited(onBackground());
  }

  Future<void> _drop() async {
    await _sub?.cancel();
    _sub = null;
  }

  Future<void> dispose() => _drop();
}
