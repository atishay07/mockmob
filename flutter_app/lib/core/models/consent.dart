import 'json_helpers.dart';

enum AgeBand {
  adult,
  minor,
  unknown;

  static AgeBand fromWire(String? s) => AgeBand.values.asNameMap()[s] ?? AgeBand.unknown;
}

/// `GET/PUT /api/me/consent` [API 2.2]. Usage data is off unless an adult turned it on.
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

  /// The server collects only for an adult who allowed it and has not withdrawn.
  bool get canCollect => ageBand == AgeBand.adult && analyticsAllowed && withdrawnAt == null;
}
