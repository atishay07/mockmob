import 'package:flutter/widgets.dart';

import 'mobi_acts.dart';
import 'mobi_character.dart';
import 'mobi_controller.dart';

/// Mobi's head alone (the folded diamond, visor, eyes and antenna) in a square: the avatar for
/// Mobi's lines in a thread, list rows, chips and small headers, 24 to 56 dp.
///
/// It is alive like the full character (it blinks, glances, watches taps and plays the facial
/// half of any act) but paints in lite detail and sleeps its ticker between beats, so a list of
/// them stays cheap. Decorative unless [semanticLabel] is given.
class MobiFace extends StatelessWidget {
  const MobiFace({
    super.key,
    this.size = 40,
    this.controller,
    this.entrance = MobiAct.idle,
    this.semanticLabel,
    this.interactive = false,
    this.watchTaps = true,
    this.seed = 11,
  });

  /// The square's side in dp.
  final double size;
  final MobiController? controller;
  final MobiAct entrance;
  final String? semanticLabel;
  final bool interactive;
  final bool watchTaps;
  final int seed;

  @override
  Widget build(BuildContext context) => MobiCharacter(
        size: size,
        controller: controller,
        entrance: entrance,
        semanticLabel: semanticLabel,
        interactive: interactive,
        watchTaps: watchTaps,
        seed: seed,
        shadow: false,
        lite: size < 72,
        head: true,
      );
}
