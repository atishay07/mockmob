import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../logic/sheet_cells.dart';
import 'nta_action_bar.dart';
import 'nta_chip.dart';
import 'nta_copy.dart';
import 'nta_paper_theme.dart';
import 'nta_skin.dart';

/// The exam's right panel (section 5): who and what is being taken, the legend with a count in
/// every shape, the numbered palette, and Question paper / Submit test pinned at the foot. A
/// drawer on a phone, a fixed 320 dp column on a tablet. Solid: nothing behind it shows through.
class NtaPalettePanel extends StatelessWidget {
  const NtaPalettePanel({
    super.key,
    required this.cells,
    required this.subject,
    required this.candidate,
    required this.onJump,
    required this.onSubmit,
    required this.onQuestionPaper,
    this.onClose,
  });

  final List<SheetCell> cells;
  final String subject;

  /// The student's name from the account, or null (never invented).
  final String? candidate;
  final ValueChanged<int> onJump;
  final VoidCallback onSubmit;
  final VoidCallback onQuestionPaper;

  /// Null when the panel is always on screen.
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final counts = NtaCounts.of(cells);
    final bar = NtaBarColors.of(context);
    final inset = MediaQuery.viewPaddingOf(context);
    return ColoredBox(
      color: colors.raised,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(MmSpace.s16, (onClose == null ? MmSpace.s12 : inset.top + MmSpace.s8), MmSpace.s4, MmSpace.s4),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(header: true, child: Text(NtaCopy.paletteTitle, style: type.cardTitle)),
                      Text(NtaCopy.answeredOf(counts.answeredAll, counts.total), style: type.caption.copyWith(color: colors.ink2)),
                    ],
                  ),
                ),
                if (onClose != null)
                  IconButton(
                    onPressed: onClose,
                    tooltip: NtaCopy.close,
                    constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
                    icon: Icon(LucideIcons.x, size: 20, color: colors.ink2),
                  ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s8, MmSpace.s16, MmSpace.s16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  NtaCandidateCard(name: candidate, subject: subject),
                  const SizedBox(height: MmSpace.s16),
                  _Legend(counts: counts),
                  const SizedBox(height: MmSpace.s8),
                  Text(NtaCopy.pending(counts.pending, counts.total), style: type.caption.copyWith(color: colors.ink3)),
                  const SizedBox(height: MmSpace.s16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s8),
                    decoration: BoxDecoration(color: bar.band, borderRadius: const BorderRadius.vertical(top: Radius.circular(8))),
                    child: Text(
                      '${NtaCopy.section}: $subject',
                      style: type.label.copyWith(color: bar.onBand),
                    ),
                  ),
                  const SizedBox(height: MmSpace.s12),
                  _Grid(cells: cells, onJump: onJump),
                  const SizedBox(height: MmSpace.s24),
                  const NtaStyleSwitch(),
                ],
              ),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
            child: Padding(
              padding: EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, MmSpace.s12 + (onClose == null ? 0 : inset.bottom)),
              child: Row(
                children: [
                  Expanded(child: NtaKey(label: NtaCopy.questionPaper, icon: LucideIcons.fileText, onPressed: onQuestionPaper)),
                  const SizedBox(width: MmSpace.s8),
                  Expanded(child: NtaKey(label: NtaCopy.submitTestShort, tone: NtaKeyTone.green, onPressed: onSubmit)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class NtaCandidateCard extends StatelessWidget {
  const NtaCandidateCard({super.key, required this.name, required this.subject});

  final String? name;
  final String subject;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final bar = NtaBarColors.of(context);
    final n = name?.trim();
    final hasName = n != null && n.isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(MmSpace.s12),
      decoration: BoxDecoration(
        color: colors.sunken,
        borderRadius: NtaSkin.keyRadius,
        border: Border.all(color: colors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bar.avatar, shape: BoxShape.circle),
            child: hasName
                ? Text(n.characters.first.toUpperCase(), style: type.cardTitle.copyWith(color: bar.onAvatar))
                : Icon(LucideIcons.user, size: 20, color: bar.onAvatar),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (hasName) Text(n, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.labelLarge),
                Text('$subject, ${NtaCopy.modeLine}', style: type.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The five states with their counts drawn inside the shapes, as on the exam screen.
class _Legend extends StatelessWidget {
  const _Legend({required this.counts});

  final NtaCounts counts;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final stacked = MediaQuery.textScalerOf(context).scale(1) >= 1.2;
    Widget item(NtaChipState s) => Row(
      children: [
        NtaChip(state: s, label: '${counts[s]}', size: const Size(36, 32), fontSize: 13),
        const SizedBox(width: MmSpace.s8),
        Expanded(child: Text(s.label, style: type.caption.copyWith(color: colors.ink2, height: 1.25))),
      ],
    );
    return Semantics(
      container: true,
      label: [for (final s in NtaChipState.values) '${counts[s]} ${s.label.toLowerCase()}'].join(', '),
      excludeSemantics: true,
      child: Column(
        children: stacked
            // Large text: one state to a line, so "Marked for review" never wraps.
            ? [
                for (final (i, s) in NtaChipState.values.indexed) ...[
                  if (i > 0) const SizedBox(height: MmSpace.s8),
                  item(s),
                ],
              ]
            : [
                Row(
                  children: [
                    Expanded(child: item(NtaChipState.answered)),
                    Expanded(child: item(NtaChipState.notAnswered)),
                  ],
                ),
                const SizedBox(height: MmSpace.s8),
                Row(
                  children: [
                    Expanded(child: item(NtaChipState.notVisited)),
                    Expanded(child: item(NtaChipState.marked)),
                  ],
                ),
                const SizedBox(height: MmSpace.s8),
                item(NtaChipState.answeredMarked),
              ],
      ),
    );
  }
}

class _Grid extends StatelessWidget {
  const _Grid({required this.cells, required this.onJump});

  final List<SheetCell> cells;
  final ValueChanged<int> onJump;

  @override
  Widget build(BuildContext context) {
    const cols = 5;
    return Column(
      children: [
        for (var row = 0; row * cols < cells.length; row++)
          Row(
            children: [
              for (var col = 0; col < cols; col++)
                Expanded(
                  child: row * cols + col < cells.length ? _Cell(cell: cells[row * cols + col], onTap: () => onJump(row * cols + col)) : const SizedBox.shrink(),
                ),
            ],
          ),
      ],
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.cell, required this.onTap});

  final SheetCell cell;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final state = NtaChipState.of(cell);
    return Semantics(
      button: true,
      selected: cell.current,
      label: RunnerCopy.cellSemantics(
        number: cell.number,
        answered: cell.answered,
        visited: cell.visited,
        marked: cell.marked,
        unsynced: cell.unsynced,
        current: cell.current,
      ),
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 28,
        child: SizedBox(
          height: 56,
          child: Center(child: NtaChip(state: state, label: '${cell.number}', current: cell.current)),
        ),
      ),
    );
  }
}
