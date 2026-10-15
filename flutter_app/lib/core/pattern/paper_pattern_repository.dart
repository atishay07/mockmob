import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api.dart';
import 'paper_pattern.dart';

/// Which pattern to read: a public subject id and, for a subject set in more than one way
/// (Mathematics: `core` or `applied`), the variant. No variant means the paper's default.
typedef PatternKey = ({String subject, String? variant});

/// Reads `GET /api/subjects/:id/pattern` (public, cached on the server) and keeps each answer in
/// memory for the app run: the pattern changes with a new blueprint, not between screens.
///
/// A subject with no blueprint (the server says 404) is remembered as null, so its screens say
/// so once instead of asking again. A failed read is not remembered and throws [ApiError], so
/// the next screen can try again.
class PaperPatternRepository {
  PaperPatternRepository(this._api);

  final ApiClient _api;
  final Map<String, PaperPattern?> _cache = {};
  final Map<String, Future<PaperPattern?>> _inFlight = {};

  static final RegExp _id = RegExp(r'^[a-z0-9_]{1,64}$');
  static final RegExp _variant = RegExp(r'^[a-z0-9_-]{1,32}$');

  static String _cacheKey(String subject, String? variant) => '$subject|${variant ?? ''}';

  /// The pattern of [subject], from memory when it was read this run.
  Future<PaperPattern?> forSubject(String subject, {String? variant}) {
    final id = subject.trim().toLowerCase();
    final v = variant?.trim().toLowerCase();
    if (!_id.hasMatch(id) || (v != null && !_variant.hasMatch(v))) return Future.value(null);
    final key = _cacheKey(id, v);
    if (_cache.containsKey(key)) return Future.value(_cache[key]);
    return _inFlight[key] ??= _read(id, v, key).whenComplete(() {
      _inFlight.remove(key);
    });
  }

  /// The pattern of [subject] if it is already in memory (null when never read or no blueprint).
  PaperPattern? cached(String subject, {String? variant}) => _cache[_cacheKey(subject.trim().toLowerCase(), variant?.trim().toLowerCase())];

  /// Forgets every pattern (a new app version or a sign-out does not need this; tests do).
  void clear() => _cache.clear();

  Future<PaperPattern?> _read(String id, String? variant, String key) async {
    try {
      final response = await _api.get(
        '/api/subjects/${Uri.encodeComponent(id)}/pattern',
        query: {'variant': ?variant},
        options: const ApiOptions(authenticated: false),
      );
      final pattern = PaperPattern.tryParse(response.data);
      _cache[key] = pattern;
      return pattern;
    } on ApiError catch (e) {
      if (e.kind == ApiErrorKind.notFound) {
        _cache[key] = null;
        return null;
      }
      rethrow;
    }
  }
}

final paperPatternRepositoryProvider = Provider<PaperPatternRepository>((ref) => PaperPatternRepository(ref.watch(apiClientProvider)));

/// One subject's pattern for a widget: loading, the pattern, null (no blueprint for this
/// subject), or an error the widget answers with a quiet Try again.
final paperPatternProvider = FutureProvider.family<PaperPattern?, PatternKey>(
  (ref, key) => ref.watch(paperPatternRepositoryProvider).forSubject(key.subject, variant: key.variant),
);
