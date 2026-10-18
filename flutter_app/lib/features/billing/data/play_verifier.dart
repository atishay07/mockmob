import '../../../core/api/api_client.dart';
import '../../../core/api/api_error.dart';

/// What the server answered to a purchase it verified with Google.
class PlayVerifyResult {
  const PlayVerifyResult({required this.confirmed, this.body = const {}});

  /// True when the server verified the purchase and granted it. Only this lets the app finish the
  /// purchase and say it worked.
  final bool confirmed;
  final Map<String, dynamic> body;
}

/// Sends a purchase to the server, which asks Google whether it is real and grants it.
abstract class PlayVerifier {
  Future<PlayVerifyResult> verify({required String userId, required String productId, required String purchaseToken, required String orderId});
}

/// `POST /api/billing/play/verify` with `{productId, purchaseToken, orderId}`, signed in like the
/// app's other calls. It answers 404 while the server's own flag is off, which reaches the caller
/// as an [ApiError] of kind `notFound`.
class ApiPlayVerifier implements PlayVerifier {
  ApiPlayVerifier(this._api);

  final ApiClient _api;

  @override
  Future<PlayVerifyResult> verify({required String userId, required String productId, required String purchaseToken, required String orderId}) async {
    // The server verifies by purchase token, so repeating the call is safe: allow a retry on a
    // dropped connection.
    final res = await _api.post(
      '/api/billing/play/verify',
      body: {'productId': productId, 'purchaseToken': purchaseToken, 'orderId': orderId},
      options: const ApiOptions(retries: 2),
      expectUserId: userId,
    );
    final body = res.map;
    // A 2xx is the server's yes, unless it says in the body that it did not grant.
    final denied = body['ok'] == false || body['granted'] == false || body['verified'] == false;
    return PlayVerifyResult(confirmed: !denied, body: body);
  }
}
