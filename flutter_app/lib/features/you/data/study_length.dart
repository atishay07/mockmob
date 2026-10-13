// The usual study length on the account (WEB-PARITY B3): `GET` and `PUT /api/study/preferences`,
// the same preferences the website's study plan reads. The server keeps `minutes` (10, 20 or
// 30) with a revision; a write names the revision it read, and a 409 means another device wrote
// first, so the read is repeated once. While lessons are switched off on the server the
// preferences answer `state: disabled` and the length stays on this phone only.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/models/json_helpers.dart';

/// What happened to the usual length.
enum LengthSync {
  /// The server stored it.
  saved,

  /// The server already had it.
  unchanged,

  /// Study preferences are not open on the server; kept on this phone.
  notOpen,
}

class StudyLength {
  StudyLength(this._ref);

  final Ref _ref;

  static const String path = '/api/study/preferences';

  /// Saves [minutes] to the account. Throws the [ApiError] when the server refused or could not
  /// be reached.
  Future<LengthSync> save(int minutes) async {
    for (var attempt = 0; ; attempt++) {
      final api = _ref.read(apiClientProvider);
      final current = (await api.get(path)).map;
      if (asString(current['state']) != 'ready') return LengthSync.notOpen;
      if (asInt(current['minutes']) == minutes) return LengthSync.unchanged;
      try {
        await api.put(path, body: {'minutes': minutes, 'expectedRevision': asInt(current['revision']) ?? 0});
        return LengthSync.saved;
      } on ApiError catch (e) {
        if (e.kind != ApiErrorKind.conflict || attempt > 0) rethrow;
      }
    }
  }
}

final studyLengthProvider = Provider<StudyLength>(StudyLength.new);
