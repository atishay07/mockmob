import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/question.dart';
import '../../../core/theme/theme.dart';
import 'nta_chip.dart';
import 'nta_copy.dart';
import 'nta_option.dart';
import 'nta_skin.dart';
import 'nta_text_size.dart';

/// The exam paper (section 4): a head with "Question 12" (or "Passage set"), the chapter and
/// difficulty and the A- / A+ text size, then the passage, the state of this question with Mark /
/// Unmark, the question and its options.
///
/// The exam look is the paper the student will meet on exam day: a white card with a head and
/// boxed options. In the MockMob look the same content lies open on the page, like the practice
/// and mock runner: no panel, no head card, hairline option rows, the app's accent for the chosen
/// one.
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

  /// -1 or +1. At the end of the scale the key on that side is dimmed and does nothing.
  final void Function(int delta)? onTextStep;
  final (int, int)? passageRange;
  final List<Widget> leading;

  @override
  Widget build(BuildContext context) {
    final skin = NtaSkin.of(context);
    final colors = skin.colors;
    final passage = question.passageText;
    final hasPassage = passage != null && passage.isNotEmpty;
    // The A+ step multiplies the phone's own text size; the two together are capped (NTA-04).
    final system = MediaQuery.textScalerOf(context).scale(1);
    final step = NtaTextStep.paperStep(textScale, system);
    final qStyle = skin.type.question(step);
    final oStyle = skin.type.option(step);
    final open = !NtaExamLook.of(context);

    final head = _Head(
      title: hasPassage ? NtaCopy.passageSet : NtaCopy.questionTitle(number),
      tags: [
        if (question.chapter case final c? when c.isNotEmpty) c,
        if (question.difficulty case final d? when d.isNotEmpty) NtaCopy.difficulty(d),
      ],
      onTextStep: onTextStep,
      canShrink: textScale > NtaTextStep.scales.first,
      canGrow: NtaTextStep.canGrowPaper(textScale, system),
      open: open,
    );
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ...leading,
        if (hasPassage) ...[
          _Passage(text: passage, range: passageRange, style: skin.type.passage(step)),
          const SizedBox(height: MmSpace.s16),
        ],
        MediaQuery.withClampedTextScaling(
          maxScaleFactor: 1.3,
          child: _StateRow(number: number, state: state, marked: marked, onMark: canAnswer ? () => onMark(!marked) : null),
        ),
        const SizedBox(height: MmSpace.s12),
        Semantics(
          header: true,
          child: Text(question.question, style: qStyle.copyWith(color: colors.ink)),
        ),
        if (distinctBody(question.question, question.body) case final b?) ...[
          const SizedBox(height: MmSpace.s8),
          Text(b, style: oStyle.copyWith(color: colors.ink)),
        ],
        SizedBox(height: open ? MmSpace.s24 : MmSpace.s20),
        if (open) Divider(height: 1, thickness: 1, color: colors.line),
        for (var i = 0; i < question.options.length; i++) ...[
          if (i > 0 && !open) const SizedBox(height: MmSpace.s8),
          NtaOption(
            letter: question.options[i].key,
            text: question.options[i].text,
            selected: selected == i,
            onSelect: canAnswer ? () => onSelect(i) : null,
            textStyle: oStyle,
          ),
        ],
      ],
    );

    if (open) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          head,
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s8, bottom: MmSpace.s16),
            child: body,
          ),
        ],
      );
    }
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedRectangleBorder(
          borderRadius: NtaSkin.radiusAll,
          side: BorderSide(color: colors.line),
        ),
        shadows: colors.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          head,
          Padding(padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s20), child: body),
        ],
      ),
    );
  }
}

/// The state of this question with Mark / Unmark: the palette chip, its words and the key. The key
/// keeps its 48 dp. When the words wrap to a second line at large text the key stays level with
/// the first line, not floating at the middle of the two.
class _StateRow extends StatelessWidget {
  const _StateRow({required this.number, required this.state, required this.marked, required this.onMark});

  final int number;
  final NtaChipState state;
  final bool marked;
  final VoidCallback? onMark;

  /// The height of the Mark key: the line the chip and the words centre on.
  static const double _key = 48;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.caption.copyWith(color: colors.ink2);
    final lineHeight = (style.fontSize ?? 12) * (style.height ?? 1.3);
    final firstLine = MediaQuery.textScalerOf(context).scale(lineHeight);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: (_key - 26) / 2),
          child: NtaChip(state: state, label: '$number', size: const Size(30, 26), fontSize: 11.5),
        ),
        const SizedBox(width: MmSpace.s8),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(top: ((_key - firstLine) / 2).clamp(0.0, _key)),
            child: Semantics(
              label: '${NtaCopy.questionTitle(number)}, ${state.label.toLowerCase()}',
              excludeSemantics: true,
              child: Text(state.label, style: style),
            ),
          ),
        ),
        _MarkKey(marked: marked, onTap: onMark),
      ],
    );
  }
}

class _Head extends StatelessWidget {
  const _Head({
    required this.title,
    required this.tags,
    required this.onTextStep,
    required this.canShrink,
    required this.canGrow,
    required this.open,
  });

  final String title;
  final List<String> tags;
  final void Function(int delta)? onTextStep;
  final bool canShrink;
  final bool canGrow;

  /// The MockMob look: the head is plain text on the page, with no card behind it.
  final bool open;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final titleRow = Row(
      children: [
        Expanded(
          child: Semantics(header: true, child: Text(title, style: type.cardTitle)),
        ),
        if (onTextStep != null) ...[
          _SizeKey(label: 'A−', semantics: NtaCopy.smaller, onTap: canShrink ? () => onTextStep!(-1) : null),
          _SizeKey(label: 'A+', semantics: NtaCopy.larger, onTap: canGrow ? () => onTextStep!(1) : null),
        ],
      ],
    );
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: open
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                titleRow,
                // The chapter and the difficulty as one quiet line: they are facts, not controls.
                if (tags.isNotEmpty) Text(tags.join(', '), style: type.caption.copyWith(color: colors.ink3)),
              ],
            )
          : DecoratedBox(
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
                    titleRow,
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

/// A- / A+: 48 dp touch targets (the hit area is the whole square, wider than the letters drawn
/// in it).
class _SizeKey extends StatelessWidget {
  const _SizeKey({required this.label, required this.semantics, required this.onTap});

  final String label;
  final String semantics;

  /// Null at the end of the scale: the key dims and TalkBack hears it as unavailable.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final enabled = onTap != null;
    return Semantics(
      button: true,
      enabled: enabled,
      label: semantics,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: MmTarget.min / 2,
        child: SizedBox.square(
          dimension: MmTarget.min,
          child: Center(
            child: AnimatedOpacity(
              opacity: enabled ? 1 : 0.38,
              duration: const Duration(milliseconds: 150),
              child: Text(
                label,
                textScaler: TextScaler.noScaling,
                style: context.mmType.label.copyWith(color: colors.ink2, fontSize: label == 'A+' ? 15 : 13),
              ),
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
  const _Passage({required this.text, required this.range, required this.style});

  final String text;
  final (int, int)? range;
  final TextStyle style;

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
                Text(text, style: style.copyWith(color: colors.ink)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
