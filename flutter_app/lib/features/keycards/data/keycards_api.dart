import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';
import '../../../core/models/json_helpers.dart';
import 'keycards_models.dart';

/// The server has Key cards switched off (`KEY_CARDS_ENABLED` unset): every route answers 404
/// `{ error: 'KEY_CARDS_OFF' }`. The app then shows no entry to them at all.
class KeyCardsOff implements Exception {
  const KeyCardsOff();

  @override
  String toString() => 'KeyCardsOff';
}

/// Free met a daily limit of Key cards (402 `{ error: 'PRO_REQUIRED', reason }`). [reason] is
/// `keycard_reviews` for the reviews a day, `keycard_line` for "The line you needed".
class KeyCardsProRequired implements Exception {
  const KeyCardsProRequired([this.reason = 'keycard_reviews']);

  final String reason;

  @override
  String toString() => 'KeyCardsProRequired($reason)';
}

/// The Key cards routes (KEYCARDS-BUILD-SPEC 2e), one method per route, shapes exactly as the spec writes
/// them. Behind an interface so tests and the device demo replace it. Each method throws [KeyCardsOff] when
/// the server has them off, [KeyCardsProRequired] on a 402 PRO_REQUIRED, and [ApiError] otherwise.
abstract interface class KeyCardsApi {
  /// `GET /api/keycards`.
  Future<(KcHome, Json)> home();

  /// `GET /api/keycards/deck?chapter=<key>`. The raw body comes back too, so the phone can keep it.
  Future<(KcDeck, Json)> deck(String chapterKey);

  /// `POST /api/keycards/add` with `{ chapter }` or `{ cardIds }`.
  Future<KcAddResult> add({String? chapter, List<String>? cardIds});

  /// `GET /api/keycards/due?limit=`.
  Future<(KcDue, Json)> due({int limit = 20});

  /// `POST /api/keycards/review`. Reviews from the screens go through the outbox ([KeyCardReviews]); this
  /// is the same call made at once.
  Future<KcReviewResult> review({required String cardId, required int rating, required String mode, DateTime? clientReviewedAt});

  /// `GET /api/keycards/line?questionId=`.
  Future<KcLine> line(String questionId);

  /// `POST /api/keycards/report`.
  Future<void> report({required String cardId, required String reason});

  /// `GET /api/me/chapters?subject=`.
  Future<KcMyChapters> myChapters(String subject);

  /// `PUT /api/me/subject-options`.
  Future<({String subject, String option})> setOption({required String subject, required String option});
}

/// The paths, shared with the outbox (a review or a report queued offline names them).
abstract final class KeyCardsPaths {
  static const String home = '/api/keycards';
  static const String deck = '/api/keycards/deck';
  static const String add = '/api/keycards/add';
  static const String due = '/api/keycards/due';
  static const String review = '/api/keycards/review';
  static const String line = '/api/keycards/line';
  static const String report = '/api/keycards/report';
  static const String myChapters = '/api/me/chapters';
  static const String subjectOptions = '/api/me/subject-options';
}

/// The machine codes the routes answer with.
abstract final class KeyCardsCodes {
  static const String off = 'KEY_CARDS_OFF';
  static const String proRequired = 'PRO_REQUIRED';
}

/// Maps an [ApiError] to what Key cards mean by it.
Object keyCardsError(ApiError e) {
  if (e.status == 404 && e.hasCode(KeyCardsCodes.off)) return const KeyCardsOff();
  if (e.status == 402 && (e.hasCode(KeyCardsCodes.proRequired) || e.kind == ApiErrorKind.paymentRequired)) return const KeyCardsProRequired();
  return e;
}

class HttpKeyCardsApi implements KeyCardsApi {
  HttpKeyCardsApi(this._api);

  final ApiClient _api;

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on ApiError catch (e) {
      throw keyCardsError(e);
    }
  }

  @override
  Future<(KcHome, Json)> home() => _guard(() async {
    final body = asJson((await _api.get(KeyCardsPaths.home)).data);
    return (KcHome.parse(body), body);
  });

  @override
  Future<(KcDeck, Json)> deck(String chapterKey) => _guard(() async {
    final body = asJson((await _api.get(KeyCardsPaths.deck, query: {'chapter': chapterKey})).data);
    return (KcDeck.parse(body, chapterKey: chapterKey), body);
  });

  @override
  Future<KcAddResult> add({String? chapter, List<String>? cardIds}) => _guard(() async {
    final body = chapter != null ? {'chapter': chapter} : {'cardIds': cardIds ?? const <String>[]};
    return KcAddResult.parse((await _api.post(KeyCardsPaths.add, body: body)).data);
  });

  @override
  Future<(KcDue, Json)> due({int limit = 20}) => _guard(() async {
    final body = asJson((await _api.get(KeyCardsPaths.due, query: {'limit': '$limit'})).data);
    return (KcDue.parse(body), body);
  });

  @override
  Future<KcReviewResult> review({required String cardId, required int rating, required String mode, DateTime? clientReviewedAt}) => _guard(() async {
    final response = await _api.post(KeyCardsPaths.review, body: reviewBody(cardId: cardId, rating: rating, mode: mode, clientReviewedAt: clientReviewedAt));
    return KcReviewResult.parse(response.data);
  });

  @override
  Future<KcLine> line(String questionId) => _guard(() async => KcLine.parse((await _api.get(KeyCardsPaths.line, query: {'questionId': questionId})).data));

  @override
  Future<void> report({required String cardId, required String reason}) =>
      _guard(() => _api.post(KeyCardsPaths.report, body: reportBody(cardId: cardId, reason: reason)));

  @override
  Future<KcMyChapters> myChapters(String subject) =>
      _guard(() async => KcMyChapters.parse((await _api.get(KeyCardsPaths.myChapters, query: {'subject': subject})).data));

  @override
  Future<({String subject, String option})> setOption({required String subject, required String option}) => _guard(() async {
    final j = asJson((await _api.put(KeyCardsPaths.subjectOptions, body: {'subject': subject, 'option': option})).data);
    return (subject: asStringOr(j['subject'], subject), option: asStringOr(j['option'], option));
  });
}

/// The review body, the same whether it is sent at once or replayed from the outbox. `clientReviewedAt` is
/// the phone's own moment of the rating, in UTC; the server clamps it to the last 48 hours.
Json reviewBody({required String cardId, required int rating, required String mode, DateTime? clientReviewedAt}) => {
  'cardId': cardId,
  'rating': rating,
  'mode': mode,
  'clientReviewedAt': ?clientReviewedAt?.toUtc().toIso8601String(),
};

/// The report body; the server takes at most 300 characters.
Json reportBody({required String cardId, required String reason}) =>
    {'cardId': cardId, 'reason': reason.length > 300 ? reason.substring(0, 300) : reason};

/// The default before the app wires the real routes (and in every test that does not pass its own): Key
/// cards are off, so nothing is drawn and nothing is fetched.
class OffKeyCardsApi implements KeyCardsApi {
  const OffKeyCardsApi();

  Never _off() => throw const KeyCardsOff();

  @override
  Future<(KcHome, Json)> home() async => _off();
  @override
  Future<(KcDeck, Json)> deck(String chapterKey) async => _off();
  @override
  Future<KcAddResult> add({String? chapter, List<String>? cardIds}) async => _off();
  @override
  Future<(KcDue, Json)> due({int limit = 20}) async => _off();
  @override
  Future<KcReviewResult> review({required String cardId, required int rating, required String mode, DateTime? clientReviewedAt}) async => _off();
  @override
  Future<KcLine> line(String questionId) async => _off();
  @override
  Future<void> report({required String cardId, required String reason}) async => _off();
  @override
  Future<KcMyChapters> myChapters(String subject) async => _off();
  @override
  Future<({String subject, String option})> setOption({required String subject, required String option}) async => _off();
}
