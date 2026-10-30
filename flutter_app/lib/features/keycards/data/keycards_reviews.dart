import '../../../core/api/api_error.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/sync/outbox_repository.dart';
import 'keycards_api.dart';
import 'keycards_models.dart';

/// How a rating or a report left the phone.
enum KcSendKind {
  /// The server acknowledged it.
  sent,

  /// Kept on this phone (offline, or the server was slow); the outbox sends it later with the same key.
  waiting,

  /// Free met today's limit: the server refused it with 402 PRO_REQUIRED (nothing was saved).
  proRequired,

  /// The server refused it for good.
  failed,
}

class KcSendOutcome {
  const KcSendOutcome(this.kind, {this.result});

  final KcSendKind kind;

  /// The server's answer to a review that was [KcSendKind.sent].
  final KcReviewResult? result;
}

/// Sends ratings and reports. Behind an interface so tests and the demo replace it.
abstract interface class KeyCardReviews {
  /// One rating of [cardId], made on the phone at [at] (sent as `clientReviewedAt`).
  Future<KcSendOutcome> review({required String cardId, required int rating, required String mode, required DateTime at});

  /// One report about [cardId].
  Future<KcSendOutcome> report({required String cardId, required String reason});
}

/// The outbox kinds, so the owning module can recognise its rows.
abstract final class KeyCardsOutbox {
  static const String review = 'keycard_review';
  static const String report = 'keycard_report';

  /// One rating, one key: a replay of the same rating (same card, same moment) is the same write, which the
  /// server applies once (KEYCARDS-BUILD-SPEC 2e: replays with the same `(cardId, clientReviewedAt)` are
  /// idempotent).
  static String reviewKey(String cardId, DateTime at) => 'kc-review-$cardId-${at.toUtc().millisecondsSinceEpoch}';
  static String reportKey(String cardId) => 'kc-report-$cardId';
}

/// Every write goes into the outbox first (so a dropped connection keeps it), then the outbox is flushed at
/// once. The answer for that one write decides what the screen says; a flush that could not run (offline)
/// leaves it waiting.
class OutboxKeyCardReviews implements KeyCardReviews {
  OutboxKeyCardReviews({required this.repository, required this.flush});

  final OutboxRepository repository;
  final Future<List<OutboxResult>> Function() flush;

  @override
  Future<KcSendOutcome> review({required String cardId, required int rating, required String mode, required DateTime at}) => _send(
    kind: KeyCardsOutbox.review,
    path: KeyCardsPaths.review,
    key: KeyCardsOutbox.reviewKey(cardId, at),
    body: reviewBody(cardId: cardId, rating: rating, mode: mode, clientReviewedAt: at),
    parse: (data) => KcReviewResult.parse(data),
  );

  @override
  Future<KcSendOutcome> report({required String cardId, required String reason}) => _send(
    kind: KeyCardsOutbox.report,
    path: KeyCardsPaths.report,
    key: KeyCardsOutbox.reportKey(cardId),
    body: reportBody(cardId: cardId, reason: reason),
  );

  Future<KcSendOutcome> _send({required String kind, required String path, required String key, required Json body, KcReviewResult Function(Object? data)? parse}) async {
    final item = await repository.enqueue(kind: kind, method: 'POST', path: path, body: body, idempotencyKey: key);
    List<OutboxResult> results;
    try {
      results = await flush();
    } on Object {
      return const KcSendOutcome(KcSendKind.waiting);
    }
    for (final r in results) {
      if (r.item.id != item.id) continue;
      return outcomeOf(r, parse: parse);
    }
    return const KcSendOutcome(KcSendKind.waiting);
  }

  /// What one flushed outbox row means for Key cards.
  static KcSendOutcome outcomeOf(OutboxResult r, {KcReviewResult Function(Object? data)? parse}) {
    switch (r.kind) {
      case OutboxResultKind.sent:
        return KcSendOutcome(KcSendKind.sent, result: parse?.call(r.response?.data));
      case OutboxResultKind.dropped:
        final e = r.error;
        if (e != null && keyCardsError(e) is KeyCardsProRequired) return const KcSendOutcome(KcSendKind.proRequired);
        // Dropped for age (no error) or refused for good.
        return const KcSendOutcome(KcSendKind.failed);
      case OutboxResultKind.retryLater || OutboxResultKind.conflict:
        return const KcSendOutcome(KcSendKind.waiting);
    }
  }
}

/// Sends straight through [KeyCardsApi], for the device demo and tests that need no database.
class DirectKeyCardReviews implements KeyCardReviews {
  DirectKeyCardReviews(this.api);

  final KeyCardsApi api;

  @override
  Future<KcSendOutcome> review({required String cardId, required int rating, required String mode, required DateTime at}) async {
    try {
      return KcSendOutcome(KcSendKind.sent, result: await api.review(cardId: cardId, rating: rating, mode: mode, clientReviewedAt: at));
    } on KeyCardsProRequired {
      return const KcSendOutcome(KcSendKind.proRequired);
    } on ApiError catch (e) {
      return KcSendOutcome(e.isOffline ? KcSendKind.waiting : KcSendKind.failed);
    } on Object {
      return const KcSendOutcome(KcSendKind.failed);
    }
  }

  @override
  Future<KcSendOutcome> report({required String cardId, required String reason}) async {
    try {
      await api.report(cardId: cardId, reason: reason);
      return const KcSendOutcome(KcSendKind.sent);
    } on ApiError catch (e) {
      return KcSendOutcome(e.isOffline ? KcSendKind.waiting : KcSendKind.failed);
    } on Object {
      return const KcSendOutcome(KcSendKind.failed);
    }
  }
}
