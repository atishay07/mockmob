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
