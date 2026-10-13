import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';
import 'nta_skin.dart';

/// One option as the exam draws it: a radio on the left, the text, a flat row that turns pale
/// blue when chosen. The letter stays small and quiet, so the result page's "A" still matches.
/// No correctness, ever. Picking the chosen option again does nothing (Clear response does).
class NtaOption extends StatelessWidget {
  const NtaOption({
    super.key,
    required this.letter,
    required this.text,
    required this.selected,
    required this.onSelect,
    required this.textStyle,
  });

  final String letter;
  final String text;
  final bool selected;

  /// Null when answering is closed (a warning, time up, submitting).
  final VoidCallback? onSelect;
  final TextStyle textStyle;

  @override
  Widget build(BuildContext context) {
    final skin = NtaSkin.of(context);
    final colors = skin.colors;
    final enabled = onSelect != null;
    return Semantics(
      container: true,
      inMutuallyExclusiveGroup: true,
      checked: selected,
      enabled: enabled,
      label: RunnerCopy.optionSemantics(letter, text),
      onTap: onSelect,
      excludeSemantics: true,
      child: Material(
        color: selected ? skin.selectedRow : colors.raised,
        shape: RoundedRectangleBorder(
          borderRadius: NtaSkin.keyRadius,
          side: BorderSide(color: selected ? skin.selectedEdge : colors.line, width: selected ? 1.5 : 1),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: selected ? () {} : onSelect,
          splashFactory: NoSplash.splashFactory,
          highlightColor: skin.selectedRow,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 54),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s16, MmSpace.s12),
              child: Row(
                children: [
                  _Radio(selected: selected, skin: skin, enabled: enabled),
                  const SizedBox(width: MmSpace.s12),
                  SizedBox(
                    width: 16,
                    child: Text(
                      letter,
                      textScaler: TextScaler.noScaling,
                      style: context.mmType.caption.copyWith(color: colors.ink3, fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s6),
                  Expanded(
                    child: Text(
                      text,
                      style: textStyle.copyWith(
                        color: enabled ? colors.ink : colors.ink3,
                        fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Radio extends StatelessWidget {
  const _Radio({required this.selected, required this.skin, required this.enabled});

  final bool selected;
  final NtaSkin skin;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final edge = selected ? skin.radio : (enabled ? skin.colors.ink3 : skin.colors.ink4);
    return SizedBox.square(
      dimension: 20,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: skin.colors.raised,
          border: Border.all(color: edge, width: selected ? 1.5 : 1.2),
        ),
        child: selected
            ? Padding(
                padding: const EdgeInsets.all(4),
                child: DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, color: skin.radio)),
              )
            : null,
      ),
    );
  }
}
