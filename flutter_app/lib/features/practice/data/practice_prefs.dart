import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/prefs_store.dart';

/// The phone-local store for the Practice tab's own small memory (the subject the student last
/// picked). Replaced with a [MemoryPrefsStore] in tests.
final practicePrefsStoreProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

/// One key per account, so a second student signing in on the same phone starts from their own
/// default, not the last student's pick.
String pickedSubjectKey(String userId) => 'practice.pickedSubject.$userId';

/// A stored subject id is only trusted when it looks like a public subject id.
final RegExp storedSubjectId = RegExp(r'^[a-z][a-z_]{1,40}$');
