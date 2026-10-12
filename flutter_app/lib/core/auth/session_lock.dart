import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// A cross-isolate lock held while the Supabase refresh token is spent (design spec 5.5.1).
///
/// POSIX file locks belong to the process, so two isolates of one app would not exclude each
/// other. This uses an exclusive file create instead, which is atomic across isolates and
/// processes. A lock older than [staleAfter] is treated as abandoned by a killed isolate.
class SessionLock {
  SessionLock(
    this._file, {
    this.staleAfter = const Duration(seconds: 90),
    this.pollEvery = const Duration(milliseconds: 150),
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final File _file;
  final Duration staleAfter;
  final Duration pollEvery;
  final DateTime Function() _now;

  /// Runs [action] while holding the lock. Throws [TimeoutException] if the lock cannot be
  /// taken within [wait]. Callers keep [action] well under [staleAfter] (the refresh paths cap
  /// it at 30 s), and the default [wait] outlasts [staleAfter] so a waiter can reclaim a lock
  /// abandoned by a killed isolate instead of giving up first.
  Future<T> synchronized<T>(Future<T> Function() action, {Duration wait = const Duration(seconds: 100)}) async {
    final owner = await _acquire(wait);
    try {
      return await action();
    } finally {
      await _release(owner);
    }
  }

  Future<String> _acquire(Duration wait) async {
    final owner = '${pid}_${identityHashCode(this)}_${_now().microsecondsSinceEpoch}';
    final deadline = _now().add(wait);
    await _file.parent.create(recursive: true);
    while (true) {
      try {
        await _file.create(exclusive: true);
      } on FileSystemException {
        // Held by someone else: drop it if abandoned, otherwise wait.
        if (await _isStale()) {
          await _deleteQuietly();
          continue;
        }
        if (!_now().isBefore(deadline)) {
          throw TimeoutException('Session lock busy', wait);
        }
        await Future<void>.delayed(pollEvery);
        continue;
      }
      // The file is ours now. Recording the owner is best effort: another process reading the
      // file at that instant can make the write fail on some systems, and the lock still holds.
      final token = jsonEncode({'owner': owner, 'at': _now().millisecondsSinceEpoch});
      for (var attempt = 0; attempt < 5; attempt++) {
        try {
          await _file.writeAsString(token, flush: true);
          break;
        } on FileSystemException {
          await Future<void>.delayed(const Duration(milliseconds: 5));
        }
      }
      return owner;
    }
  }

  Future<void> _deleteQuietly() async {
    for (var attempt = 0; attempt < 5; attempt++) {
      try {
        await _file.delete();
        return;
      } on FileSystemException {
        if (!await _file.exists()) return;
        await Future<void>.delayed(const Duration(milliseconds: 5));
      }
    }
  }

  Future<bool> _isStale() async {
    try {
      final raw = await _file.readAsString();
      final at = (jsonDecode(raw) as Map)['at'];
      if (at is int) return _now().millisecondsSinceEpoch - at > staleAfter.inMilliseconds;
      return true;
    } on FormatException {
      // Created but not written yet. Judge by file age so a crash mid-write cannot wedge us.
      return _fileAgeExceeds();
    } on FileSystemException {
      return false;
    }
  }

  Future<bool> _fileAgeExceeds() async {
    try {
      final modified = await _file.lastModified();
      return _now().difference(modified) > staleAfter;
    } on FileSystemException {
      return false;
    }
  }

  Future<void> _release(String owner) async {
    String? raw;
    try {
      raw = await _file.readAsString();
    } on FileSystemException {
      // Unreadable right now: fall through and try to delete, since only the holder can have
      // created the file (nobody else can create it while it exists).
    }
    if (raw != null && raw.isNotEmpty) {
      try {
        if ((jsonDecode(raw) as Map)['owner'] != owner) return; // Taken over after going stale.
      } on FormatException {
        // Owner token never written: the file is still ours.
      }
    }
    await _deleteQuietly();
  }
}
