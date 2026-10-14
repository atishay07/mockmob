import 'package:flutter/material.dart';

import '../../../core/art/art.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The one lit element at the top of Practice, built on the same hero composition as Today's move
/// card (SPACING.md 4.1): a header band (overline, title, the length as a figure) with the
/// subject's object as a prop on the band's right, then the reason from the student's own record
/// full width, "Show me", and a full-width Start. One object on the card, no Mobi (the object is
/// the card's character).
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
    this.offline = false,
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

  /// The phone is offline and this start needs the server: the reason line says so and the key is
  /// quiet, in the card itself, instead of a banner above it that contradicts a live key.
  final bool offline;

  /// Hero tier: 20 padding, 28 radius.
  static const double pad = 20;
  static const double radius = 28;
  static const BorderRadius borderRadius = BorderRadius.all(Radius.circular(radius));

  /// The object's box and the object drawn in it (SPACING.md 4.1): 8 dp from the top, bled 10 dp
  /// past the right edge, never cropped by the top.
  static const double artBox = 156;
  static const double emblemSize = EmblemSizes.hero;
  static const double artTop = 8;
  static const double artBleedRight = 10;

  /// What the band's text keeps clear of, from the card's right edge: the art box minus its bleed,
  /// plus 12 dp of air.
  static const double artClear = artBox - artBleedRight + MmSpace.s12;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final brightness = Theme.of(context).brightness;
    final light = SubjectLight.forSubject(subjectId) ?? SubjectLight.language;
    final surface = colors.isNight ? Color.lerp(colors.raised, colors.ground, 0.25)! : colors.raised;
    const clear = EdgeInsets.only(right: artClear - pad);

    final band = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: clear,
          child: Text(overline, style: type.caption.copyWith(color: colors.ink2)),
        ),
        const SizedBox(height: MmSpace.s4),
        Padding(
          padding: clear,
          child: Semantics(
            header: true,
            child: Text(title, style: type.title, maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
        ),
        if (kicker != null) ...[
          const SizedBox(height: MmSpace.s2),
          Padding(
            padding: clear,
            child: Text(kicker!, style: type.caption.copyWith(color: colors.ink2), maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
        ],
        const SizedBox(height: MmSpace.s12),
        // The length (or the answers so far) with its unit beside it, on one baseline.
        Padding(
          padding: clear,
          child: Semantics(
            label: numberSemantics ?? '$number $unit',
            excludeSemantics: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(number, style: type.figureCompact),
                const SizedBox(width: MmSpace.s8),
                Flexible(child: Text(unit, style: type.small.copyWith(color: colors.ink2), maxLines: 2)),
              ],
            ),
          ),
        ),
      ],
    );

    final body = Padding(
      padding: const EdgeInsets.all(pad),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // The band is at least as tall as the object's box below its top inset, so the rows
          // under it never run beside the object.
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: artTop + emblemSize - pad + MmSpace.s4),
            child: Align(alignment: Alignment.topLeft, child: band),
          ),
          const SizedBox(height: MmSpace.s12),
          Text(offline ? PracticeCopy.offlineStart : reason, style: type.small.copyWith(color: colors.ink)),
          if (onShowMe != null) ...[
            const SizedBox(height: MmSpace.s4),
            Align(
              alignment: Alignment.centerLeft,
              child: ShowMePill(onTap: onShowMe!, semanticsLabel: PracticeCopy.showMeSemantics),
            ),
            const SizedBox(height: MmSpace.s4),
          ] else
            const SizedBox(height: MmSpace.s16),
          KeyButton(label: actionLabel, onPressed: offline ? null : onAction),
        ],
      ),
    );

    final panel = MmClip(
      borderRadius: borderRadius,
      child: Stack(
        children: [
          Positioned.fill(child: ColoredBox(color: surface)),
          // The subject's light pooled behind the object, and the room's lamp from the upper left.
          Positioned.fill(
            child: LightField(
              pools: [
                LightPool(
                  color: light.of(brightness),
                  center: const Alignment(0.78, -0.78),
                  radius: 0.78,
                  strength: colors.isNight ? 1.15 : 0.95,
                ),
                LightPool(
                  color: colors.lamp.withValues(alpha: colors.isNight ? 0.2 : 0.13),
                  center: const Alignment(-1.05, -1.1),
                  radius: 0.75,
                  aspect: 1.3,
                ),
              ],
            ),
          ),
          Positioned(
            top: artTop,
            right: -artBleedRight,
            width: artBox,
            height: artBox,
            child: IgnorePointer(
              child: Center(child: SubjectEmblem(subject: subjectId, size: emblemSize, framed: false)),
            ),
          ),
          body,
        ],
      ),
    );

    return LitEdge(
      glow: true,
      borderRadius: borderRadius,
      child: CustomPaint(
        foregroundPainter: EdgeLightPainter(
          borderRadius: borderRadius,
          top: colors.edgeTop,
          bottom: colors.edgeBottom,
          lamp: colors.isNight ? colors.lamp : null,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: borderRadius, boxShadow: colors.isNight ? colors.glassShadow : colors.cardShadow),
          child: panel,
        ),
      ),
    );
  }
}
