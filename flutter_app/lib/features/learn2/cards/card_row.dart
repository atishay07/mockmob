// One card of the Cards view or of Find results (the website's CardList.jsx `Row`, phone band).
//
//   Folded    the kind line (the kind, then Must-know, Missed lately and In Revise as words), the front with the search's words
//             underlined, and "Show" on the right. About 64 dp tall.
//   Line      the NCERT line under the front, two lines, with the "Show answers" switch, with "Show", or by itself when a search
//             matched only NCERT's words (so the match is never hidden).
//   Open      a tap on the front: the row grows in place (240 ms) to NCERT's full words, the source, In short and its actions
//             (Study this card, Report). Only the open row shows actions.
//   Pick      a checkbox column that slides in while pick mode is on; the text keeps its place in a row that opens.
//
// The row is stateless: the list holds which row is open, which are shown and which are picked, so a row built again as it
// scrolls back into view looks as the student left it.
library;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../keycards/data/keycards_lines.dart' show cardFace;
import '../../keycards/data/keycards_models.dart' show KeyCard;
import '../../keycards/widgets/key_card_parts.dart' show KcBack;
import '../data/learn_models.dart' show LearnSpan;
import 'card_model.dart';
import 'card_parts.dart' show CardsTextKey;
import 'card_styles.dart';
import 'cards_copy.dart';
import 'cards_shared.dart';

class CardRow extends StatelessWidget {
  const CardRow({
    super.key,
    required this.entry,
    required this.open,
    required this.shown,
    required this.showAnswers,
    required this.pickMode,
    required this.picked,
    required this.last,
    required this.onOpen,
    required this.onShown,
    required this.onPick,
    required this.onStudy,
    required this.onReport,
    this.query = '',
    this.hideTags = const {},
  });

  final CardEntry entry;
  final bool open;

  /// "Show" was pressed on this row (its NCERT line is out).
  final bool shown;
  final bool showAnswers;
  final bool pickMode;
  final bool picked;

  /// The last row of its group: no hairline under it.
  final bool last;

  /// What the student searched (Find); empty in the Cards view.
  final String query;

  /// Words the list's own title already says (`must`, `missed`, `revise`): they are not drawn again on every row.
  final Set<String> hideTags;

  final VoidCallback onOpen;
  final VoidCallback onShown;
  final VoidCallback onPick;
  final ValueChanged<KeyCard> onStudy;
  final ValueChanged<KeyCard> onReport;

  /// How far the open surface reaches past the text on each side (the row keeps its text where it is).
  static const double surfaceOut = 10;

  /// The checkbox column.
  static const double pickColumn = 36;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final card = entry.card;
    final face = cardFace(card);
    final front = face.front;
    final spans = CardsModel.frontSpans(card, entry.match);
    final frontHit = spans.isNotEmpty;
    final searching = query.isNotEmpty;
    final backHit = searching &&
        (entry.match.spans('quote').isNotEmpty ||
            [card.back, card.quote].any((t) => t != null && CardsShared.hitParts(t, query).any((p) => p.hit)));
    // A match that sits only in NCERT's words is shown where it is; a match in the front needs no line.
    final byItself = backHit && !frontHit;
    final lineOn = showAnswers || shown || open || byItself;
    final source = searching && card.quote != null && !CardsShared.hitParts(card.back, query).any((p) => p.hit) ? card.quote! : card.back;
    final line = CardsShared.snippet(source, query, max: 210);
    final showKey = !showAnswers && !open && !byItself;

    final head = MmHitSlop(
      slop: EdgeInsets.only(top: 10, bottom: open ? 0 : 12),
      child: MmPressable(
        key: ValueKey('card-hit-${card.id}'),
        // The words on the row are its name (the kind line, then the front); "expanded" says whether it is open.
        focusRadius: const BorderRadius.all(Radius.circular(8)),
        pressedScale: 0.995,
        lift: false,
        highlight: true,
        excludeSemantics: false,
        haptic: MmPressHaptic.selection,
        onTap: onOpen,
        builder: (context, pressed, focused) => Semantics(
          expanded: open,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              _KindLine(label: face.label, must: card.mustKnow && !hideTags.contains('must'), missed: entry.missedLately && !hideTags.contains('missed'), inRevise: entry.inRevise && !hideTags.contains('revise')),
              _FrontText(front: front, spans: spans),
              MmSizeEase(
                duration: const Duration(milliseconds: 220),
                curve: Motion.out,
                alignment: Alignment.topLeft,
                clipBehavior: Clip.hardEdge,
                child: lineOn && !open
                    ? CardFadeIn(
                        duration: const Duration(milliseconds: 160),
                        child: Padding(padding: const EdgeInsets.only(top: 10), child: _FoldedLine(text: line, query: query)),
                      )
                    : const SizedBox(width: double.infinity),
              ),
            ],
          ),
        ),
      ),
    );

    final trailing = showKey
        ? Padding(
            padding: const EdgeInsets.only(left: MmSpace.s8),
            child: MmPressable(
              key: ValueKey('card-show-${card.id}'),
              semanticsLabel: shown ? CardsCopy.hideLabel(front) : CardsCopy.showLabel(front),
              selected: shown,
              focusRadius: const BorderRadius.all(Radius.circular(10)),
              pressedScale: 0.97,
              lift: false,
              haptic: MmPressHaptic.selection,
              onTap: onShown,
              builder: (context, pressed, focused) => ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 56, minHeight: MmTarget.min),
                child: Align(
                  alignment: Alignment.centerRight,
                  widthFactor: 1,
                  child: Text(
                    shown ? CardsCopy.hide : CardsCopy.show,
                    style: context.mmType.labelLarge.copyWith(fontSize: 14, height: 1, fontWeight: FontWeight.w600, color: pressed ? colors.ink : colors.ink2),
                  ),
                ),
              ),
            ),
          )
        : const SizedBox.shrink();

    final more = open
        ? CardFadeIn(
            child: _OpenBlock(card: card, onStudy: () => onStudy(card), onReport: () => onReport(card)),
          )
        : const SizedBox(width: double.infinity);

    final pickWidth = pickMode ? pickColumn : 0.0;
    final content = MmSizeEase(
      duration: const Duration(milliseconds: 240),
      curve: Motion.out,
      alignment: Alignment.topLeft,
      child: Padding(
        padding: EdgeInsets.fromLTRB(0, open ? 16 : 10, 0, open ? 10 : 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                MmSizeEase(
                  duration: const Duration(milliseconds: 180),
                  curve: Motion.out,
                  alignment: Alignment.centerLeft,
                  child: SizedBox(width: pickWidth),
                ),
                Expanded(child: head),
                trailing,
              ],
            ),
            if (open)
              Padding(
                padding: EdgeInsets.only(left: pickWidth, top: 14),
                child: more,
              ),
          ],
        ),
      ),
    );

    return Stack(
      clipBehavior: Clip.none,
      children: [
        if (open)
          Positioned(
            left: -surfaceOut,
            right: -surfaceOut,
            top: 0,
            bottom: 0,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.raised,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: colors.lineStrong),
                  boxShadow: colors.isNight ? null : [BoxShadow(color: colors.ink.withValues(alpha: 0.07), blurRadius: 12, offset: const Offset(0, 3))],
                ),
              ),
            ),
          ),
        content,
        if (!open && !last)
          Positioned(left: 0, right: 0, bottom: 0, height: 1, child: IgnorePointer(child: ColoredBox(color: colors.line))),
        if (pickMode)
          Positioned(
            left: 0,
            top: open ? 6 : 0,
            width: MmTarget.min,
            height: MmTarget.min,
            child: _PickBox(key: ValueKey('card-pick-${card.id}'), picked: picked, label: CardsCopy.pickThis(front), onTap: onPick),
          ),
      ],
    );
  }
}

/// The kind, then the words that say more about the card: Must-know in the accent, Missed lately in the warning colour,
/// In Revise as quiet words. Words, never colour alone.
class _KindLine extends StatelessWidget {
  const _KindLine({required this.label, required this.must, required this.missed, required this.inRevise});

  final String label;
  final bool must;
  final bool missed;
  final bool inRevise;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final base = CardStyles.kind(context);
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 18),
      child: Wrap(
        spacing: 12,
        runSpacing: 2,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(label, style: base),
          if (must) Text(CardsCopy.mustKnow, style: base.copyWith(color: colors.accentText, fontWeight: FontWeight.w700)),
          if (missed) Text(CardsCopy.missedLately, style: base.copyWith(color: colors.badText)),
          if (inRevise) Text(CardsCopy.inRevise, style: base),
        ],
      ),
    );
  }
}

/// The front, its blanks as underlined gaps (a term or key line) and the search's words underlined. A gap is one box that
/// wraps as a whole (the website's `.kc-gap`: 3.4 em wide with a 1.5 dp line under it), so it never splits at the end of a
/// line and leaves a blank nobody can see.
class _FrontText extends StatelessWidget {
  const _FrontText({required this.front, required this.spans});

  final String front;
  final List<LearnSpan> spans;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final hit = CardStyles.hitStyle(context);
    final style = CardStyles.front(context);
    final em = style.fontSize ?? 16.5;
    final parts = CardsModel.frontParts(front, spans);
    return Text.rich(
      TextSpan(
        style: style,
        children: [
          for (final p in parts)
            if (p.blank)
              WidgetSpan(
                alignment: PlaceholderAlignment.baseline,
                baseline: TextBaseline.alphabetic,
                child: Semantics(
                  label: 'blank',
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 0.18 * em),
                    child: Transform.translate(
                      offset: Offset(0, 0.18 * em),
                      child: SizedBox(
                        width: 3.4 * em,
                        height: em,
                        child: DecoratedBox(decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.ink3, width: 1.5)))),
                      ),
                    ),
                  ),
                ),
              )
            else
              TextSpan(text: p.text, style: p.hit ? hit : null),
        ],
      ),
    );
  }
}

/// The NCERT line folded under the front: two lines, a rule at its left, the search's words underlined.
class _FoldedLine extends StatelessWidget {
  const _FoldedLine({required this.text, required this.query});

  final String text;
  final String query;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final hit = CardStyles.hitStyle(context);
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(left: BorderSide(color: colors.lineStrong))),
      child: Padding(
        padding: const EdgeInsets.only(left: 12),
        child: Text.rich(
          TextSpan(
            style: CardStyles.fold(context),
            children: [for (final p in CardsShared.hitParts(text, query)) TextSpan(text: p.text, style: p.hit ? hit : null)],
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}

/// What an open row adds: NCERT's full words, the source, In short, and the actions.
class _OpenBlock extends StatelessWidget {
  const _OpenBlock({required this.card, required this.onStudy, required this.onReport});

  final KeyCard card;
  final VoidCallback onStudy;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final source = card.source.reference;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(border: Border(left: BorderSide(color: colors.lineStrong))),
          child: Padding(padding: const EdgeInsets.only(left: 16), child: KcBack(card: card)),
        ),
        if (source != null) ...[
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.only(left: 17),
            child: Text(source, style: type.caption.copyWith(fontSize: 13, height: 1.45, color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()])),
          ),
        ],
        if (card.note != null) ...[
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.only(left: 17),
            child: Text.rich(
              TextSpan(
                style: type.small.copyWith(fontSize: 14, height: 1.55, fontWeight: FontWeight.w500, color: colors.ink2),
                children: [
                  // The English deck's notes name themselves ("Synonym: clear."): "In short" would mislabel them.
                  if (card.source.isNcert) TextSpan(text: '${CardsCopy.inShort} ', style: TextStyle(fontWeight: FontWeight.w700, color: colors.ink)),
                  TextSpan(text: card.note),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 2,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            KeyButton.secondary(key: ValueKey('card-study-${card.id}'), label: CardsCopy.studyThisCard, expanded: false, minHeight: MmTarget.min, onPressed: onStudy),
            CardsTextKey(key: ValueKey('card-report-${card.id}'), label: CardsCopy.report, onTap: onReport),
          ],
        ),
      ],
    );
  }
}

/// The checkbox of a row in pick mode: 18 dp, the ink when picked; its target is the full 48 dp square.
class _PickBox extends StatelessWidget {
  const _PickBox({super.key, required this.picked, required this.label, required this.onTap});

  final bool picked;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      semanticsLabel: label,
      checked: picked,
      focusRadius: const BorderRadius.all(Radius.circular(10)),
      pressedScale: 0.94,
      lift: false,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, focused) => SizedBox.square(
        dimension: MmTarget.min,
        child: Align(
          alignment: Alignment.centerLeft,
          child: AnimatedContainer(
            duration: Motion.of(context, const Duration(milliseconds: 150)),
            curve: Motion.out,
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              color: picked ? colors.ink : colors.raised,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: picked ? colors.ink : colors.lineStrong, width: 1.5),
            ),
            child: picked ? Icon(LucideIcons.check, size: 13, color: colors.ground) : null,
          ),
        ),
      ),
    );
  }
}
