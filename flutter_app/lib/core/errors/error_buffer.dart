import 'dart:async';

import '../storage/prefs_store.dart';
import 'error_report.dart';

/// The most reports kept on the phone at once. When it is full the oldest goes.
const maxBufferedReports = 30;

/// Reports older than this are dropped without being sent.
const maxReportAge = Duration(days: 7);

const errorBufferKey = 'error_reports_v1';

/// A small on-device queue of scrubbed error reports. The same error again adds to its count
/// instead of taking a second place. Every change is written to storage in order, and a failed
/// write is swallowed: keeping a report is never worth a second failure.
class ErrorBuffer {
  ErrorBuffer(this._store, {DateTime Function()? now}) : _now = now ?? DateTime.now;

  final PrefsStore _store;
  final DateTime Function() _now;

  List<ErrorReport>? _items;
  Future<void> _chain = Future<void>.value();

  /// Runs [action] after the one before it, so reads and writes never overlap.
  Future<T> _locked<T>(Future<T> Function() action) {
    final done = Completer<T>();
    _chain = _chain.then((_) async {
      try {
        done.complete(await action());
      } on Object catch (e, s) {
        done.completeError(e, s);
      }
    });
    return done.future;
  }

  Future<List<ErrorReport>> _load() async {
    final loaded = _items;
    if (loaded != null) return loaded;
    String? raw;
    try {
      raw = await _store.getString(errorBufferKey);
    } on Object {
      raw = null;
    }
    return _items = _fresh(decodeReports(raw));
  }

  List<ErrorReport> _fresh(List<ErrorReport> items) {
    final cutoff = _now().subtract(maxReportAge).millisecondsSinceEpoch;
    return [for (final r in items) if (r.atMs >= cutoff) r];
  }

  Future<void> _save(List<ErrorReport> items) async {
    try {
      if (items.isEmpty) {
        await _store.remove(errorBufferKey);
      } else {
        await _store.setString(errorBufferKey, encodeReports(items));
      }
    } on Object {
      // The in-memory copy still holds it for this run.
    }
  }

  /// Adds one report, merging it into an earlier one with the same [ErrorReport.key].
  Future<void> add(ErrorReport report) => _locked(() async {
        final items = _items = _fresh(await _load());
        final at = items.indexWhere((r) => r.key == report.key);
        if (at >= 0) {
          final old = items[at];
          items[at] = old.copyWith(count: (old.count + report.count).clamp(1, 1000));
        } else {
          items.add(report);
          while (items.length > maxBufferedReports) {
            items.removeAt(0);
          }
        }
        await _save(items);
      });

  /// The oldest [limit] reports still fresh enough to send.
  Future<List<ErrorReport>> take(int limit) => _locked(() async {
        final items = _items = _fresh(await _load());
        return items.take(limit).toList();
      });

  /// Drops reports that were sent (matched by key, minus the count that was sent). A report that
  /// grew in the meantime keeps the difference.
  Future<void> removeSent(List<ErrorReport> sent) => _locked(() async {
        final items = await _load();
        for (final s in sent) {
          final at = items.indexWhere((r) => r.key == s.key);
          if (at < 0) continue;
          final left = items[at].count - s.count;
          if (left > 0) {
            items[at] = items[at].copyWith(count: left);
          } else {
            items.removeAt(at);
          }
        }
        await _save(items);
      });

  /// Fills in the phone facts for reports of this run that were made before they were known.
  Future<void> fillFacts(int run, DeviceFacts facts) => _locked(() async {
        final items = await _load();
        var changed = false;
        for (var i = 0; i < items.length; i++) {
          final r = items[i];
          if (r.run == run && r.appVersion == null && facts.appVersion != null) {
            items[i] = r.copyWith(facts: facts);
            changed = true;
          }
        }
        if (changed) await _save(items);
      });

  Future<void> clear() => _locked(() async {
        _items = [];
        await _save(const []);
      });

  Future<int> count() => _locked(() async => (await _load()).length);
}
