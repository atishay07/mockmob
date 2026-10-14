import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_database.dart';
import 'app_prefs.dart';
import 'prefs_store.dart';
import 'secure_store.dart';

/// The core database. Opened on first read (so after the first frame), closed with the container.
final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase.open();
  ref.onDispose(db.close);
  return db;
});

final secureStoreProvider = Provider<SecureStore>((ref) => const FlutterSecureStore());

final appPrefsProvider = Provider<AppPrefs>((ref) => AppPrefs(SharedPrefsStore()));
