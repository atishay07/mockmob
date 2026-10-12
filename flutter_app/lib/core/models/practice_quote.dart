import 'json_helpers.dart';

class QuoteAllowance {
  const QuoteAllowance({required this.kind, required this.state});

  factory QuoteAllowance.fromJson(Json j) => QuoteAllowance(kind: asStringOr(j['kind'], ''), state: asStringOr(j['state'], 'unknown'));

  /// `daily_practice`, `baseline:<subject>`, `full_sample:<subject>`.
  final String kind;

  /// `available`, `used` or `unknown`.
  final String state;

  bool get isAvailable => state == 'available';
}

/// `GET /api/practice/quote` [API 2.6]. Costs and free paths come only from here, never from
/// constants in the app. The quote is advisory and has no side effects.
class PracticeQuote {
  const PracticeQuote({
    required this.state,
    required this.launchable,
    required this.reasonCode,
    this.reason,
    this.quotedAt,
    this.expiresAt,
    this.idempotencyToken,
    this.subjectId,
    this.subjectName,
    this.modeId,
    this.modeLabel,
    this.count,
    this.durationSec,
    this.creditCost,
    this.creditBalance,
    this.entitlementKind,
    this.allowance,
    this.inventoryState,
    this.upgradeHref,
  });

  factory PracticeQuote.fromJson(Json j) {
    final subject = asJson(j['subject']);
    final mode = asJson(j['mode']);
    final entitlement = asJson(j['entitlement']);
    final inventory = asJson(j['inventory']);
    return PracticeQuote(
      state: asStringOr(j['state'], 'unavailable'),
      launchable: asBool(j['launchable']) ?? false,
      reasonCode: asStringOr(j['reasonCode'], ''),
      reason: asString(j['reason']),
      quotedAt: asDate(j['quotedAt']),
      expiresAt: asDate(j['expiresAt']),
      idempotencyToken: asString(j['idempotencyToken']),
      subjectId: asString(subject['id']),
      subjectName: asString(subject['name']),
      modeId: asString(mode['id']),
      modeLabel: asString(mode['label']),
      count: asInt(j['count']),
      durationSec: asInt(j['durationSec']),
      creditCost: asInt(j['creditCost']),
      creditBalance: asInt(j['creditBalance']),
      entitlementKind: asString(entitlement['kind']),
      allowance: j['allowance'] is Map ? QuoteAllowance.fromJson(asJson(j['allowance'])) : null,
      inventoryState: asString(inventory['state']),
      upgradeHref: asString(j['upgradeHref']),
    );
  }

  /// `available`, `blocked` or `unavailable`.
  final String state;
  final bool launchable;

  /// `ok`, `access_required`, `insufficient_credits`, `inventory_insufficient`, ...
  final String reasonCode;

  /// Plain text meant for the student, shown as is when the quote is not launchable.
  final String? reason;
  final DateTime? quotedAt;

  /// The quote lives 60 seconds; re-quote after this time.
  final DateTime? expiresAt;

  /// Convenient `generationKey` when launchable.
  final String? idempotencyToken;
  final String? subjectId;
  final String? subjectName;
  final String? modeId;
  final String? modeLabel;
  final int? count;
  final int? durationSec;

  /// Practice credits the launch would spend. Zero or null when free.
  final int? creditCost;

  /// Null for Pro accounts.
  final int? creditBalance;

  /// `free` or `access`.
  final String? entitlementKind;
  final QuoteAllowance? allowance;
  final String? inventoryState;

  /// Web path. The app does not sell in v1, so it is never opened.
  final String? upgradeHref;

  bool get isAccessRequired => reasonCode == 'access_required';
  bool get isInsufficientCredits => reasonCode == 'insufficient_credits';

  /// Free because an allowance covers it (daily practice, baseline, full sample).
  bool get freeByAllowance => allowance != null && allowance!.isAvailable;

  bool isExpiredAt(DateTime now) => expiresAt != null && !now.isBefore(expiresAt!);
}
