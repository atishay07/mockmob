import 'package:flutter/material.dart';

import '../../../core/art/art.dart';
import '../../../core/motion/flight.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'card_motion.dart';

/// A figure that rolls to a new value ([MmCountUp], from itself on first show), or the text as
/// given when it is not a whole number.
Widget _rollingNumber(String number, TextStyle style) {
  final n = int.tryParse(number);
  if (n == null) return Text(number, style: style);
  return MmCountUp(value: n, from: n, style: style);
}

/// The one lit element at the top of Practice, built on the same hero composition as Today's move
/// card (SPACING.md 4.1): a header band (overline, title, the length as a figure) with the
/// subject's object as a prop on the band's right, then the reason from the student's own record
/// full width, "Show me", and a full-width Start. One object on the card, no Mobi (the object is
/// the card's character).
class SuggestionCard extends StatelessWidget {
  const SuggestionCard({
    super.key,
    required this.subjectId,
    this.overline,
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
    this.actionKey,
    this.sheet,
    this.compact = false,
    this.showFigure = true,
  });

  /// Marks the Start key, so Mobi can point at it.
  final GlobalKey? actionKey;

  /// The painted answer sheet of an open session (the resume card only).
  final Widget? sheet;

  final String subjectId;
  /// A status line over the title ("Still open", "This one, then sleep"). Null on an ordinary
  /// suggestion: the title and kicker already say what it is, so no "Your next practice" eyebrow.
  final String? overline;
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

  /// The shorter card the Practice tab uses: the object at 88 dp in a 104 dp box, so the band and
  /// its key take less height. Nothing is cut: every line the full card has is still here.
  final bool compact;

  /// The length as a figure under the title. The compact Practice card hides it when its key
  /// already says the same ("Start 10 questions"); a resume keeps it ("23 of 50").
  final bool showFigure;

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

  /// The compact card's object box and object.
  static const double compactArtBox = 104;
  static const double compactEmblemSize = 88;
  static const double compactPad = 16;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final brightness = Theme.of(context).brightness;
    final light = SubjectLight.forSubject(subjectId) ?? SubjectLight.language;
    final surface = colors.isNight ? Color.lerp(colors.raised, colors.ground, 0.25)! : colors.raised;
    final art = compact ? compactArtBox : artBox;
    final emblem = compact ? compactEmblemSize : emblemSize;
    // The compact card takes 16 of padding in place of 20, and its figure is a 28 sp numeral.
    final pad = compact ? compactPad : SuggestionCard.pad;
    final clear = EdgeInsets.only(right: art - artBleedRight + MmSpace.s12 - pad);

    final band = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (overline != null) ...[
          Padding(
            padding: clear,
            child: Text(overline!, style: type.caption.copyWith(color: colors.ink2)),
          ),
          const SizedBox(height: MmSpace.s4),
        ],
        Padding(
          padding: clear,
          child: Semantics(
            header: true,
            // Three lines before any ellipsis: a subject name never reaches it, even at large text.
            child: Text(title, style: type.title, maxLines: 3, overflow: TextOverflow.ellipsis),
          ),
        ),
        if (kicker != null) ...[
          const SizedBox(height: MmSpace.s2),
          Padding(
            padding: clear,
            child: Text(kicker!, style: type.caption.copyWith(color: colors.ink2), maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
        ],
        if (showFigure) ...[
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
                  // A figure that changes (a pull brings a new answer count) rolls from what it showed;
                  // it never counts up from zero on first show.
                  _rollingNumber(number, compact ? type.figureCompact.copyWith(fontSize: 28) : type.figureCompact),
                  const SizedBox(width: MmSpace.s8),
                  Flexible(child: Text(unit, style: type.small.copyWith(color: colors.ink2), maxLines: 2)),
                ],
              ),
            ),
          ),
        ],
      ],
    );

    final body = Padding(
      padding: EdgeInsets.all(pad),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // The band is at least as tall as the object's box below its top inset, so the rows
          // under it never run beside the object.
          ConstrainedBox(
            constraints: BoxConstraints(minHeight: artTop + emblem - pad + MmSpace.s4),
            child: Align(alignment: Alignment.topLeft, child: band),
          ),
          SizedBox(height: compact ? MmSpace.s8 : MmSpace.s12),
          // One line (the copy is written to fit); only large text lets it wrap, so nothing is cut.
          // On the compact card "Show me" sits at the line's end, so the two share one row.
          if (compact && onShowMe != null && sheet == null) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(offline ? PracticeCopy.offlineStart : reason, style: type.small.copyWith(color: colors.ink), maxLines: 2, overflow: TextOverflow.ellipsis),
                ),
                const SizedBox(width: MmSpace.s8),
                ShowMePill(onTap: onShowMe!, semanticsLabel: PracticeCopy.showMeSemantics),
              ],
            ),
            const SizedBox(height: MmSpace.s8),
          ] else ...[
            Text(
              offline ? PracticeCopy.offlineStart : reason,
              style: type.small.copyWith(color: colors.ink),
              maxLines: offline || MediaQuery.textScalerOf(context).scale(1) > 1.2 ? null : 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (sheet != null) ...[const SizedBox(height: MmSpace.s12), sheet!],
            if (onShowMe != null) ...[
              const SizedBox(height: MmSpace.s4),
              Align(
                alignment: Alignment.centerLeft,
                child: ShowMePill(onTap: onShowMe!, semanticsLabel: PracticeCopy.showMeSemantics),
              ),
              const SizedBox(height: MmSpace.s4),
            ] else
              SizedBox(height: compact ? MmSpace.s12 : MmSpace.s16),
          ],
          KeyedSubtree(
            key: actionKey,
            // One light sweep across Start after 4 s with nothing touched, once per card.
            child: StartSheen(
              enabled: !offline && onAction != null,
              child: KeyButton(
                label: actionLabel,
                onPressed: offline || onAction == null
                    ? null
                    : () {
                        // The object flies into the confirm step's ticket (M2).
                        MmFlight.launch(context, subjectId);
                        onAction!();
                      },
              ),
            ),
          ),
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
            width: art,
            height: art,
            // The object floats and leans on its own (its life), riding a little against the scroll.
            child: IgnorePointer(
              child: MmParallax(factor: 0.1, lean: true, child: Center(child: SubjectEmblem(subject: subjectId, size: emblem, framed: false))),
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
