import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:in_app_update/in_app_update.dart';

import 'native_prefs.dart';

/// What Play says about the installed build.
class PlayUpdateOffer {
  const PlayUpdateOffer({required this.flexibleAllowed, required this.downloaded});

  /// A newer build exists and Play allows a flexible (background) update.
  final bool flexibleAllowed;

  /// A newer build is already downloaded and only needs installing.
  final bool downloaded;
}

/// Google Play in-app updates. Swapped for a fake in tests.
abstract class PlayUpdateGateway {
  /// The offer, or null when there is none or this is not a Play install (a sideloaded build,
  /// an emulator without Play, iOS, web). Never throws.
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
      if (info.updateAvailability != UpdateAvailability.updateAvailable) return null;
      return PlayUpdateOffer(flexibleAllowed: info.flexibleUpdateAllowed, downloaded: false);
    } on Object {
      // Not installed from Play, no Play services, or no network: nothing to offer.
      return null;
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

/// A quiet flexible update: at most one check a day, started while the student is not in the
/// middle of a session, installed only when the app goes to the background so it never restarts
/// the app under someone who is studying. A sideloaded build never sees any of it.
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
  StreamSubscription<void>? _sub;

  /// True once a downloaded update is waiting for the app to go to the background.
  bool get readyToInstall => _ready;

  /// On app start.
  Future<void> onStart() async {
    if (_started || sessionOpen()) return;
    try {
      final last = await prefs.updateCheckedAt();
      final at = now();
      if (last != null && at.difference(last) < spacing) return;
      _started = true;
      await prefs.setUpdateCheckedAt(at);
      final offer = await gateway.check();
      if (offer == null) return;
      if (offer.downloaded) {
        _ready = true;
        return;
      }
      if (!offer.flexibleAllowed) return;
      _sub = gateway.downloaded.listen((_) => _ready = true);
      if (!await gateway.startFlexible()) await _drop();
    } on Object {
      // An update is never worth a visible failure.
    }
  }

  /// When the app leaves the screen: install a finished download, unless a session is open.
  Future<void> onBackground() async {
    if (!_ready || sessionOpen()) return;
    _ready = false;
    await gateway.install();
  }

  Future<void> _drop() async {
    await _sub?.cancel();
    _sub = null;
  }

  Future<void> dispose() => _drop();
}
