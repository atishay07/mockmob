import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderAbstractViewport;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../data/keycards_lines.dart';
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

/// The card's kind label and, for a Must-know card, the word: "Definition" then "Must-know" in the accent text, no
/// box (Learn v2 DESIGN-SPEC 3.10, LK13: the word marks it, a pill on every card shouted).
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
              Text(cardFace(card).label, style: type.label.copyWith(color: colors.ink2)),
              if (card.mustKnow) Text(KeyCardsCopy.mustKnow, style: type.label.copyWith(color: colors.accentText)),
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

/// The answer as the book prints it, in the reading style. Where the book breaks the answer into lines, each line
/// is its own paragraph (a list's items with a bullet unless the book numbers them), and a journal entry is set
/// out as the book sets it: the debit with "Dr." at the right, the credits indented under it, the narration
/// below. [compact] is the smaller reading size of a block inside another screen (The line you needed).
class KcBack extends StatelessWidget {
  const KcBack({super.key, required this.card, this.compact = false});

  final KeyCard card;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final reading = compact
        ? type.body.copyWith(fontSize: 15.5, height: 23 / 15.5, color: context.mmColors.ink)
        : type.body.copyWith(fontSize: 17, height: 26 / 17, color: context.mmColors.ink);
    return switch (backShape(card)) {
      KcListBack(:final paragraphs) => KcParagraphs(paragraphs: paragraphs, style: reading),
      final KcFormulaBack f => KcParagraphs(
        paragraphs: [for (final t in f.texts) (text: t, bullet: false)],
        style: reading,
        tight: true,
      ),
      KcEntryBack(:final rows) => KcEntryText(rows: joinedNarrations(rows), style: reading),
      KcParasBack(:final paras) => paras.length == 1 ? _para(paras.first, reading) : _paras(paras, reading),
    };
  }

  static Widget _para(List<KcPart> parts, TextStyle style) {
    if (parts.any((p) => p.mark)) {
      return KcBlankText(line: BlankedLine([for (final p in parts) (text: p.text, blank: p.mark)]), style: style);
    }
    return Text(parts.map((p) => p.text).join(), style: style);
  }

  static Widget _paras(List<List<KcPart>> paras, TextStyle style) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (final (i, p) in paras.indexed) ...[
        if (i > 0) const SizedBox(height: MmSpace.s6),
        _para(p, style),
      ],
    ],
  );
}

/// A back the book breaks into lines: one paragraph a line, a list item with a small bullet hung in the margin.
class KcParagraphs extends StatelessWidget {
  const KcParagraphs({super.key, required this.paragraphs, required this.style, this.tight = false});

  final List<KcParagraph> paragraphs;
  final TextStyle style;

  /// A formula's second line ("= ...") stays close to its first.
  final bool tight;

  @override
  Widget build(BuildContext context) {
    final lineHeight = MediaQuery.textScalerOf(context).scale(style.fontSize ?? 16) * (style.height ?? 1.4);
    const dot = 5.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, p) in paragraphs.indexed) ...[
          if (i > 0) SizedBox(height: tight ? MmSpace.s2 : MmSpace.s6),
          if (p.bullet)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: Padding(
                    padding: EdgeInsets.only(top: (lineHeight - dot) / 2, right: MmSpace.s12 - 1),
                    child: DecoratedBox(
                      decoration: ShapeDecoration(shape: const CircleBorder(), color: context.mmColors.ink3),
                      child: const SizedBox.square(dimension: dot),
                    ),
                  ),
                ),
                Expanded(child: Text(p.text, style: style)),
              ],
            )
          else
            Text(p.text, style: style),
        ],
      ],
    );
  }
}

/// A journal entry as the book sets it out: each debit with "Dr." at the right, "To" each credit indented under
/// the debits, the narration in a quieter size below. The words are the card's own.
class KcEntryText extends StatelessWidget {
  const KcEntryText({super.key, required this.rows, required this.style});

  final List<KcEntryRow> rows;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final narration = style.copyWith(fontSize: (style.fontSize ?? 16) - 2, height: 1.45, color: colors.ink2);
    final children = <Widget>[];
    for (final (i, row) in rows.indexed) {
      final previous = i == 0 ? null : rows[i - 1].kind;
      // A new entry (a debit after a credit or a narration) starts a little apart.
      final gap = switch (row.kind) {
        _ when i == 0 => 0.0,
        KcEntryRowKind.narration => MmSpace.s4,
        KcEntryRowKind.debit when previous != KcEntryRowKind.debit => MmSpace.s12,
        _ => MmSpace.s2,
      };
      if (gap > 0) children.add(SizedBox(height: gap));
      children.add(switch (row.kind) {
        KcEntryRowKind.debit => Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text(row.text, style: style)),
            const SizedBox(width: MmSpace.s12),
            Text('Dr.', style: style),
            if (row.amount != null) ...[const SizedBox(width: MmSpace.s12), Text(row.amount!, style: style)],
          ],
        ),
        KcEntryRowKind.credit => Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Padding(padding: const EdgeInsets.only(left: MmSpace.s24), child: Text(row.text, style: style))),
            if (row.amount != null) ...[const SizedBox(width: MmSpace.s12), Text(row.amount!, style: style)],
          ],
        ),
        KcEntryRowKind.narration => Text(row.text, style: narration),
        KcEntryRowKind.plain => Text(row.text, style: style),
      });
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }
}

/// One card in Read: the kind, the question as a small prompt (not for a term or key line, whose marked words
/// already show it), the book's words in the reading style with the blanked words marked, the reference and
/// the note. The overflow holds "Report this card".
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
            // A term or key line asks with the line itself: its marked words say what was blanked, so the
            // prompt would only repeat the line.
            if (!card.hasBlanks) ...[
              Text(cardFace(card).front, style: type.small.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s8),
            ] else
              const SizedBox(height: MmSpace.s4),
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
                if (canUpgrade) KcLinkAction(label: KeyCardsCopy.upgrade, onTap: () => showUpgradeSheetIfOn(context, reason: ProReason.keycards)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A quiet action set on the text edge (Share chapter sheet, Add to Revise, Upgrade to Pro): the words
/// underlined, a 44 dp target, the same look as Review's lesson link. [onTap] null: dimmed and inert.
class KcLinkAction extends StatelessWidget {
  const KcLinkAction({super.key, required this.label, required this.onTap, this.busy = false});

  final String label;
  final VoidCallback? onTap;

  /// Sending: the words fade a step and the link waits.
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final live = onTap != null && !busy;
    return MmPressable(
      onTap: live ? onTap : null,
      pressedScale: 0.985,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: label,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Align(
          alignment: Alignment.centerLeft,
          widthFactor: 1,
          child: AnimatedOpacity(
            opacity: live ? 1 : 0.5,
            duration: Motion.of(context, Motion.ui),
            curve: Motion.out,
            child: Text(
              label,
              style: type.labelLarge.copyWith(fontSize: 14.5, decoration: TextDecoration.underline, decorationColor: colors.lineStrong, color: colors.ink),
            ),
          ),
        ),
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
          Text(cardFace(widget.card).front, style: type.small.copyWith(color: colors.ink2), maxLines: 2, overflow: TextOverflow.ellipsis),
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

/// One card face in a session (Study, and Revise's Key cards): one card, the question first. Show the answer
/// (or a tap on the card, or Space) opens the book's words under a hairline in the same card, with the
/// reference; then the three rating keys take the reveal key's place.
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
    this.showChapter = false,
  });

  final KeyCard card;
  final bool revealed;
  final VoidCallback onReveal;
  final ValueChanged<int> onRate;
  final int? sending;
  final String? position;
  final String? error;

  /// Revise mixes chapters and subjects: there the card names its chapter above itself.
  final bool showChapter;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Once the answer shows, the question steps back a shade so the book's words lead.
    final ask = type.question.copyWith(color: revealed ? colors.ink2 : colors.ink);
    final question = card.hasBlanks ? KcBlankText(line: BlankedLine.front(cardFace(card).front), style: ask) : Text(cardFace(card).front, style: ask);
    final face = MmSurface.plain(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: question),
          if (revealed)
            MmEntrance(
              rise: 8,
              child: Semantics(
                liveRegion: true,
                container: true,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: MmSpace.s16),
                    Divider(height: 1, thickness: 1, color: colors.line),
                    const SizedBox(height: MmSpace.s16),
                    KcBack(card: card),
                    const SizedBox(height: MmSpace.s12),
                    KcReference(card: card),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
    // The face keeps its keys on screen: the answer can be long and the page above it tall (a chapter's header,
    // Revise's head), and the student should never have to scroll to rate a card.
    return KcKeepInView(
      trigger: (card.id, revealed),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KcKindLine(card: card, position: position, trailing: KcCardMenu(card: card)),
          if (showChapter && card.chapter != null) ...[
            Text(card.chapter!, style: type.caption.copyWith(color: colors.ink3)),
            const SizedBox(height: MmSpace.s8),
          ] else
            const SizedBox(height: MmSpace.s4),
          if (revealed)
            face
          else
            // The whole card is a target too: a tap anywhere on the question shows the answer. A screen reader
            // reads the question here and finds the action on the key below.
            MmPressable(
              onTap: onReveal,
              pressedScale: 0.99,
              focusRadius: MmRadius.panelAll,
              haptic: MmPressHaptic.selection,
              button: false,
              excludeSemantics: false,
              builder: (context, pressed, _) => face,
            ),
          if (error != null) ...[
            const SizedBox(height: MmSpace.s12),
            Semantics(liveRegion: true, child: Text(error!, style: type.small.copyWith(color: colors.warnText))),
          ],
          const SizedBox(height: MmSpace.s16),
          MmOverlapSwitcher.fade(
            duration: Motion.ui,
            alignment: Alignment.topCenter,
            child: revealed
                ? KeyedSubtree(key: const ValueKey('kc-rate'), child: KcRatingKeys(onRate: onRate, sending: sending))
                : KeyedSubtree(
                    key: const ValueKey('kc-reveal'),
                    child: KeyButton(label: KeyCardsCopy.tapToReveal, onPressed: onReveal, hapticOnCommit: false),
                  ),
          ),
        ],
      ),
    );
  }
}

/// Keeps a session card and its keys on screen. When [trigger] changes (the answer shows, the next card comes)
/// and the bottom of [child] sits below the fold, the page moves just far enough to show it, never past the top
/// of [child]; when the top of [child] sits above the fold, the page moves back to it. Nothing moves when it
/// all shows already, or when there is no page to move.
class KcKeepInView extends StatefulWidget {
  const KcKeepInView({super.key, required this.trigger, required this.child});

  final Object trigger;
  final Widget child;

  @override
  State<KcKeepInView> createState() => _KcKeepInViewState();
}

class _KcKeepInViewState extends State<KcKeepInView> {
  @override
  void initState() {
    super.initState();
    _schedule();
  }

  @override
  void didUpdateWidget(KcKeepInView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.trigger != widget.trigger) _schedule();
  }

  void _schedule() => WidgetsBinding.instance.addPostFrameCallback((_) => _keep());

  void _keep() {
    if (!mounted) return;
    final box = context.findRenderObject();
    final scrollable = Scrollable.maybeOf(context);
    if (box is! RenderBox || !box.attached || !box.hasSize || scrollable == null) return;
    final viewport = RenderAbstractViewport.maybeOf(box);
    final position = scrollable.position;
    if (viewport == null || !position.hasContentDimensions || !position.hasPixels) return;
    // A little air above the card, and its keys clear of the system's gesture bar at the bottom of the page.
    final top = viewport.getOffsetToReveal(box, 0).offset - MmSpace.s8;
    final end = viewport.getOffsetToReveal(box, 1).offset + MediaQuery.paddingOf(context).bottom + MmSpace.s16;
    var target = position.pixels;
    if (end > target) target = end;
    if (target > top) target = top;
    target = target.clamp(position.minScrollExtent, position.maxScrollExtent);
    if ((target - position.pixels).abs() < 1) return;
    if (Motion.reduced(context)) {
      position.jumpTo(target);
    } else {
      unawaited(position.animateTo(target, duration: Motion.ui, curve: Motion.out));
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
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
