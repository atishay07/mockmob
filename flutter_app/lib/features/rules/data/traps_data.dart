import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/models/mistake_lab_traps.dart';

/// `GET /api/me/traps` (Mistake Lab v4 slice 4, spec 4.11): the traps the student has met across
/// mocks, built by the website from their own answers. Behind an interface so tests replace it.
abstract interface class TrapsApi {
  /// The read, or throws [ApiError] (a 503 when the atlas is not available) or [FormatException]
  /// for a body that is not a readable Traps you meet.
  Future<TrapsMeet> read();
}

class HttpTrapsApi implements TrapsApi {
  HttpTrapsApi(this._api);

  final ApiClient _api;

  @override
  Future<TrapsMeet> read() async {
    final response = await _api.get('/api/me/traps');
    final traps = TrapsMeet.tryParse(response.data);
    if (traps == null) throw const FormatException('traps: nothing readable');
    return traps;
  }
}

final trapsApiProvider = Provider<TrapsApi>((ref) => HttpTrapsApi(ref.watch(apiClientProvider)));

/// Traps you meet, read once each time its disclosure opens (the widget watches this only while
/// open, so a closed disclosure costs no request). A failed read is an error the widget words.
final trapsMeetProvider = FutureProvider.autoDispose<TrapsMeet>(
  // The student's own Try again is the retry: no hidden second read.
  retry: (count, error) => null,
  (ref) => ref.watch(trapsApiProvider).read(),
);
