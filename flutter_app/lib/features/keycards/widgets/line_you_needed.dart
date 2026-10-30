import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/keycards_models.dart';
import '../data/keycards_providers.dart';
import '../keycards_copy.dart';
import 'key_card_parts.dart';

/// "The line you needed" under a wrong answer (KEYCARDS-BUILD-SPEC 3 and 4): the one or two cards whose NCERT
/// line the question rests on, where the line came from, and Add to Revise. Hidden when Key cards are off,
/// the read failed, or the server found no line (`source: 'none'`).
class LineYouNeeded extends ConsumerWidget {
  const LineYouNeeded({super.key, required this.questionId, this.topGap = MmSpace.s16});

  final String questionId;

  /// The space above the block, drawn only when the block is.
  final double topGap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final line = ref.watch(keyCardsLineProvider(questionId)).value;
    if (line == null || !line.shows) return const SizedBox.shrink();
    return Padding(padding: EdgeInsets.only(top: topGap), child: KcLineBlock(line: line));
  }
}

/// The block itself, for a line already read.
class KcLineBlock extends ConsumerStatefulWidget {
  const KcLineBlock({super.key, required this.line});

  final KcLine line;

  @override
  ConsumerState<KcLineBlock> createState() => _KcLineBlockState();
}

class _KcLineBlockState extends ConsumerState<KcLineBlock> {
  bool _adding = false;
  bool _added = false;
  bool _failed = false;

  Future<void> _add() async {
    if (_adding || _added) return;
    setState(() {
      _adding = true;
      _failed = false;
    });
    try {
      await ref.read(keyCardsApiProvider).add(cardIds: [for (final c in widget.line.cards) c.id]);
      if (!mounted) return;
      setState(() {
        _adding = false;
        _added = true;
      });
      ref.invalidate(keyCardsDueProvider);
    } on Object {
      if (!mounted) return;
      setState(() {
        _adding = false;
        _failed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final line = widget.line;
    final source = line.source == 'linked' ? KeyCardsCopy.lineLinked : KeyCardsCopy.lineMatched;
    return MmSurface.inset(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(child: Semantics(header: true, child: Text(KeyCardsCopy.lineTitle, style: type.label.copyWith(color: colors.ink)))),
              Text(source, style: type.caption.copyWith(color: colors.ink3)),
            ],
          ),
          for (final (i, card) in line.cards.indexed) ...[
            if (i > 0) ...[const SizedBox(height: MmSpace.s12), Divider(height: 1, thickness: 1, color: colors.line)],
            const SizedBox(height: MmSpace.s8),
            Text(card.label, style: type.caption.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s2),
            KcBack(card: card),
            const SizedBox(height: MmSpace.s4),
            KcReference(card: card),
          ],
          const SizedBox(height: MmSpace.s4),
          // The action on the text edge, and Free's lines left today on the right edge (under it when they do
          // not fit).
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: MmSpace.s12,
            children: [
              if (_added)
                const SizedBox(height: MmTarget.min, child: Align(alignment: Alignment.centerLeft, widthFactor: 1, child: _AddedLine()))
              else
                KcLinkAction(label: KeyCardsCopy.lineAdd, busy: _adding, onTap: () => unawaited(_add())),
              if (line.left != null)
                Text(KeyCardsCopy.lineLeft(line.left!), style: type.caption.copyWith(color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ),
          if (_failed) Semantics(liveRegion: true, child: Text(KeyCardsCopy.addFailed, style: type.small.copyWith(color: colors.warnText))),
        ],
      ),
    );
  }
}

/// "In Revise", acknowledged by the server: the check and the words, at their own width.
class _AddedLine extends StatelessWidget {
  const _AddedLine();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(LucideIcons.check, size: 16, color: colors.goodText),
        const SizedBox(width: MmSpace.s6),
        Text(KeyCardsCopy.lineAdded, style: context.mmType.small.copyWith(color: colors.ink)),
      ],
    );
  }
}
