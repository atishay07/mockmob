/// Mobi, the living mascot: a code-rigged vector character (no Rive, no video).
///
/// - [MobiCharacter]: the animated character, driven by a [MobiController].
/// - [MobiStage]: Mobi on a pool of lamp light with a typing speech bubble.
/// - [MobiFigure]: Mobi held in one [MobiRig] (previews, goldens).
/// - [MobiFace]: the head alone, alive, for avatars and list rows.
/// - [MobiMoments]: which act answers which moment (right, wrong, waiting, milestone...).
/// - `Mobi` (in `widgets/mobi.dart`): the pose-based API used across the app.
library;

export 'mobi_acts.dart' show MobiAct, MobiStance, MobiMoves;
export 'mobi_bubble.dart';
export 'mobi_character.dart';
export 'mobi_controller.dart';
export 'mobi_face.dart';
export 'mobi_figure.dart';
export 'mobi_moments.dart';
export 'mobi_rig.dart';
export 'mobi_sim.dart';
export 'mobi_stage.dart';
