import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The one lit card at the top of Practice: the subject's light pooled behind its object, a
/// monumental number with its meaning, the title, the reason drawn from the student's own record
/// with a quiet "Show me", and the volt key. The art sits in the upper right; every line a
/// student reads sits on the left or below it, never on the object.
class SuggestionCard extends StatelessWidget {
  const SuggestionCard({
    super.key,
    required this.subjectId,
    required this.overline,
    required this.number,
    required this.unit,
    required this.title,
    required this.reason,
    required this.actionLabel,
    required this.onAction,
    this.kicker,
    this.onShowMe,
    this.numberSemantics,
  });

  final String subjectId;
  final String overline;
  final String number;
  final String unit;
  final String title;
  final String? kicker;
  final String reason;
  final VoidCallback? onShowMe;
  final String actionLabel;
  final VoidCallback? onAction;
  final String? numberSemantics;

  static const double _artSize = 176;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final light = SubjectLight.forSubject(subjectId) ?? SubjectLight.accountancy;
    final art = MmArt.subjectObject(subjectId);

    return LitEdge(
      glow: true,
      child: MmClip(
        borderRadius: MmRadius.panelAll,
        child: DecoratedBox(
          decoration: BoxDecoration(color: colors.isNight ? colors.raised : colors.raised),
          child: Stack(
            children: [
              Positioned.fill(
                child: LightField.subject(context, light, center: const Alignment(0.75, -0.55), strength: colors.isNight ? 1 : 0.9),
              ),
              if (art != null)
                Positioned(
                  right: -6,
                  top: 10,
                  width: _artSize,
                  height: _artSize * 0.86,
                  child: ArtImage(art, alignment: Alignment.topRight),
                ),
              Positioned.fill(child: IgnorePointer(child: Grain(opacity: colors.grain))),
              Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _FloorShade(colors.raised)))),
              Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s20, MmSpace.cardPadding, MmSpace.cardPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: EdgeInsets.only(right: art == null ? 0 : _artSize - 28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(overline, style: type.caption.copyWith(color: colors.ink2)),
                          const SizedBox(height: MmSpace.s8),
                          MergeSemantics(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                FittedBox(
                                  fit: BoxFit.scaleDown,
                                  alignment: Alignment.centerLeft,
                                  child: MonumentalNumber(value: number, style: type.figureHero, semanticsLabel: numberSemantics ?? number),
                                ),
                                Text(unit, style: type.labelLarge.copyWith(color: colors.ink2)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: MmSpace.s16),
                    Semantics(
                      header: true,
                      child: Text(title, style: type.headline),
                    ),
                    if (kicker != null) ...[
                      const SizedBox(height: MmSpace.s4),
                      Text(kicker!, style: type.labelLarge.copyWith(color: colors.ink2)),
                    ],
                    const SizedBox(height: MmSpace.s12),
                    Text(reason, style: type.body.copyWith(color: colors.ink)),
                    if (onShowMe != null) ...[
                      const SizedBox(height: MmSpace.s4),
                      ShowMeTag(onTap: onShowMe!),
                    ],
                    const SizedBox(height: MmSpace.s20),
                    KeyButton(label: actionLabel, onPressed: onAction),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Lets the light settle into the card's lower half, so the key and the reason sit on a calm,
/// even surface whatever the object's colours.
class _FloorShade extends CustomPainter {
  const _FloorShade(this.ground);

  final Color ground;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final shader = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [ground.withValues(alpha: 0), ground.withValues(alpha: 0), ground.withValues(alpha: 0.55)],
      stops: const [0, 0.45, 1],
    ).createShader(rect);
    canvas.drawRect(rect, Paint()..shader = shader);
  }

  @override
  bool shouldRepaint(_FloorShade old) => old.ground != ground;
}

/// "Show me": the quiet tag under a claim that opens the attempt behind it (brief 12.1).
class ShowMeTag extends StatelessWidget {
  const ShowMeTag({super.key, required this.onTap, this.label = PracticeCopy.showMe});

  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: type.label.copyWith(
                color: pressed ? colors.ink : colors.ink2,
                decoration: TextDecoration.underline,
                decorationColor: colors.ink3,
                decorationThickness: 1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
