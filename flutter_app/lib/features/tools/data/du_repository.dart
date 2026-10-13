// Loads the DU catalogue and per-programme cutoffs: the copy on this phone first (instant and
// offline), then the bundled copy, then the server. A stale copy is refreshed in the background
// for next time, so a list never reshuffles under the student's thumb.

import 'dart:async';
import 'dart:convert';
import 'dart:isolate';

import 'package:flutter/foundation.dart' show debugPrint;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../domain/du_models.dart';
import 'du_source.dart';

/// Turns raw JSON into models. The default runs off the UI thread (the index is 157 KB).
abstract interface class DuDecoder {
  Future<DuCatalog> catalog(String raw);
  Future<DuOfferings> offerings(String raw);
}

class IsolateDuDecoder implements DuDecoder {
  const IsolateDuDecoder();

  @override
  Future<DuCatalog> catalog(String raw) =>
      Isolate.run(() => DuCatalog.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>()));

  @override
  Future<DuOfferings> offerings(String raw) =>
      Isolate.run(() => DuOfferings.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>()));
}

/// Decodes on the calling thread (tests, and tiny files).
class InlineDuDecoder implements DuDecoder {
  const InlineDuDecoder();

  @override
  Future<DuCatalog> catalog(String raw) async => DuCatalog.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>());

  @override
  Future<DuOfferings> offerings(String raw) async =>
      DuOfferings.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>());
}

/// Thrown when nothing could be loaded. [offline] picks the offline state over the error state.
class DuLoadError implements Exception {
  const DuLoadError({required this.offline});

  final bool offline;

  @override
  String toString() => 'DuLoadError(offline: $offline)';
}

class DuRepository {
  DuRepository(this._source, this._decoder, {DateTime Function()? now}) : _now = now ?? DateTime.now;

  final DuSource _source;
  final DuDecoder _decoder;
  final DateTime Function() _now;

  /// The files change once a cycle (a new round or Bulletin), so a day is plenty.
  static const Duration refreshAfter = Duration(days: 1);

  final Set<String> _refreshing = {};

  Future<DuCatalog> catalog() async {
    const file = 'index.json';
    final cached = await _source.readCache(file);
    if (cached != null) {
      try {
        final catalog = await _decoder.catalog(cached.body);
        if (_now().difference(cached.savedAt) > refreshAfter) _refreshInBackground(file);
        return catalog;
      } on Object {
        // A damaged copy: fall through to the bundled one or the server.
      }
    }
    final bundled = await _source.readBundled(file);
    if (bundled != null) {
      _refreshInBackground(file);
      return _decoder.catalog(bundled);
    }
    return _decoder.catalog(await _fetchAndKeep(file));
  }

  Future<DuOfferings> offerings(String groupId) async {
    final file = 'offerings/$groupId.json';
    final cached = await _source.readCache(file);
    if (cached != null) {
      try {
        final offerings = await _decoder.offerings(cached.body);
        if (_now().difference(cached.savedAt) > refreshAfter) _refreshInBackground(file);
        return offerings;
      } on Object {
        // Fall through to the server.
      }
    }
    try {
      return _decoder.offerings(await _fetchAndKeep(file));
    } on DuLoadError {
      // No connection on a first run: the copy shipped with the app.
      final bundled = await _source.readBundled(file);
      if (bundled == null) rethrow;
      return _decoder.offerings(bundled);
    }
  }

  Future<String> _fetchAndKeep(String file) async {
    try {
      final body = await _source.fetch(file);
      // Only keep a copy that parses, so a captive-portal page never becomes "the data".
      jsonDecode(body);
      await _source.writeCache(file, body);
      return body;
    } on ApiError catch (e) {
      debugPrint('DU $file did not load: ${e.kind.name} ${e.code}');
      throw DuLoadError(offline: e.isOffline);
    } on FormatException {
      throw const DuLoadError(offline: false);
    }
  }

  void _refreshInBackground(String file) {
    if (!_refreshing.add(file)) return;
    unawaited(_fetchAndKeep(file).then<void>((_) {}, onError: (Object _) {}).whenComplete(() => _refreshing.remove(file)));
  }
}

final duSourceProvider = Provider<DuSource>((ref) => HttpDuSource(ref.watch(apiClientProvider)));

final duDecoderProvider = Provider<DuDecoder>((ref) => const IsolateDuDecoder());

final duRepositoryProvider = Provider<DuRepository>(
  (ref) => DuRepository(ref.watch(duSourceProvider), ref.watch(duDecoderProvider)),
);

/// The whole DU catalogue. Kept for the app's lifetime once loaded: it is static data. No
/// automatic retry: the screens offer "Try again".
final duCatalogProvider = FutureProvider<DuCatalog>(
  retry: (count, error) => null,
  (ref) => ref.watch(duRepositoryProvider).catalog(),
);

/// College by college cutoffs for one programme group. Freed when no screen shows it.
final duOfferingsProvider = FutureProvider.autoDispose.family<DuOfferings, String>(
  retry: (count, error) => null,
  (ref, groupId) => ref.watch(duRepositoryProvider).offerings(groupId),
);
