import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Remote push, deferred until a server sender exists (amendment A3: no Firebase in v1). The
/// interface stays unimplemented; a later module provides FCM behind it, and token upload
/// (`POST/DELETE /api/me/devices`) goes through it.
abstract class PushTransport {
  /// The current device token, or null when push is not available.
  Future<String?> token();

  /// Emits whenever the token changes.
  Stream<String> get onTokenRefresh;

  /// Forgets the token on this device (sign-out).
  Future<void> deleteToken();
}

/// Null until a transport is wired in.
final pushTransportProvider = Provider<PushTransport?>((ref) => null);
