import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../ask_mobi.dart';
import '../data/ask_suggestions.dart';
import '../data/insights_repository.dart';
import 'mobi_mark.dart';

/// The ways in to Ask Mobi that sit on other screens (ASK-MOBI-1018 section 3). None of them is a
/// card or a box: a quiet text entry, or one plain row beside its neighbours. Each opens the same
/// sheet, already about the screen it was tapped on.

/// A quiet text entry: Mobi's flat mark and one label ("Ask Mobi about Q7", "Ask Mobi about this
/// mock"), ink on the page, at least 48 dp tall. [note] is the price said before the tap ("Free").
class AskMobiLink extends StatelessWidget {
  const AskMobiLink({super.key, required this.label, required this.onTap, this.note});

  final String label;
  final VoidCallback onTap;

  /// A short quiet word after the label: what the first answer costs.
  final String? note;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: note == null ? label : '$label, $note',
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.97,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Align(
          alignment: Alignment.centerLeft,
          widthFactor: 1,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const MobiMark(size: 18),
              const SizedBox(width: MmSpace.s8),
              Flexible(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: type.labelLarge.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: pressed ? colors.ink2 : colors.ink),
                ),
              ),
              if (note != null) ...[
                const SizedBox(width: MmSpace.s8),
                Text(note!, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Practice's row beside Review again: "Ask Mobi what to practise", with a real line from the record
/// under it ("Partnership: 11 wrong of 34 answered") and its price on the right. With no record
/// line there is no preview (a figure is never invented). It opens the sheet; the subjects loop
/// above it does not change.
class AskMobiPracticeRow extends ConsumerWidget {
  const AskMobiPracticeRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final record = ref.watch(insightsRepositoryProvider).value;
    final note = practicePreview(record);
    final label = note == null ? '${AskSheetCopy.practiceRow}, ${AskSheetCopy.free}' : '${AskSheetCopy.practiceRow}, $note, ${AskSheetCopy.free}';
    return MmPressable(
      onTap: () => openAskMobi(context, const AskMobiContext.practice()),
      semanticsLabel: label,
      pressedScale: 0.98,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
          child: Row(
            children: [
              // The same 22 dp slot the other rows give their icon.
              const SizedBox(width: 22, height: 22, child: MobiMark(size: 22)),
              const SizedBox(width: MmSpace.s16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(AskSheetCopy.practiceRow, style: type.labelLarge),
                    if (note != null) Text(note, style: type.caption.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Text(AskSheetCopy.free, style: type.caption.copyWith(fontWeight: FontWeight.w600, color: colors.goodText)),
            ],
          ),
        ),
      ),
    );
  }
}
