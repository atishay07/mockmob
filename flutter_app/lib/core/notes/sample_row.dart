import 'package:flutter/material.dart';

import '../theme/theme.dart';
import '../widgets/materials/shape.dart';

/// A sample row for an empty state that teaches (F18): one real-looking row, drawn the way the
/// real one will look, tagged "Example" in words so it is never taken for the student's own data.
/// It takes no taps and is read once by a screen reader as an example.
///
/// An empty state is three things in order: one line on what will appear here, this row, and the
/// one key that goes to the next action.
class SampleRow extends StatelessWidget {
  const SampleRow({super.key, this.leading, required this.title, required this.note, this.value});

  /// The mark at the row's start (a bubble, a rank), or null.
  final Widget? leading;

  /// A figure shown first, in the figure face ("172 / 250"), or null.
  final String? value;
  final String title;
  final String note;

  /// The word that says this is not the student's own.
  static const String tag = 'Example';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: '$tag. $title. $note',
      excludeSemantics: true,
      child: IgnorePointer(
        child: DecoratedBox(
          decoration: ShapeDecoration(shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: colors.line))),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 64),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
              child: Row(
                children: [
                  if (leading != null) ...[leading!, const SizedBox(width: MmSpace.s12)],
                  if (value != null) ...[
                    Text(
                      value!,
                      style: type.figure.copyWith(fontSize: 24, height: 28 / 24, color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]),
                    ),
                    const SizedBox(width: MmSpace.s12),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(title, style: type.labelLarge.copyWith(color: colors.ink2)),
                        const SizedBox(height: MmSpace.s2),
                        Text(note, style: type.caption.copyWith(color: colors.ink3)),
                      ],
                    ),
                  ),
                  const SizedBox(width: MmSpace.s8),
                  Text(tag, style: type.caption.copyWith(color: colors.ink3)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The round numeral at the start of a sample row of ranked things (a first choice).
class SampleRank extends StatelessWidget {
  const SampleRank(this.rank, {super.key});

  final int rank;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: 24,
        child: DecoratedBox(
          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.ink3, width: 1.5)),
          child: Center(child: Text('$rank', style: context.mmType.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w700))),
        ),
      ),
    );
  }
}
