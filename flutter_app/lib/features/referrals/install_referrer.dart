// The Google Play install referrer (owner D165 + D182). A friend who follows a MockMob invite to the Play Store page keeps the
// invite across the install: the website sends them to
//
//   https://play.google.com/store/apps/details?id=in.mockmob.app&referrer=invite%3D<7-character code>
//
// and Play hands the app `invite=<code>` on its first launch. The app keeps it as the pending invite (source 'link'), and the
// referral claimer hands it to the server once the student is signed in (referral_data.dart). Android only; read once per
// install; a failure never reaches the student.

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:play_install_referrer/play_install_referrer.dart';

import '../../core/storage/prefs_store.dart';
import 'referral_data.dart';

/// What Play said: the referrer string and when the link was tapped (null when Play gave no time).
class InstallReferrerRead {
  const InstallReferrerRead({this.referrer, this.clickedAt});

  final String? referrer;
  final DateTime? clickedAt;
}

/// Reads the install referrer. The one place the plugin is touched, so everything else is testable without a phone.
abstract class InstallReferrerSource {
  Future<InstallReferrerRead> read();
}

class PlayInstallReferrerSource implements InstallReferrerSource {
  const PlayInstallReferrerSource();

  @override
  Future<InstallReferrerRead> read() async {
    final d = await PlayInstallReferrer.installReferrer;
    final seconds = d.referrerClickTimestampSeconds;
    return InstallReferrerRead(
      referrer: d.installReferrer,
      clickedAt: seconds > 0 ? DateTime.fromMillisecondsSinceEpoch(seconds * 1000) : null,
    );
  }
}

/// The invite an install referrer carries (`invite=<code>`, alone or among other parameters, such as Play's own
/// `utm_source=google-play&utm_medium=organic` that carries none), or null. A friend's code (7 characters) is a link; a Mob
/// invite code (6 or 8) is a Mob invite, as for a link opened in the app. A click older than the pending invite's life
/// is dropped; a click time in the future (a wrong clock) counts as now.
PendingInvite? inviteFromInstallReferrer(String? referrer, {required DateTime now, DateTime? clickedAt}) {
  final raw = referrer?.trim();
  if (raw == null || raw.isEmpty || raw.length > 512) return null;
  String? value = _inviteParam(raw);
  // A referrer encoded twice (invite%3DK7P2M9X) reads once more.
  if (value == null && !raw.contains('=') && raw.contains('%')) {
    try {
      value = _inviteParam(Uri.decodeComponent(raw));
    } on Object {
      value = null;
    }
  }
  final code = normaliseInviteCode(value);
  if (code == null) return null;
  final at = clickedAt == null || clickedAt.isAfter(now) ? now : clickedAt;
  if (now.difference(at) > PendingInviteStore.life) return null;
  return PendingInvite(code: code, source: isFriendCode(code) ? 'link' : 'mob_invite', at: at);
}

String? _inviteParam(String query) {
  try {
    final params = Uri.splitQueryString(query);
    for (final e in params.entries) {
      if (e.key.toLowerCase() == 'invite') return e.value;
    }
  } on Object {
    // Not a query string.
  }
  return null;
}

/// Reads the install referrer once per install (Android only) and keeps the invite it carries.
class InstallReferrerCapture {
  InstallReferrerCapture({
    required this.source,
    required this.store,
    required this.prefs,
    DateTime Function()? now,
    bool? isAndroid,
  })  : _now = now ?? DateTime.now,
        _isAndroid = isAndroid ?? (!kIsWeb && defaultTargetPlatform == TargetPlatform.android);

  final InstallReferrerSource source;
  final PendingInviteStore store;
  final PrefsStore prefs;
  final DateTime Function() _now;
  final bool _isAndroid;

  static const String doneKey = 'referral_referrer_done';
  static const String triesKey = 'referral_referrer_tries';
  static const int maxTries = 3;

  /// The invite kept from this install's referrer, or null (not Android, already read, no invite, or Play could not answer;
  /// a Play that cannot answer is asked again on the next launch, up to [maxTries] times).
  Future<PendingInvite?> run() async {
    if (!_isAndroid) return null;
    try {
      if (await prefs.getBool(doneKey) == true) return null;
      final InstallReferrerRead read;
      try {
        read = await source.read();
      } on Object {
        final tries = (await prefs.getInt(triesKey) ?? 0) + 1;
        await prefs.setInt(triesKey, tries);
        if (tries >= maxTries) await prefs.setBool(doneKey, true);
        return null;
      }
      await prefs.setBool(doneKey, true);
      final invite = inviteFromInstallReferrer(read.referrer, now: _now(), clickedAt: read.clickedAt);
      if (invite == null) return null;
      await store.capture(invite);
      return invite;
    } on Object {
      return null;
    }
  }
}

final installReferrerSourceProvider = Provider<InstallReferrerSource>((ref) => const PlayInstallReferrerSource());

/// Reads the install referrer on a first launch and, when it carried an invite, hands it over at once if the student is
/// already signed in (otherwise the claimer does it at sign-in). Started by [referralClaimerProvider].
final referralInstallReferrerProvider = Provider<void>((ref) {
  final capture = InstallReferrerCapture(
    source: ref.read(installReferrerSourceProvider),
    store: ref.read(pendingInviteStoreProvider),
    prefs: ref.read(referralPrefsProvider),
  );
  unawaited(
    capture.run().then((invite) async {
      if (invite != null) await ref.read(referralClaimServiceProvider).claimPending();
    }).catchError((Object _) {}),
  );
});
