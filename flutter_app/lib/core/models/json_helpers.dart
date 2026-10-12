/// Lenient readers for server JSON. The API mixes numbers and numeric strings and omits
/// fields freely, so every reader returns null (or a default) instead of throwing.
library;

typedef Json = Map<String, dynamic>;

Json asJson(Object? v) => v is Map ? Json.from(v) : <String, dynamic>{};

List<Json> asJsonList(Object? v) => v is List ? [for (final e in v) if (e is Map) Json.from(e)] : const [];

String? asString(Object? v) => v is String ? v : (v is num || v is bool ? v.toString() : null);

String asStringOr(Object? v, String fallback) => asString(v) ?? fallback;

int? asInt(Object? v) {
  if (v is int) return v;
  if (v is num) return v.isFinite ? v.toInt() : null;
  if (v is String) return int.tryParse(v) ?? double.tryParse(v)?.toInt();
  return null;
}

double? asDouble(Object? v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

bool? asBool(Object? v) => v is bool ? v : null;

List<String> asStringList(Object? v) => v is List ? [for (final e in v) if (e is String) e] : const [];

/// Reads an ISO-8601 string (the server mixes `Z` and `+00:00` suffixes) or epoch milliseconds.
DateTime? asDate(Object? v) {
  if (v is String) return DateTime.tryParse(v);
  if (v is num) return DateTime.fromMillisecondsSinceEpoch(v.toInt(), isUtc: true);
  return null;
}
