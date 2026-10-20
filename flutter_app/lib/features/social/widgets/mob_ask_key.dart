// The Ask Mobi key in the Mob's header (ASK-MOBI-1019 B), sized so the screen title is never cut (B1, 20 Oct).
//
// The header row is: the account key or Back, the title ("Your Mob"), then this key. At normal text the key is the
// labelled capsule ("Ask Mobi"). When the title would no longer fit beside it (large text), the capsule says "Ask"
// beside Mobi; when even that is too wide, Mobi's mark alone in a 44 dp glass disc, a 48 dp target, the same disc
// as the back key. It is always spoken as "Ask Mobi".

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/ask_mobi.dart' show AskKeyLabel, AskMobiButton, openAskMobiScreen;
import '../../insights/data/ask_doors.dart' show AskDoorCopy;
import '../../insights/widgets/mobi_mark.dart';
import '../../you/widgets/you_page.dart' show GlassDisc;

class MobAskKey extends StatelessWidget {
  const MobAskKey({super.key, required this.title});

  /// The title the key shares its row with.
  final String title;

  /// The row's lead: the account key (or Back) and the 12 dp gap after it.
  static const double _lead = MmTarget.min + MmSpace.s12;

  /// The capsule's own room around its words: 12 dp, Mobi's 20 dp mark, 8 dp, and 15 dp after the words.
  static const double _capsulePad = 12 + 20 + 8 + 15;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final scaler = MediaQuery.textScalerOf(context);
    double widthOf(String text, TextStyle style) {
      final p = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler, maxLines: 1)..layout();
      final w = p.width;
      p.dispose();
      return w;
    }

    final row = math.min(MediaQuery.sizeOf(context).width, MmSpace.contentMaxWidth) - 2 * MmSpace.gutter;
    final title = widthOf(this.title, type.screenTitle);
    final words = type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600);
    // A 4 dp margin so a title that only just fits is never cut by rounding.
    bool fits(double key) => title + 4 <= row - _lead - MmSpace.s12 - key;
    if (fits(_capsulePad + widthOf(AskDoorCopy.button, words))) return const AskMobiButton();
    if (fits(_capsulePad + widthOf(AskDoorCopy.buttonShort, words))) return const AskMobiButton(label: AskKeyLabel.short);
    return const _AskMark();
  }
}

/// Mobi's mark alone, in the back key's glass disc.
class _AskMark extends StatelessWidget {
  const _AskMark();

  @override
  Widget build(BuildContext context) {
    return MmPressable(
      key: const ValueKey('mob-ask-mark'),
      semanticsLabel: AskDoorCopy.button,
      onTap: () => openAskMobiScreen(context),
      pressedScale: 0.94,
      haptic: MmPressHaptic.selection,
      focusRadius: MmRadius.pillAll,
      builder: (context, pressed, _) => SizedBox.square(
        dimension: MmTarget.min,
        child: Center(child: GlassDisc(pressed: pressed, child: const ExcludeSemantics(child: MobiMark(size: 24)))),
      ),
    );
  }
}
