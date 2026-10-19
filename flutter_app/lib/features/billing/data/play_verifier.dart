import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';

/// What the server answered to a purchase it verified with Google.
class PlayVerifyResult {
  const PlayVerifyResult({required this.confirmed, this.pending = false, this.body = const {}});

  /// The server's 202 `purchase_pending`: Google Play has not taken the money yet. Nothing was
  /// granted and nothing failed; the purchase is sent again once Google Play says it is paid.
  const PlayVerifyResult.pending({this.body = const {}})
      : confirmed = false,
        pending = true;

  /// True when the server verified the purchase and granted it. Only this lets the app say it
  /// worked.
  final bool confirmed;

  /// True for the server's 202 `purchase_pending`.
  final bool pending;
  final Map<String, dynamic> body;
}

/// Sends a purchase to the server, which asks Google whether it is real, grants it and then
/// acknowledges or consumes it with Google itself (the app never does).
abstract class PlayVerifier {
  Future<PlayVerifyResult> verify({required String userId, required String productId, required String purchaseToken, required String orderId});
}

/// `POST /api/billing/play/verify` with `{productId, purchaseToken, orderId}`, signed in like the
/// app's other calls. It answers 404 while the server's own flag is off, which reaches the caller
/// as an [ApiError] of kind `notFound` with no Play code; every refusal of a real purchase carries
/// its code ([ApiCodes.play]).
class ApiPlayVerifier implements PlayVerifier {
  ApiPlayVerifier(this._api);

  final ApiClient _api;

  @override
  Future<PlayVerifyResult> verify({required String userId, required String productId, required String purchaseToken, required String orderId}) async {
    // The server verifies by purchase token, so repeating the call is safe: allow a retry on a
    // dropped connection.
    final res = await _api.post(
      '/api/billing/play/verify',
      body: {'productId': productId, 'purchaseToken': purchaseToken, if (orderId.isNotEmpty) 'orderId': orderId},
      options: const ApiOptions(retries: 2),
      expectUserId: userId,
    );
    return readVerifyAnswer(res.status, res.map);
  }

  /// A 2xx is the server's yes only when it says so: `ok: true`. The 202 `purchase_pending`
  /// (`{ok: false, pending: true}`) is a wait, not a yes and not a failure.
  static PlayVerifyResult readVerifyAnswer(int status, Map<String, dynamic> body) {
    if (body['pending'] == true || body['code'] == 'purchase_pending' || status == 202) return PlayVerifyResult.pending(body: body);
    final denied = body['ok'] != true || body['granted'] == false || body['verified'] == false;
    return PlayVerifyResult(confirmed: !denied, body: body);
  }
}
