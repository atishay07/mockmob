// The Credits contract (GET /api/me/credits, v1): the two pools a student spends from, the plan,
// and the history of every spend and top-up, newest first. The shared fixture
// `test/fixtures/credits/contract_credits_v1.json` is the parity contract with the server and the
// website; the parser here reads exactly that shape.
//
//   {"practice": {"balance": n, "renewsOn": "YYYY-MM-DD" | null, "label": "Practice credits"},
//    "ai":       {"balance": n, "renewsOn": "YYYY-MM-DD" | null, "label": "AI credits"},
//    "plan":     {"name": "Free" | "Pro", "until": "YYYY-MM-DD" | null},
//    "history":  [{"at": ISO, "pool": "practice" | "ai", "what": text, "delta": n, "balanceAfter": n}],
//    "nextCursor": string | null,
//    "total": {"balance": n | null, "freeLeft": n | null, "freeAllowance": n | null, "held": n | null,
//              "renewsOn": "YYYY-MM-DD" | null, "label": "Credits"}}
//
// "total" is the one credits balance (owner D78, release 10): present only on a server that keeps one
// balance, where practice.balance + ai.balance = total.balance and every history line's balanceAfter is
// that one balance (null for lines before this month). An older server sends no "total".
//
// A balance the server did not send is null and is never drawn as zero.

import '../../../core/models/json_helpers.dart';

/// The two credit names. There are no others anywhere in the app.
enum CreditPool {
  practice('Practice credits', 'Practice credit'),
  ai('AI credits', 'AI credit');

  const CreditPool(this.name, this.single);

  /// "Practice credits" or "AI credits".
  final String name;

  /// "Practice credit" or "AI credit", for a count of one.
  final String single;

  /// "1 AI credit", "3 AI credits".
  String count(int n) => n == 1 ? '1 $single' : '$n $name';

  static CreditPool? parse(Object? raw) => switch (raw) {
        'practice' => CreditPool.practice,
        'ai' => CreditPool.ai,
        _ => null,
      };
}

/// "2026-11-01" as a calendar date with no time zone, or null.
DateTime? creditsDate(Object? raw) {
  final s = asString(raw);
  if (s == null) return null;
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(s);
  if (m == null) return null;
  final y = int.parse(m.group(1)!);
  final mo = int.parse(m.group(2)!);
  final d = int.parse(m.group(3)!);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return DateTime(y, mo, d);
}

class CreditBalance {
  const CreditBalance({this.balance, this.renewsOn, required this.label});

  factory CreditBalance.fromJson(Object? raw, CreditPool pool) {
    final j = asJson(raw);
    return CreditBalance(
      balance: asInt(j['balance']),
      renewsOn: creditsDate(j['renewsOn']),
      // The server's label is read, but the app only ever shows its own two names.
      label: pool.name,
    );
  }

  /// Null when the server did not say. Never drawn as zero.
  final int? balance;
  final DateTime? renewsOn;
  final String label;
}

class CreditPlan {
  const CreditPlan({required this.name, this.until});

  factory CreditPlan.fromJson(Object? raw) {
    final j = asJson(raw);
    final name = asString(j['name']);
    return CreditPlan(name: name == 'Pro' ? 'Pro' : 'Free', until: creditsDate(j['until']));
  }

  /// "Free" or "Pro".
  final String name;
  final DateTime? until;

  bool get isPro => name == 'Pro';
}

/// The one credits balance (`total` in `GET /api/me/credits` on a one-balance server). Every number is null
/// when the server could not read it.
class CreditTotal {
  const CreditTotal({this.balance, this.freeLeft, this.freeAllowance, this.held, this.renewsOn});

  /// Null when the body has no `total` block (an older, two-pool server).
  static CreditTotal? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final j = asJson(raw);
    return CreditTotal(
      balance: asInt(j['balance']),
      freeLeft: asInt(j['freeLeft']),
      freeAllowance: asInt(j['freeAllowance']),
      held: asInt(j['held']),
      renewsOn: creditsDate(j['renewsOn']),
    );
  }

  final int? balance;
  final int? freeLeft;
  final int? freeAllowance;
  final int? held;

  /// The India day the free credits come back.
  final DateTime? renewsOn;
}

class CreditEntry {
  const CreditEntry({required this.at, required this.pool, required this.what, required this.delta, this.balanceAfter});

  /// Null when the row is unusable (no time, no pool or no change): the page leaves it out.
  static CreditEntry? tryParse(Object? raw) {
    final j = asJson(raw);
    final at = asDate(j['at']);
    final pool = CreditPool.parse(j['pool']);
    final delta = asInt(j['delta']);
    if (at == null || pool == null || delta == null) return null;
    return CreditEntry(
      at: at,
      pool: pool,
      what: asStringOr(j['what'], '').trim(),
      delta: delta,
      balanceAfter: asInt(j['balanceAfter']),
    );
  }

  final DateTime at;
  final CreditPool pool;

  /// The server's plain words, such as "Repair, Q7 Accountancy".
  final String what;

  /// Negative for a spend, positive for a top-up or a renewal.
  final int delta;
  final int? balanceAfter;

  bool get isSpend => delta < 0;
}

class CreditsOverview {
  const CreditsOverview({
    required this.practice,
    required this.ai,
    required this.plan,
    required this.history,
    this.nextCursor,
    this.total,
  });

  factory CreditsOverview.fromJson(Json j) => CreditsOverview(
        practice: CreditBalance.fromJson(j['practice'], CreditPool.practice),
        ai: CreditBalance.fromJson(j['ai'], CreditPool.ai),
        plan: CreditPlan.fromJson(j['plan']),
        history: [
          for (final row in (j['history'] is List ? j['history'] as List : const <Object?>[]))
            ?CreditEntry.tryParse(row),
        ],
        nextCursor: _cursor(j['nextCursor']),
        total: CreditTotal.tryParse(j['total']),
      );

  static String? _cursor(Object? raw) {
    final s = asString(raw);
    return s == null || s.isEmpty ? null : s;
  }

  final CreditBalance practice;
  final CreditBalance ai;
  final CreditPlan plan;

  /// Newest first, 30 to a page.
  final List<CreditEntry> history;
  final String? nextCursor;

  /// The one credits balance, on a server that keeps one; null on an older server.
  final CreditTotal? total;

  CreditBalance of(CreditPool pool) => pool == CreditPool.practice ? practice : ai;
}

/// One page of history from `?cursor=`: the same body, of which only the rows and the cursor are
/// used.
class CreditsPage {
  const CreditsPage({required this.rows, this.nextCursor});

  factory CreditsPage.fromJson(Json j) {
    final all = CreditsOverview.fromJson(j);
    return CreditsPage(rows: all.history, nextCursor: all.nextCursor);
  }

  final List<CreditEntry> rows;
  final String? nextCursor;
}
