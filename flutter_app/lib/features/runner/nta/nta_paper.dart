import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/question.dart';
import '../../../core/theme/theme.dart';
import 'nta_chip.dart';
import 'nta_copy.dart';
import 'nta_option.dart';
import 'nta_skin.dart';

/// The exam paper card (section 4): a head with "Question 12" (or "Passage set"), the chapter
/// and difficulty tags and the A- / A+ text size, then the passage, the state of this question
/// with Mark / Unmark, the question and its options.
class NtaPaper extends StatelessWidget {
  const NtaPaper({
    super.key,
    required this.question,
    required this.number,
    required this.state,
    required this.selected,
    required this.marked,
    required this.canAnswer,
    required this.onSelect,
    required this.onMark,
    required this.textScale,
    required this.onTextStep,
    this.passageRange,
    this.leading = const [],
  });

  final SessionQuestion question;

  /// One-based.
  final int number;
  final NtaChipState state;
  final int? selected;
  final bool marked;
  final bool canAnswer;
  final ValueChanged<int> onSelect;
  final ValueChanged<bool> onMark;
  final double textScale;

  /// -1 or +1; null at the end of the scale on that side is handled by the caller.
  final void Function(int delta)? onTextStep;
  final (int, int)? passageRange;
  final List<Widget> leading;

  @override
  Widget build(BuildContext context) {
    final skin = NtaSkin.of(context);
    final colors = skin.colors;
    final type = context.mmType;
    final passage = question.passageText;
    final hasPassage = passage != null && passage.isNotEmpty;
    final qStyle = type.question.copyWith(fontSize: 18 * textScale, height: 1.55);
    final oStyle = type.body.copyWith(fontSize: 16 * textScale, height: 1.45);

    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedRectangleBorder(borderRadius: NtaSkin.radiusAll, side: BorderSide(color: colors.line)),
        shadows: colors.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Head(
            title: hasPassage ? NtaCopy.passageSet : NtaCopy.questionTitle(number),
            tags: [
              if (question.chapter case final c? when c.isNotEmpty) c,
              if (question.difficulty case final d? when d.isNotEmpty) NtaCopy.difficulty(d),
            ],
            onTextStep: onTextStep,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ...leading,
                if (hasPassage) ...[_Passage(text: passage, range: passageRange, scale: textScale), const SizedBox(height: MmSpace.s16)],
                MediaQuery.withClampedTextScaling(
                  maxScaleFactor: 1.3,
                  child: Row(
                    children: [
                      NtaChip(state: state, label: '$number', size: const Size(30, 26), fontSize: 11.5),
                      const SizedBox(width: MmSpace.s8),
                      Expanded(
                        child: Semantics(
                          label: '${NtaCopy.questionTitle(number)}, ${state.label.toLowerCase()}',
                          excludeSemantics: true,
                          child: Text(state.label, style: type.caption.copyWith(color: colors.ink2)),
                        ),
                      ),
                      _MarkKey(marked: marked, onTap: canAnswer ? () => onMark(!marked) : null),
                    ],
                  ),
                ),
                const SizedBox(height: MmSpace.s12),
                Semantics(header: true, child: Text(question.question, style: qStyle.copyWith(color: colors.ink))),
                if (question.body case final b? when b.isNotEmpty) ...[
                  const SizedBox(height: MmSpace.s8),
                  Text(b, style: oStyle.copyWith(color: colors.ink)),
                ],
                const SizedBox(height: MmSpace.s20),
                for (var i = 0; i < question.options.length; i++) ...[
                  if (i > 0) const SizedBox(height: MmSpace.s8),
                  NtaOption(
                    letter: question.options[i].key,
                    text: question.options[i].text,
                    selected: selected == i,
                    onSelect: canAnswer ? () => onSelect(i) : null,
                    textStyle: oStyle,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Head extends StatelessWidget {
  const _Head({required this.title, required this.tags, required this.onTextStep});

  final String title;
  final List<String> tags;
  final void Function(int delta)? onTextStep;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised2.withValues(alpha: 0.55),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(NtaSkin.radius)),
        border: Border(bottom: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s8, MmSpace.s4, MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Semantics(header: true, child: Text(title, style: type.cardTitle))),
                if (onTextStep != null) ...[
                  _SizeKey(label: 'A−', semantics: NtaCopy.smaller, onTap: () => onTextStep!(-1)),
                  _SizeKey(label: 'A+', semantics: NtaCopy.larger, onTap: () => onTextStep!(1)),
                ],
              ],
            ),
            if (tags.isNotEmpty)
              Wrap(
                spacing: MmSpace.s6,
                runSpacing: MmSpace.s6,
                children: [
                  for (final t in tags)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 3),
                      decoration: BoxDecoration(
                        color: colors.raised,
                        borderRadius: const BorderRadius.all(Radius.circular(6)),
                        border: Border.all(color: colors.line),
                      ),
                      child: Text(t, style: type.caption.copyWith(color: colors.ink2, fontSize: 12)),
                    ),
                ],
              ),
          ],
        ),
      ),
      ),
    );
  }
}

class _SizeKey extends StatelessWidget {
  const _SizeKey({required this.label, required this.semantics, required this.onTap});

  final String label;
  final String semantics;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      button: true,
      label: semantics,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 22,
        child: SizedBox.square(
          dimension: 44,
          child: Center(
            child: Text(
              label,
              textScaler: TextScaler.noScaling,
              style: context.mmType.label.copyWith(color: colors.ink2, fontSize: label == 'A+' ? 15 : 13),
            ),
          ),
        ),
      ),
    );
  }
}

/// "Mark" with a flag outline, "Unmark" with a filled purple flag once marked.
class _MarkKey extends StatelessWidget {
  const _MarkKey({required this.marked, required this.onTap});

  final bool marked;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final tone = marked ? (NtaSkin.of(context).dark ? NtaSkin.markedLight : NtaSkin.purple) : colors.ink2;
    return Semantics(
      button: true,
      toggled: marked,
      label: NtaCopy.markSemantics,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: NtaSkin.keyRadius,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48, minWidth: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(marked ? LucideIcons.flagOff : LucideIcons.flag, size: 16, color: tone),
                const SizedBox(width: MmSpace.s6),
                Text(marked ? NtaCopy.unmark : NtaCopy.mark, style: type.label.copyWith(color: tone)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The passage, once, in a sunken well that scrolls on its own past 40% of the screen.
class _Passage extends StatelessWidget {
  const _Passage({required this.text, required this.range, required this.scale});

  final String text;
  final (int, int)? range;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.sunken,
        borderRadius: NtaSkin.keyRadius,
        border: Border.all(color: colors.line),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.4),
        child: Scrollbar(
          child: SingleChildScrollView(
            primary: false,
            padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(LucideIcons.bookOpen, size: 14, color: colors.ink3),
                    const SizedBox(width: MmSpace.s6),
                    Text(NtaCopy.passage, style: type.label.copyWith(color: colors.ink2)),
                    if (range != null) ...[
                      const SizedBox(width: MmSpace.s8),
                      Expanded(
                        child: Text(
                          NtaCopy.passageRange(range!.$1, range!.$2),
                          textAlign: TextAlign.end,
                          style: type.caption.copyWith(color: colors.ink3),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: MmSpace.s8),
                Text(text, style: type.body.copyWith(color: colors.ink, fontSize: 15.5 * scale, height: 1.7)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
