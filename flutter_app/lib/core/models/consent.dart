import 'json_helpers.dart';

enum AgeBand {
  adult,
  minor,
  unknown;

  static AgeBand fromWire(String? s) => AgeBand.values.asNameMap()[s] ?? AgeBand.unknown;
}

/// `GET/PUT /api/me/consent` [API 2.2]. Usage data is on for 18 or older and for "Rather not say" (D183,
/// owner 20 Oct 2026) and off only for a student who said they are under 18; anyone can switch it off.
/// Nothing is collected until the student has answered and the server holds it as allowed.
class Consent {
  const Consent({
    this.ageBand = AgeBand.unknown,
    this.analyticsAllowed = false,
    this.policyVersion,
    this.decidedAt,
    this.withdrawnAt,
    this.deletedEvents,
  });

  factory Consent.fromJson(Json j) => Consent(
        ageBand: AgeBand.fromWire(asString(j['ageBand'])),
        analyticsAllowed: asBool(j['analyticsAllowed']) ?? false,
        policyVersion: asString(j['policyVersion']),
        decidedAt: asDate(j['decidedAt']),
        withdrawnAt: asDate(j['withdrawnAt']),
        deletedEvents: asInt(j['deletedEvents']),
      );

  final AgeBand ageBand;
  final bool analyticsAllowed;
  final String? policyVersion;
  final DateTime? decidedAt;
  final DateTime? withdrawnAt;

  /// Only on a PUT answer: how many earlier events the server deleted.
  final int? deletedEvents;

  /// The student answered the age question: a band, or "Rather not say" (the unknown band with a
  /// decision time on the server). Without an answer the unknown band means "never asked".
  bool get answered => ageBand != AgeBand.unknown || decidedAt != null;

  /// The usage-data switch is shown: the student answered and did not say they are under 18.
  bool get switchAvailable => answered && ageBand != AgeBand.minor;

  /// The server collects only for a student who did not say they are under 18, who allowed it and has
  /// not withdrawn.
  bool get canCollect => ageBand != AgeBand.minor && analyticsAllowed && withdrawnAt == null;
}
