import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/ask_doors.dart';
import '../data/insights_repository.dart';
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

/// The labelled "Ask Mobi" key in a tab's header (ASK-MOBI-1019 B; D112): a glass capsule with Mobi
/// and the words, so a student new to apps never has to guess that the mascot is a button.
///
/// [figure] is the Mobi the header already has (Today's greeting Mobi, Practice's resident one), so
/// he is never on the screen twice; the capsule's tap opens Ask Mobi and his own taps rest. With no
/// figure the capsule carries Mobi's flat mark. [short] says "Ask" where the header is tight (Today
/// at 360 dp); the spoken label is always "Ask Mobi".
class AskMobiButton extends ConsumerWidget {
  const AskMobiButton({super.key, this.figure, this.onTap, this.short = false});

  final Widget? figure;
  final VoidCallback? onTap;
  final bool short;

  /// The capsule's height; its target is 48 dp.
  static const double height = 44;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final art = figure;
    return MmPressable(
      semanticsLabel: AskDoorCopy.button,
      onTap: () {
        // The record is read as the screen opens; start it now so the doors arrive filled.
        ref.read(insightsRepositoryProvider.notifier).refresh();
        (onTap ?? () => openAskMobiScreen(context))();
      },
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
                            short ? AskDoorCopy.buttonShort : AskDoorCopy.button,
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
