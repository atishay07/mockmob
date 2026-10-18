import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/ask_doors.dart';
import '../insights_paths.dart';
import 'mobi_mark.dart';

/// Opens Ask Mobi's own screen, at a door: [AskDoor.now] opens with the field ready to type in,
/// [AskDoor.record] scrolled to the record door. No door opens it at the top.
void openAskMobiScreen(BuildContext context, {AskDoor? door}) {
  final location = door == null ? AppRoutes.ask : Uri(path: InsightsPaths.ask, queryParameters: {'door': door.name}).toString();
  context.push(location);
}

/// Which door of Ask Mobi's screen to open at.
enum AskDoor { now, record }

/// What the "Ask Mobi" key says on screen. Its spoken label is always "Ask Mobi".
enum AskKeyLabel {
  /// "Ask Mobi", the default.
  full,

  /// "Ask" beside Mobi, where a header is tight (Today's greeting at 360 dp; ASK-MOBI-1019).
  short,

  /// Mobi alone, at the size and target he had in v15.2, for a header line that needs every dp
  /// (Today's "Not refreshed. Last loaded 7:39 PM." stays whole on one line); his flat mark with no figure.
  figureOnly,
}

/// The labelled "Ask Mobi" key in a tab's header (ASK-MOBI-1019 B; D112): a glass capsule with Mobi
/// and the words, so a student new to apps never has to guess that the mascot is a button.
///
/// [figure] is the Mobi the header already has (Today's greeting Mobi, Practice's resident one), so
/// he is never on the screen twice; the capsule's tap opens Ask Mobi and his own taps rest. With no
/// figure the capsule carries Mobi's flat mark.
class AskMobiButton extends StatelessWidget {
  const AskMobiButton({super.key, this.figure, this.onTap, this.label = AskKeyLabel.full});

  final Widget? figure;
  final VoidCallback? onTap;
  final AskKeyLabel label;

  /// The capsule's height; its target is 48 dp.
  static const double height = 44;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final art = figure;
    // The screen reads the record again as it opens.
    final tap = onTap ?? () => openAskMobiScreen(context);
    if (label == AskKeyLabel.figureOnly) {
      // v15.2's header Mobi: the figure is the key, its target reaching 48 dp around him.
      return MmHitSlop(
        slop: const EdgeInsets.fromLTRB(10, 1, 0, 1),
        child: MmPressable(
          onTap: tap,
          semanticsLabel: AskDoorCopy.button,
          focusRadius: MmRadius.pillAll,
          pressedScale: 0.94,
          haptic: MmPressHaptic.selection,
          builder: (context, pressed, _) => SizedBox(height: 46, child: ExcludeSemantics(child: art ?? const Center(child: MobiMark(size: 30)))),
        ),
      );
    }
    return MmPressable(
      semanticsLabel: AskDoorCopy.button,
      onTap: tap,
      pressedScale: 0.96,
      haptic: MmPressHaptic.selection,
      focusRadius: MmRadius.pillAll,
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: Center(
          child: SizedBox(
            height: height,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                FakeGlass(
                  borderRadius: MmRadius.pillAll,
                  pressed: pressed,
                  grain: false,
                  child: DecoratedBox(
                    decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: colors.lineStrong))),
                    child: Padding(
                      padding: EdgeInsets.only(left: art == null ? 12 : 38, right: 15),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (art == null) ...[const MobiMark(size: 20), const SizedBox(width: MmSpace.s8)],
                          Text(
                            label == AskKeyLabel.full ? AskDoorCopy.button : AskDoorCopy.buttonShort,
                            maxLines: 1,
                            softWrap: false,
                            style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                // Mobi stands in the capsule's left end, his head a little above its edge.
                if (art != null)
                  Positioned(
                    left: 2,
                    bottom: 2,
                    width: 36,
                    height: 46,
                    child: IgnorePointer(child: ExcludeSemantics(child: FittedBox(fit: BoxFit.contain, alignment: Alignment.bottomCenter, child: art))),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
