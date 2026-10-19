import 'package:flutter/foundation.dart' show immutable;

import 'json_helpers.dart';

/// `GET /api/auth/me` [API 2.1]. `id` is the MockMob user id, not the Supabase uuid.
class AuthUser {
  const AuthUser({
    required this.id,
    this.name,
    this.email,
    this.image,
    this.subjects = const [],
    this.role = 'student',
    this.creditBalance,
    this.subscriptionStatus,
    this.isPremium = false,
    this.premiumUntil,
    this.playSubscription,
  });

  factory AuthUser.fromJson(Json j) => AuthUser(
        id: asStringOr(j['id'], ''),
        name: asString(j['name']),
        email: asString(j['email']),
        image: asString(j['image']),
        subjects: asStringList(j['subjects']),
        role: asStringOr(j['role'], 'student'),
        creditBalance: asInt(j['creditBalance']),
        subscriptionStatus: asString(j['subscriptionStatus']),
        isPremium: asBool(j['isPremium']) ?? false,
        premiumUntil: asDate(j['premiumUntil']),
        playSubscription: PlaySubscriptionInfo.fromJson(j['playSubscription']),
      );

  final String id;
  final String? name;
  final String? email;
  final String? image;
  final List<String> subjects;
  final String role;

  /// Practice-credit ledger, not the explanation wallet.
  final int? creditBalance;
  final String? subscriptionStatus;
  final bool isPremium;
  final DateTime? premiumUntil;

  /// Monthly Pro bought through Google Play, as the server last heard it from Google. Null when the
  /// account has none (or the server is older than the 19 Oct 2026 subscription work).
  final PlaySubscriptionInfo? playSubscription;
}

/// A Google Play subscription as the server reports it (`playSubscription` on `/api/auth/me`, and
/// `subscription` in the Play verify answer). The renewal lives in Google Play, so the app only says
/// where it stands and opens Google Play's own page to change it.
@immutable
class PlaySubscriptionInfo {
  const PlaySubscriptionInfo({
    required this.productId,
    required this.state,
    required this.active,
    this.autoRenewing,
    this.expiresAt,
    this.inGracePeriod = false,
    this.onHold = false,
  });

  /// Null unless [v] is a map naming a product.
  static PlaySubscriptionInfo? fromJson(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final productId = asString(j['productId']);
    if (productId == null || productId.isEmpty) return null;
    return PlaySubscriptionInfo(
      productId: productId,
      state: asStringOr(j['state'], 'unknown'),
      active: asBool(j['active']) ?? false,
      autoRenewing: asBool(j['autoRenewing']),
      expiresAt: asDate(j['expiresAt']),
      inGracePeriod: asBool(j['inGracePeriod']) ?? false,
      onHold: asBool(j['onHold']) ?? false,
    );
  }

  final String productId;

  /// Google's state in lower case without its prefix: active, canceled, in_grace_period, on_hold,
  /// paused, expired.
  final String state;

  /// Google says it gives Pro now.
  final bool active;

  /// False once the student turned renewal off (Pro still runs to [expiresAt]).
  final bool? autoRenewing;
  final DateTime? expiresAt;
  final bool inGracePeriod;
  final bool onHold;

  /// Pro runs on, but nothing more will be charged.
  bool get renewalOff => active && autoRenewing == false;

  Json toJson() => {
        'productId': productId,
        'state': state,
        'active': active,
        'autoRenewing': autoRenewing,
        'expiresAt': expiresAt?.toIso8601String(),
        'inGracePeriod': inGracePeriod,
        'onHold': onHold,
      };

  @override
  bool operator ==(Object other) =>
      other is PlaySubscriptionInfo &&
      other.productId == productId &&
      other.state == state &&
      other.active == active &&
      other.autoRenewing == autoRenewing &&
      other.expiresAt == expiresAt &&
      other.inGracePeriod == inGracePeriod &&
      other.onHold == onHold;

  @override
  int get hashCode => Object.hash(productId, state, active, autoRenewing, expiresAt, inGracePeriod, onHold);
}

class AuthMe {
  const AuthMe({required this.user, required this.needsOnboarding});

  factory AuthMe.fromJson(Json j) {
    final u = j['user'];
    return AuthMe(
      user: u is Map ? AuthUser.fromJson(asJson(u)) : null,
      needsOnboarding: asBool(j['needsOnboarding']) ?? false,
    );
  }

  /// Null when the server answered with no user (a 401 or 404 shaped body).
  final AuthUser? user;
  final bool needsOnboarding;
}
