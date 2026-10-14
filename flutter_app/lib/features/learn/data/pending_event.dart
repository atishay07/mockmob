import 'package:uuid/uuid.dart';

import '../../../core/models/json_helpers.dart';

/// The one study event per run that has not been acknowledged yet. It is written to the phone
/// before it is sent and reused (same `requestKey`, same `expectedRevision`) until the server
/// answers, so a killed app never sends it twice.
class PendingEvent {
  const PendingEvent({
    required this.requestKey,
    required this.expectedRevision,
    required this.itemId,
    required this.type,
    this.value,
    this.rating,
    this.assisted = false,
  });

  factory PendingEvent.create({
    required int expectedRevision,
    required String itemId,
    required String type,
    Object? value,
    int? rating,
    bool assisted = false,
  }) => PendingEvent(
    requestKey: newRequestKey(),
    expectedRevision: expectedRevision,
    itemId: itemId,
    type: type,
    value: value,
    rating: rating,
    assisted: assisted,
  );

  factory PendingEvent.fromJson(Json j) => PendingEvent(
    requestKey: asStringOr(j['requestKey'], ''),
    expectedRevision: asInt(j['expectedRevision']) ?? 0,
    itemId: asStringOr(j['itemId'], ''),
    type: asStringOr(j['type'], ''),
    value: j['value'],
    rating: asInt(j['rating']),
    assisted: asBool(j['assisted']) ?? false,
  );

  /// `/^[a-zA-Z0-9_-]{12,100}$/`: 32 hex characters.
  static String newRequestKey() => const Uuid().v4().replaceAll('-', '');

  final String requestKey;
  final int expectedRevision;
  final String itemId;

  /// `answer`, `reveal`, `rate` or `continue`.
  final String type;
  final Object? value;
  final int? rating;
  final bool assisted;

  /// Steps the server can only take with an answer it has not given yet cannot wait on the
  /// phone: only a rating or a continue is queued while offline.
  bool get canWaitOffline => type == 'rate' || type == 'continue';

  Json toJson() => {
    'requestKey': requestKey,
    'expectedRevision': expectedRevision,
    'itemId': itemId,
    'type': type,
    if (value != null) 'value': value,
    if (rating != null) 'rating': rating,
    'assisted': assisted,
  };

  /// The request body of `POST /api/study/runs/{id}/events`.
  Json toBody() => toJson();

  PendingEvent withFreshKey(int revision) => PendingEvent(
    requestKey: newRequestKey(),
    expectedRevision: revision,
    itemId: itemId,
    type: type,
    value: value,
    rating: rating,
    assisted: assisted,
  );
}
