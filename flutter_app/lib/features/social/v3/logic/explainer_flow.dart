// The Mob explainer's rules (owner D166; MOB-EXPLAINER.md section 1), kept apart from the widgets so
// tests can read them plainly:
// - when it shows: the first Start a Mob or Join with a code on D0, or the first invite link, for a
//   student who is in no Mob yet; never during a run, never over a moment, never as a push;
// - the seen flag: `mob.explainer.v1.seen.<user id>` in the Mob prefs (this phone, this account), set
//   when the student reaches slide 7 or taps Skip;
// - where Skip and the end keys go: Start to the setup, Join to the code screen, an invite to the code
//   screen with its code, a replay back to the den;
// - the setup's questions, one a screen, and when its key may go on.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_state.dart';
import '../../data/mob_models.dart' show isValidMobName;
import '../../data/mob_repository.dart' show mobPrefsStoreProvider;
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';

/// How the student came to the explainer.
enum ExplainerVia {
  /// D0 "Start a Mob", or the D0 link "How the Mob works".
  start,

  /// D0 "Join with a code".
  join,

  /// A friend's invite link (`/join/<code>`): the code is already filled.
  invite,

  /// "How the Mob works" in Mob settings: watched again from the den.
  replay,
}

/// Where the explainer hands over.
enum ExplainerExit { setup, join, den }

/// One end key on slide 7.
class ExplainerKey {
  const ExplainerKey(this.label, this.exit, {this.primary = false});
  final String label;
  final ExplainerExit exit;

  /// The volt key (one per screen).
  final bool primary;
}

abstract final class ExplainerFlow {
  static const int slides = MobExplainerCopy.slideCount;
  static const int last = slides - 1;

  /// Skip goes straight to where the student was heading.
  static ExplainerExit skipTo(ExplainerVia via) => switch (via) {
        ExplainerVia.start => ExplainerExit.setup,
        ExplainerVia.join || ExplainerVia.invite => ExplainerExit.join,
        ExplainerVia.replay => ExplainerExit.den,
      };

  /// Slide 7's keys: the way the student came is first. A replay has one key back to the den. An
  /// invite names the Mob only when the server's preview of the code named it.
  static List<ExplainerKey> endKeys(ExplainerVia via, {String? mobName}) {
    const start = ExplainerKey(MobExplainerCopy.startYourMob, ExplainerExit.setup);
    const join = ExplainerKey(MobExplainerCopy.joinWithCode, ExplainerExit.join);
    return switch (via) {
      ExplainerVia.start => const [ExplainerKey(MobExplainerCopy.startYourMob, ExplainerExit.setup, primary: true), join],
      ExplainerVia.join => const [ExplainerKey(MobExplainerCopy.joinWithCode, ExplainerExit.join, primary: true), start],
      ExplainerVia.invite => [
          ExplainerKey(mobName == null || mobName.trim().isEmpty ? MobExplainerCopy.joinThisMob : MobExplainerCopy.joinNamed(mobName.trim()), ExplainerExit.join, primary: true),
          start,
        ],
      ExplainerVia.replay => const [ExplainerKey(MobExplainerCopy.backToMob, ExplainerExit.den, primary: true)],
    };
  }

  /// The flag is set on reaching the last slide (or on Skip, by the caller).
  static bool marksSeenOn(int slide) => slide >= last;

  /// Skip shows on slides 1 to 6; slide 7 has its keys.
  static bool skipVisible(int slide) => slide < last;
}

// ---------------------------------------------------------------------------------------------------
// The seen flag
// ---------------------------------------------------------------------------------------------------

/// The per-account key. An account the app cannot name yet shares one anonymous key.
String explainerSeenKey(String? userId) => 'mob.explainer.v1.seen.${(userId == null || userId.isEmpty) ? 'anon' : userId}';

/// Reads and sets this account's seen flag on this phone. A read that fails counts as seen, so the
/// explainer never loops or blocks the way to the setup; a write that fails is a convenience lost.
class ExplainerSeen {
  ExplainerSeen(this.ref);

  final Ref ref;

  String get _key => explainerSeenKey(ref.read(authSnapshotProvider).userId);

  Future<bool> read() async {
    try {
      return await ref.read(mobPrefsStoreProvider).getBool(_key) ?? false;
    } on Object {
      return true;
    }
  }

  Future<void> mark() async {
    try {
      await ref.read(mobPrefsStoreProvider).setBool(_key, true);
    } on Object {
      // The worst case is the explainer once more on this phone.
    }
  }
}

final explainerSeenProvider = Provider<ExplainerSeen>(ExplainerSeen.new);

// ---------------------------------------------------------------------------------------------------
// The setup, one question a screen
// ---------------------------------------------------------------------------------------------------

enum SetupStep { fold, name, subject, you }

/// What the setup has so far. The key under each step goes on only when its answer is there; the
/// last step needs a first name that follows the name rule (2 to 18 letters).
class SetupAnswers {
  const SetupAnswers({this.fold, this.nameKey, this.subject, this.name = ''});

  final FoldKey? fold;
  final int? nameKey;
  final String? subject;
  final String name;

  static bool canGoOn(SetupStep step, SetupAnswers a) => switch (step) {
        SetupStep.fold => a.fold != null,
        SetupStep.name => a.nameKey != null,
        SetupStep.subject => a.subject != null,
        SetupStep.you => a.fold != null && a.nameKey != null && a.subject != null && isValidMobName(a.name),
      };
}
