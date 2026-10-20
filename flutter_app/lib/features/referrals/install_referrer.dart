// The Google Play install referrer (owner D165 + D182). A friend who follows a MockMob invite to the Play Store page keeps the
// invite across the install: the website sends them to
//
//   https://play.google.com/store/apps/details?id=in.mockmob.app&referrer=invite%3D<7-character code>
//
// and Play hands the app the decoded `invite=<code>` on its first launch. The app keeps it as the pending invite (source
// 'link'), and the referral claimer hands it to the server once the student is signed in (referral_data.dart). Android only;
// read once per install, with a timeout of a few seconds; a failure never reaches the student.

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

/// The invite an install referrer carries, or null. The website sends `invite=<7-character friend code>` and nothing else
/// (src/lib/referrals/friendInvite.mjs, playInviteUrl); Play hands it over decoded, alone or beside other parameters (Play's own
/// `utm_source=google-play&utm_medium=organic` carries no invite). The code is read the way the server reads it (Crockford: O
/// is 0, I and L are 1); anything that is not a friend's code is ignored, and one bad parameter never hides a good one. A
/// click older than the pending invite's life is dropped; a click time in the future (a wrong clock) counts as now.
PendingInvite? inviteFromInstallReferrer(String? referrer, {required DateTime now, DateTime? clickedAt}) {
  final raw = referrer?.trim();
  if (raw == null || raw.isEmpty || raw.length > 512) return null;
  String? value = _inviteParam(raw);
  // A referrer encoded twice (invite%3DK7P2M9X) reads once more.
  if (value == null && !raw.contains('=') && raw.contains('%')) {
    final decoded = _decode(raw);
    if (decoded != null) value = _inviteParam(decoded);
  }
  final code = normaliseInviteCode(value);
  if (code == null || !isFriendCode(code)) return null;
  final at = clickedAt == null || clickedAt.isAfter(now) ? now : clickedAt;
  if (now.difference(at) > PendingInviteStore.life) return null;
  return PendingInvite(code: code, source: 'link', at: at);
}

String? _decode(String text) {
  try {
    return Uri.decodeQueryComponent(text);
  } on Object {
    return null;
  }
}

/// The first `invite=` value in a query string. Each pair is read on its own, so a pair that does not decode (`utm_term=100%`)
/// is skipped instead of failing the whole string.
String? _inviteParam(String query) {
  for (final pair in query.split('&')) {
    final eq = pair.indexOf('=');
    if (eq <= 0) continue;
    final key = _decode(pair.substring(0, eq))?.trim().toLowerCase();
    if (key != 'invite') continue;
    final value = _decode(pair.substring(eq + 1));
    if (value != null) return value;
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
    this.readTimeout = defaultReadTimeout,
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
  static const Duration defaultReadTimeout = Duration(seconds: 5);

  /// How long Play is given to answer (a test shortens it).
  final Duration readTimeout;

  /// The invite kept from this install's referrer, or null (not Android, already read, no invite, or Play could not answer;
  /// a Play that cannot answer is asked again on the next launch, up to [maxTries] times).
  Future<PendingInvite?> run() async {
    if (!_isAndroid) return null;
    try {
      if (await prefs.getBool(doneKey) == true) return null;
      final InstallReferrerRead read;
      try {
        // Play can be slow to answer: after a few seconds it counts as "could not answer" and is asked again next launch.
        read = await source.read().timeout(readTimeout);
      } on Object {
        final tries = (await prefs.getInt(triesKey) ?? 0) + 1;
        await prefs.setInt(triesKey, tries);
        if (tries >= maxTries) await prefs.setBool(doneKey, true);
        return null;
      }
      final invite = inviteFromInstallReferrer(read.referrer, now: _now(), clickedAt: read.clickedAt);
      // Kept before it is marked read: a phone that could not save it asks Play again on the next launch.
      if (invite != null) await store.capture(invite);
      await prefs.setBool(doneKey, true);
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
