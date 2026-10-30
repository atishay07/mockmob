import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../data/keycards_models.dart';
import '../data/keycards_providers.dart';
import '../data/keycards_reviews.dart';
import '../data/keycards_rules.dart';
import '../keycards_copy.dart';

/// A line with its blanks: in a question the gaps are drawn as an underlined space; in an answer the words
/// that carry marks are set a weight up with a quiet accent underline, so they stand out without shouting.
class KcBlankText extends StatelessWidget {
  const KcBlankText({super.key, required this.line, required this.style, this.semanticsLabel});

  final BlankedLine line;
  final TextStyle style;
  final String? semanticsLabel;

  /// Read aloud for a gap.
  static const String blankSpoken = 'blank';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final mark = colors.accentText;
    final spans = <InlineSpan>[
      for (final p in line.parts)
        if (!p.blank)
          TextSpan(text: p.text)
        else if (p.text.isEmpty)
          TextSpan(
            text: ' ' * 12,
            semanticsLabel: blankSpoken,
            style: TextStyle(decoration: TextDecoration.underline, decorationColor: colors.ink3, decorationThickness: 2),
          )
        else
          TextSpan(
            text: p.text,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              decoration: TextDecoration.underline,
              decorationColor: mark.withValues(alpha: mark.a * 0.7),
              decorationThickness: 2,
            ),
          ),
    ];
    return Text.rich(TextSpan(style: style, children: spans), semanticsLabel: semanticsLabel);
  }
}

/// The card's kind label and, for a Must-know card, its tag: "Definition" then a small "Must-know".
class KcKindLine extends StatelessWidget {
  const KcKindLine({super.key, required this.card, this.trailing, this.position});

  final KeyCard card;
  final Widget? trailing;

  /// "4 of 20", before the kind in a run.
  final String? position;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The words wrap before they would push the overflow off the row (large text, long labels).
    return Row(
      children: [
        Expanded(
          child: Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (position != null)
                Padding(
                  padding: const EdgeInsets.only(right: MmSpace.s4),
                  child: Text(position!, style: type.label.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
                ),
              Text(card.label, style: type.label.copyWith(color: colors.ink2)),
              if (card.mustKnow) const KcTag(text: KeyCardsCopy.mustKnow),
            ],
          ),
        ),
        ?trailing,
      ],
    );
  }
}

/// A small outlined tag: "Must-know", "CUET only", "CBSE teaches this in Class 11". Words, never colour alone.
class KcTag extends StatelessWidget {
  const KcTag({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: colors.lineStrong))),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: MmSpace.s2),
        child: Text(text, style: context.mmType.caption.copyWith(color: colors.ink2, height: 16 / 12)),
      ),
    );
  }
}

/// A chapter's state as words with a shape beside them (never colour alone): an open ring for not started,
/// a ring for too few answers, a ring with a mark for needs work, a ring with a dot for getting there, a ring
/// with a check for holding.
class KcStateLine extends StatelessWidget {
  const KcStateLine({super.key, required this.state, this.style});

  final KcChapterState state;
  final TextStyle? style;

  static IconData iconFor(String state) => switch (state) {
    'thin' => LucideIcons.circle,
    'weak' => LucideIcons.circleAlert,
    'mid' => LucideIcons.circleDot,
    'strong' => LucideIcons.circleCheck,
    _ => LucideIcons.circleDashed,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final text = style ?? context.mmType.small.copyWith(color: colors.ink2);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(iconFor(state.state), size: 14, color: state.state == 'strong' ? colors.goodText : colors.ink2),
        const SizedBox(width: MmSpace.s6),
        Flexible(child: Text(state.text, style: text)),
      ],
    );
  }
}

/// The book reference under a card, and its "In short" note when it has one.
class KcReference extends StatelessWidget {
  const KcReference({super.key, required this.card});

  final KeyCard card;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ref = card.source.reference;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (ref != null) Text(ref, style: type.caption.copyWith(color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()])),
        if (card.asked > 0) ...[
          const SizedBox(height: MmSpace.s2),
          Text(KeyCardsCopy.asked(card.asked), style: type.caption.copyWith(color: colors.ink3)),
        ],
        if (card.note != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text.rich(
            TextSpan(
              style: type.small.copyWith(color: colors.ink2),
              children: [
                TextSpan(text: '${KeyCardsCopy.inShort}. ', style: const TextStyle(fontWeight: FontWeight.w600)),
                TextSpan(text: card.note),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// The answer as the book prints it, in the reading style.
class KcBack extends StatelessWidget {
  const KcBack({super.key, required this.card});

  final KeyCard card;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final reading = type.body.copyWith(fontSize: 17, height: 26 / 17, color: context.mmColors.ink);
    if (card.blanks.isEmpty) return Text(card.back, style: reading);
    return KcBlankText(line: BlankedLine.marked(card.back, card.blanks), style: reading);
  }
}

/// One card in Read: the kind, the question as a small prompt, the book's words in the reading style with the
/// blanked words marked, the reference and the note. The overflow holds "Report this card".
class KcReadCard extends StatelessWidget {
  const KcReadCard({super.key, required this.card});

  final KeyCard card;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KcKindLine(card: card, trailing: KcCardMenu(card: card)),
            Text(card.front, style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s8),
            KcBack(card: card),
            const SizedBox(height: MmSpace.s8),
            KcReference(card: card),
          ],
        ),
      ),
    );
  }
}

/// The cards Free does not open, as one quiet row: how many, and one upgrade line. Never a wall of locks.
class KcLockedRow extends ConsumerWidget {
  const KcLockedRow({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final canUpgrade = ref.watch(proNudgesOnProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons.lock, size: 16, color: colors.ink3)),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(KeyCardsCopy.locked(count), style: type.body.copyWith(fontWeight: FontWeight.w500, fontFeatures: const [FontFeature.tabularFigures()])),
                const SizedBox(height: MmSpace.s2),
                Text(KeyCardsCopy.proLine, style: type.small.copyWith(color: colors.ink2)),
                if (canUpgrade) ...[
                  const SizedBox(height: MmSpace.s4),
                  KeyButton.quiet(label: KeyCardsCopy.upgrade, onPressed: () => showUpgradeSheetIfOn(context, reason: ProReason.keycards)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The small overflow on a card: "Report this card".
class KcCardMenu extends StatelessWidget {
  const KcCardMenu({super.key, required this.card});

  final KeyCard card;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      onTap: () => unawaited(showKcReportSheet(context, card: card)),
      semanticsLabel: KeyCardsCopy.moreActions,
      focusRadius: MmRadius.pillAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      builder: (context, pressed, _) => SizedBox.square(
        dimension: MmTarget.min,
        child: Icon(LucideIcons.ellipsis, size: 18, color: colors.ink2),
      ),
    );
  }
}

/// "Report this card": the reasons as one-tap rows. The report goes through the outbox, and the sheet says
/// only what really happened (sent, kept on the phone, or refused).
Future<void> showKcReportSheet(BuildContext context, {required KeyCard card}) => showMmSheet<void>(
  context: context,
  title: KeyCardsCopy.reportTitle,
  builder: (sheet) => _ReportBody(card: card),
);

class _ReportBody extends ConsumerStatefulWidget {
  const _ReportBody({required this.card});

  final KeyCard card;

  @override
  ConsumerState<_ReportBody> createState() => _ReportBodyState();
}

class _ReportBodyState extends ConsumerState<_ReportBody> {
  String? _sending;
  String? _said;

  Future<void> _send(String reason) async {
    if (_sending != null) return;
    setState(() {
      _sending = reason;
      _said = null;
    });
    final outcome = await ref.read(keyCardReviewsProvider).report(cardId: widget.card.id, reason: reason);
    if (!mounted) return;
    setState(() {
      _sending = null;
      _said = switch (outcome.kind) {
        KcSendKind.sent => KeyCardsCopy.reportSent,
        KcSendKind.waiting => KeyCardsCopy.reportWaiting,
        KcSendKind.proRequired || KcSendKind.failed => KeyCardsCopy.reportFailed,
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final done = _said == KeyCardsCopy.reportSent || _said == KeyCardsCopy.reportWaiting;
    return Padding(
      // The sheet already sets its side padding.
      padding: const EdgeInsets.only(bottom: MmSpace.s16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.card.front, style: type.small.copyWith(color: colors.ink2), maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: MmSpace.s12),
          if (!done)
            for (final r in KeyCardsCopy.reportReasons) ...[
              KeyButton.option(label: r, selected: _sending == r, onPressed: () => unawaited(_send(r))),
              const SizedBox(height: MmSpace.s8),
            ],
          if (_said != null) ...[
            const SizedBox(height: MmSpace.s4),
            Semantics(liveRegion: true, child: Text(_said!, style: type.body.copyWith(color: done ? colors.ink : colors.warnText))),
            const SizedBox(height: MmSpace.s16),
          ],
          if (done) KeyButton(label: KeyCardsCopy.finish, onPressed: () => Navigator.of(context).maybePop()),
        ],
      ),
    );
  }
}

/// Missed, Got it, Easy as three equal keys. None is the volt key at rest, so no rating is nudged; the one in
/// flight inks and the others wait. 1, 2 and 3 on a keyboard press them.
class KcRatingKeys extends StatelessWidget {
  const KcRatingKeys({super.key, required this.onRate, this.sending});

  final ValueChanged<int> onRate;
  final int? sending;

  static const List<(int, String)> keys = [
    (KeyCardRules.missed, KeyCardsCopy.missed),
    (KeyCardRules.gotIt, KeyCardsCopy.gotIt),
    (KeyCardRules.easy, KeyCardsCopy.easy),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(KeyCardsCopy.howDidItGo, style: context.mmType.label.copyWith(color: colors.ink2), textAlign: TextAlign.center),
        ),
        const SizedBox(height: MmSpace.s8),
        Row(
          children: [
            for (final (i, (rating, label)) in keys.indexed) ...[
              if (i > 0) const SizedBox(width: MmSpace.s8),
              Expanded(
                child: MmOverlapSwitcher(
                  fit: StackFit.passthrough,
                  child: sending == rating
                      ? KeyButton(key: ValueKey('kc-picked-$rating'), label: label, loading: true, onPressed: () {}, semanticsLabel: label)
                      : KeyButton.secondary(
                          key: ValueKey('kc-rest-$rating'),
                          label: label,
                          onPressed: sending != null ? null : () => onRate(rating),
                          semanticsLabel: label,
                        ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

/// One card face in a session: the question first; the whole well is the target that shows the answer (or
/// Space); then the book's words, the reference and the three rating keys.
class KcStudyFace extends StatelessWidget {
  const KcStudyFace({
    super.key,
    required this.card,
    required this.revealed,
    required this.onReveal,
    required this.onRate,
    this.sending,
    this.position,
    this.error,
  });

  final KeyCard card;
  final bool revealed;
  final VoidCallback onReveal;
  final ValueChanged<int> onRate;
  final int? sending;
  final String? position;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final question = card.hasBlanks
        ? KcBlankText(line: BlankedLine.front(card.front), style: type.question)
        : Text(card.front, style: type.question);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KcKindLine(card: card, position: position, trailing: KcCardMenu(card: card)),
        const SizedBox(height: MmSpace.s4),
        MmSurface.plain(
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 120),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [Semantics(header: true, child: question)],
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        MmOverlapSwitcher.fade(
          duration: Motion.card,
          alignment: Alignment.topCenter,
          child: revealed
              ? KeyedSubtree(key: const ValueKey('kc-answer'), child: _Answer(card: card))
              : KeyedSubtree(key: const ValueKey('kc-reveal'), child: _RevealWell(onTap: onReveal)),
        ),
        if (error != null) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(liveRegion: true, child: Text(error!, style: type.small.copyWith(color: colors.warnText))),
        ],
        if (revealed) ...[
          const SizedBox(height: MmSpace.s16),
          KcRatingKeys(onRate: onRate, sending: sending),
        ],
      ],
    );
  }
}

class _RevealWell extends StatelessWidget {
  const _RevealWell({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      highlight: true,
      focusRadius: MmRadius.panelAll,
      pressedScale: 0.985,
      haptic: MmPressHaptic.selection,
      semanticsLabel: KeyCardsCopy.tapToReveal,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(color: colors.sunken, shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line))),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 112),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(MmSpace.s16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.eye, size: 20, color: colors.ink3),
                  const SizedBox(height: MmSpace.s8),
                  Text(KeyCardsCopy.tapToReveal, style: type.body.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s2),
                  Text(KeyCardsCopy.revealHint, style: type.caption.copyWith(color: colors.ink3)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Answer extends StatelessWidget {
  const _Answer({required this.card});

  final KeyCard card;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      liveRegion: true,
      container: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: MmSelection.fill(colors, selected: true),
          shape: mmShapeBorder(MmRadius.panelAll, side: MmSelection.side(colors, selected: true)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmRhythm.plainPad),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KcBack(card: card),
              const SizedBox(height: MmSpace.s12),
              KcReference(card: card),
            ],
          ),
        ),
      ),
    );
  }
}

/// Space shows the answer; 1, 2 and 3 rate it (KEYCARDS-BUILD-SPEC 3, Study). Wraps a session so a hardware
/// keyboard works as the web's does.
class KcSessionKeys extends StatelessWidget {
  const KcSessionKeys({super.key, required this.child, required this.revealed, required this.onReveal, required this.onRate, this.enabled = true});

  final Widget child;
  final bool revealed;
  final bool enabled;
  final VoidCallback onReveal;
  final ValueChanged<int> onRate;

  @override
  Widget build(BuildContext context) {
    return Focus(
      autofocus: true,
      onKeyEvent: (node, event) {
        if (!enabled || event is! KeyDownEvent) return KeyEventResult.ignored;
        final key = event.logicalKey;
        if (!revealed && (key == LogicalKeyboardKey.space || key == LogicalKeyboardKey.enter)) {
          onReveal();
          return KeyEventResult.handled;
        }
        if (revealed) {
          final rating = switch (key) {
            LogicalKeyboardKey.digit1 || LogicalKeyboardKey.numpad1 => KeyCardRules.missed,
            LogicalKeyboardKey.digit2 || LogicalKeyboardKey.numpad2 => KeyCardRules.gotIt,
            LogicalKeyboardKey.digit3 || LogicalKeyboardKey.numpad3 => KeyCardRules.easy,
            _ => null,
          };
          if (rating != null) {
            onRate(rating);
            return KeyEventResult.handled;
          }
        }
        return KeyEventResult.ignored;
      },
      child: child,
    );
  }
}

/// Free met today's reviews: said once, in place, with the one upgrade key (never a modal on entry).
class KcReviewCapNote extends ConsumerWidget {
  const KcReviewCapNote({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmSurface.inset(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, liveRegion: true, child: Text(KeyCardsCopy.reviewCapTitle, style: type.cardTitle)),
          const SizedBox(height: MmSpace.s4),
          Text(KeyCardsCopy.reviewCapNote, style: type.small.copyWith(color: colors.ink2)),
          if (ref.watch(proNudgesOnProvider)) ...[
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: KeyCardsCopy.upgrade, onPressed: () => showUpgradeSheetIfOn(context, reason: ProReason.keycards)),
          ],
        ],
      ),
    );
  }
}
