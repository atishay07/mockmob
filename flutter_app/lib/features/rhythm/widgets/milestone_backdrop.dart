// The seam for the Milestones backdrop. The art pass fills `MilestoneBackdrop.build` with the
// approved scene (the shelf of the three paths in its own light) and nothing else has to change:
// the page already stacks this layer under its content, behind the lamp's pool, inside the safe
// area's top, and never lets it take a tap or a semantics node.
//
// Contract for whatever is drawn here:
//  - It fills the box it is given (the full page width, the top [height] dp) and draws nothing
//    outside it. It never moves the content: it is a picture on the ground, not a header.
//  - It reads `context.mmColors` and has a deliberate Night and Day form (SPACING.md 8.5).
//  - Under reduced motion it holds still ([Motion.reduced]); with the Celebrations setting at
//    Quiet or Off it never animates (MOTION.md 1.2).
//  - It is decorative: ExcludeSemantics is applied by the page.
import 'package:flutter/widgets.dart';

class MilestoneBackdrop extends StatelessWidget {
  const MilestoneBackdrop({super.key, this.landed = 0, this.total = 0});

  /// How many steps have landed of [total], for a backdrop that shows progress in its scene.
  final int landed;
  final int total;

  /// The height of the layer under the page's top. The art is cropped to it.
  static const double height = 280;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
