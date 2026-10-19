// The sentence for any failure on the create, join and settings screens: the v3 map first (the server's
// code: FOLD_LOCKED, NAME_KEY_INVALID, STEP_OUT_DONE, JOIN_PAUSED...), then offline, then the codes the
// old Mob already had sentences for (a name the server refused, a Mob limit), then a plain fallback.
// It never names Pro: nothing in the Mob is for sale.

import '../../../../core/api/api.dart';
import '../../copy.dart';
import '../../data/mob_repository.dart' show MobFailure, mobFailureFor;
import '../copy_v3.dart';

/// The failure's own code when it has one (upper case), else null.
String? mobErrorCode(Object e) => e is ApiError ? e.code.toUpperCase() : null;

String mobV3Say(Object e) {
  final code = mobErrorCode(e);
  if (code != null && MobV3Copy.errors.containsKey(code)) return MobV3Copy.error(e);
  if (e is ApiError) {
    if (e.isOffline) return MobV3Copy.error(e);
    final f = mobFailureFor(e);
    if (f != MobFailure.generic && f != MobFailure.offline) return MobCopy.failure(f);
  }
  return MobV3Copy.error(e);
}

/// True when the failure is about the name the student typed (so it shows under the name field).
bool mobErrorIsName(Object e) => e is ApiError && (e.hasCode('NAME_INVALID') || e.hasCode('NAME_REFUSED'));

/// True when the way forward is to choose subjects first.
bool mobErrorNeedsSubjects(Object e) => e is ApiError && mobFailureFor(e).needsSubjects;
