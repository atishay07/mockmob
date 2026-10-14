/// Public surface of the shared repositories (design spec 12.3).
library;

export 'attempts_repository.dart';
export 'consent_repository.dart';
export 'credits_repository.dart';
export 'dismissal_repository.dart';
export 'goal_repository.dart';
export 'local_scope.dart' show SignedOutException, userIdProvider;
export 'notification_prefs_repository.dart';
export 'pending_result_repository.dart';
export 'plan_repository.dart';
export 'quote_repository.dart';
export 'remote_state.dart' show CachedValue, RemoteNotifier, RemoteState;
export 'repair_local_repository.dart';
export 'rhythm_repository.dart';
export 'rhythm_seen_repository.dart';
export 'session_draft_repository.dart';
