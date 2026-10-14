/// Mobi, the living mascot: a code-rigged vector character (no Rive, no video).
///
/// - [MobiCharacter]: the animated character, driven by a [MobiController].
/// - [MobiStage]: Mobi on a pool of lamp light with a typing speech bubble.
/// - [MobiFigure]: Mobi held in one [MobiRig] (previews, goldens).
/// - [MobiFace]: the head alone, alive, for avatars and list rows.
/// - [MobiMood]: the face under every act (calm, happy, proud, curious, sleepy, concerned).
/// - [MobiTapCycle]: what repeated taps on Mobi play; [MobiWalker]: Mobi walking across a row.
/// - [MobiMoments]: which act answers which moment (right, wrong, waiting, milestone...).
/// - [MobiRation]: how often he may greet, glance, nudge, speak and shrug; [MobiCelebrations]
///   carries the Celebrations setting to every Mobi.
/// - `Mobi` (in `widgets/mobi.dart`): the pose-based API used across the app.
library;

export 'mobi_acts.dart' show MobiAct, MobiStance, MobiMoves;
export 'mobi_bubble.dart';
export 'mobi_character.dart';
export 'mobi_controller.dart';
export 'mobi_face.dart';
export 'mobi_figure.dart';
export 'mobi_moments.dart';
export 'mobi_mood.dart';
export 'mobi_ration.dart';
export 'mobi_rig.dart';
export 'mobi_sim.dart';
export 'mobi_stage.dart';
export 'mobi_tap_cycle.dart';
export 'mobi_walker.dart';
