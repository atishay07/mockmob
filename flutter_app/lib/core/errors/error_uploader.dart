import 'dart:async';

import '../api/api_client.dart';
import '../api/api_error.dart';
import 'error_buffer.dart';
import 'error_report.dart';

/// The server takes at most this many errors in one request.
const maxErrorsPerBatch = 10;

/// Batches sent in one flush; the rest wait for the next one.
const maxBatchesPerFlush = 5;

/// What the uploader needs to know before it may send anything.
class ErrorGate {
  const ErrorGate({required this.signedIn, required this.consentActive, required this.consentKnownOff});

  final bool signedIn;

  /// The consent record loaded and says usage data is allowed (the student did not say they are under 18), with no
  /// withdrawal pending.
  final bool consentActive;

  /// The consent record loaded and the answer is no (or a withdrawal is pending).
  final bool consentKnownOff;

  bool get open => signedIn && consentActive && !consentKnownOff;
}

class ErrorSendResult {
  const ErrorSendResult({required this.accepted, required this.collecting});

  final int accepted;
  final bool collecting;
}

abstract class ErrorTransport {
  /// Posts one batch. Throws [ApiError] on failure.
  Future<ErrorSendResult> send(List<Map<String, Object?>> errors);
}

/// Sends through the app's one API client, so the bearer header, the refresh on 401 and the
/// back-off after a 429 are the same as everywhere else. Never repeats a request by itself.
class ApiErrorTransport implements ErrorTransport {
  ApiErrorTransport(this._api);

  final ApiClient _api;

  @override
  Future<ErrorSendResult> send(List<Map<String, Object?>> errors) async {
    final response = await _api.post('/api/app/errors', body: {'errors': errors}, options: const ApiOptions(retries: 0));
    final map = response.map;
    return ErrorSendResult(accepted: (map['accepted'] as num?)?.toInt() ?? 0, collecting: map['collecting'] != false);
  }
}

/// Sends the buffered reports in small batches when the gate is open. Every failure keeps the
/// reports for the next try; it never throws and never blocks the screen (callers do not await it).
class ErrorUploader {
  ErrorUploader({
    required this.buffer,
    required this._transport,
    required this._gate,
    this._facts,
    this._run = 0,
  });

  final ErrorBuffer buffer;
  final ErrorTransport _transport;
  final ErrorGate Function() _gate;
  final DeviceFacts? Function()? _facts;
  final int _run;

  Future<void>? _flushing;
  bool _stopped = false;

  /// True after the server said it is not collecting. Cleared by [resume].
  bool get stopped => _stopped;

  /// The student turned usage data on again: the server's earlier "not collecting" no longer holds.
  void resume() => _stopped = false;

  Future<void> flush() => _flushing ??= _flush().whenComplete(() => _flushing = null);

  Future<void> _flush() async {
    try {
      for (var i = 0; i < maxBatchesPerFlush; i++) {
        final gate = _gate();
        if (gate.consentKnownOff) {
          await buffer.clear();
          return;
        }
        if (!gate.open || _stopped) return;
        var batch = await buffer.take(maxErrorsPerBatch);
        if (batch.isEmpty) return;
        final facts = _facts?.call();
        if (facts != null) {
          batch = [
            for (final r in batch) (r.run == _run && r.appVersion == null) ? r.copyWith(facts: facts) : r,
          ];
        }
        final ErrorSendResult result;
        try {
          result = await _transport.send([for (final r in batch) r.toWire()]);
        } on ApiError catch (e) {
          // A request the server calls malformed can never succeed: drop it. Offline, 429, 5xx,
          // 401 and a blocked front door keep the reports for later.
          if (e.kind == ApiErrorKind.validation || e.kind == ApiErrorKind.payloadTooLarge) {
            await buffer.removeSent(batch);
          }
          return;
        }
        if (!result.collecting) {
          _stopped = true;
          await buffer.clear();
          return;
        }
        // Consent may have been withdrawn while the request was in flight.
        if (_gate().consentKnownOff) {
          await buffer.clear();
          return;
        }
        await buffer.removeSent(batch);
        if (batch.length < maxErrorsPerBatch) return;
      }
    } on Object {
      // Never a second failure.
    }
  }
}
