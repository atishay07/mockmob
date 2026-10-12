import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../config/app_config.dart';
import '../storage/storage_providers.dart';
import 'auth_service.dart';
import 'session_lock.dart';

/// Lock file shared by the foreground and the WorkManager isolate. It sits in the cache
/// directory, which Android excludes from backups, so a restored phone never inherits a stale lock.
Future<SessionLock> openSessionLock() async {
  final dir = await getTemporaryDirectory();
  return SessionLock(File(p.join(dir.path, 'mm_session.lock')));
}

/// Supabase side of auth. Null when the build has no Supabase defines. Created lazily so
/// the first frame is not held up by it.
final authServiceProvider = FutureProvider<AuthService?>(
  (ref) async {
    final config = ref.watch(appConfigProvider);
    final store = ref.watch(secureStoreProvider);
    final client = await initializeSupabase(config, store);
    if (client == null) return null;
    final service = AuthService(client: client, store: store, lock: await openSessionLock(), config: config);
    ref.onDispose(service.dispose);
    return service;
  },
  retry: (retryCount, error) => null,
);
