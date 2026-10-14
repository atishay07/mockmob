import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../domain/du_eligibility.dart';
import '../widgets/tools_page.dart' show IconWell;
import '../widgets/tools_parts.dart' show ToolsRing;
import '../widgets/tools_sheet.dart';
import 'compass_controller.dart';

/// Opens the category and score in a sheet, live against Compass's state.
Future<void> showCategoryScoreSheet(BuildContext context) => showToolsSheet<void>(
      context: context,
      title: ToolsCopy.categoryHeading,
      builder: (sheet) => Consumer(
        builder: (context, ref, _) {
          final s = ref.watch(compassControllerProvider).value;
          if (s == null) return const SizedBox.shrink();
          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
            child: CategoryScorePanel(state: s, padding: EdgeInsets.zero, onDone: () => Navigator.of(sheet).maybePop()),
          );
        },
      ),
    );

/// Category chips (the five main lists, then "Other quota" in a sheet) and the optional
/// programme-specific score that labels each college row.
class CategoryScorePanel extends ConsumerStatefulWidget {
  const CategoryScorePanel({
    super.key,
    required this.state,
    this.padding = const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
    this.onDone,
  });

  final CompassState state;
  final EdgeInsetsGeometry padding;

  /// When set, the panel ends with a Done key and the keyboard's action key does the same: both
  /// close the sheet. A score that is not a number from 0 to 1000 keeps it open, with the error shown.
  final VoidCallback? onDone;

  @override
  ConsumerState<CategoryScorePanel> createState() => _CategoryScorePanelState();
}

class _CategoryScorePanelState extends ConsumerState<CategoryScorePanel> {
  late final TextEditingController _score = TextEditingController(text: widget.state.scoreText);

  @override
  void didUpdateWidget(CategoryScorePanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    // The score may have been changed on another screen (the programme's sheet).
    final text = widget.state.scoreText;
    if (text != _score.text) _score.value = TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }

  @override
  void dispose() {
    _score.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = widget.state;
    final controller = ref.read(compassControllerProvider.notifier);
    final other = duOtherCategories.contains(s.category);
    final open = s.eligible.length;
    final clearing = s.score == null ? 0 : s.eligible.where((v) => s.couldClear(v.group)).length;
    return Padding(
      padding: widget.padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The live strip: with a score typed and subjects open, how many programmes the score
          // could clear, rolling as the student types. Real counts, from the same rule as the
          // rows on Compass.
          if (widget.onDone != null) ...[
            _ClearStrip(clearing: clearing, open: open, show: s.score != null && open > 0),
          ],
          Text(ToolsCopy.category, style: type.caption.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s4),
          Semantics(
            container: true,
            label: ToolsCopy.category,
            child: Wrap(
              spacing: MmSpace.s8,
              children: [
                for (final c in duMainCategories)
                  MmChip(label: categoryLabel(c), selected: s.category == c, onTap: () => controller.setCategory(c)),
                MmChip(
                  label: other ? (duCategoryLabels[s.category] ?? s.category) : ToolsCopy.otherQuota,
                  selected: other,
                  onTap: () => _pickOther(context, s.category),
                ),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s20),
          Text(ToolsCopy.scoreLabel, style: type.caption.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s8),
          TextField(
            controller: _score,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp('[0-9.]')), LengthLimitingTextInputFormatter(7)],
            onChanged: controller.setScore,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) {
              if (!ref.read(compassControllerProvider).requireValue.scoreInvalid) widget.onDone?.call();
            },
            style: type.figureCompact.copyWith(fontSize: 32, height: 1.1),
            decoration: InputDecoration(
              hintText: ToolsCopy.scoreHint,
              isDense: true,
              filled: true,
              fillColor: colors.isNight ? colors.raised2 : colors.sunken,
              contentPadding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: 14),
              errorText: s.scoreInvalid ? ToolsCopy.scoreInvalid : null,
              errorMaxLines: 2,
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          Text(ToolsCopy.scoreHelp, style: type.caption.copyWith(color: colors.ink2)),
          if (widget.onDone != null) ...[
            const SizedBox(height: MmSpace.s20),
            KeyButton(
              label: s.scoreInvalid || open == 0 ? ToolsCopy.done : ToolsCopy.showProgrammes(open),
              onPressed: s.scoreInvalid ? null : widget.onDone,
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _pickOther(BuildContext context, String current) {
    final controller = ref.read(compassControllerProvider.notifier);
    return showMmSheet<void>(
      context: context,
      title: ToolsCopy.otherQuota,
      builder: (sheetContext) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final c in duOtherCategories)
            MmSelectRow(
              title: duCategoryLabels[c] ?? c,
              selected: current == c,
              onTap: () {
                controller.setCategory(c);
                Navigator.of(sheetContext).maybePop();
              },
            ),
        ],
      ),
    );
  }
}

/// The way into category and score. An ordinary plain card: the hero of Compass holds the screen's
/// one lit edge, so this row carries a hairline and no tint (SPACING.md 5). Opens the sheet.
class CategoryScoreBar extends StatelessWidget {
  const CategoryScoreBar({super.key, required this.summary, required this.onTap});

  final String summary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
      child: MmSurface.plain(
        semanticsLabel: '${ToolsCopy.categoryHeading}. $summary',
        onTap: onTap,
        child: Row(
          children: [
            ExcludeSemantics(child: IconWell(LucideIcons.slidersHorizontal, color: colors.ink)),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ToolsCopy.categoryHeading, style: type.labelLarge.copyWith(fontSize: 16)),
                  const SizedBox(height: MmSpace.s2),
                  Text(summary, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Icon(LucideIcons.chevronRight, size: 16, color: colors.ink2),
          ],
        ),
      ),
    );
  }
}

/// "38 could clear" with a 48 dp ring for the share of the open programmes: it appears when a
/// valid score is typed (and goes when it is cleared), the figure rolls as the score changes and
/// the ring travels from where it was. A strip of its own height, so the sheet moves smoothly
/// (it grows open in 200 ms; instantly under reduced motion).
class _ClearStrip extends StatelessWidget {
  const _ClearStrip({required this.clearing, required this.open, required this.show});

  final int clearing;
  final int open;
  final bool show;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    return AnimatedSize(
      duration: reduced ? Duration.zero : Motion.ui,
      curve: Motion.glide,
      alignment: Alignment.topCenter,
      child: !show
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s16),
              child: Semantics(
                container: true,
                liveRegion: true,
                label: ToolsCopy.couldClearLine(clearing, open),
                excludeSemantics: true,
                child: Row(
                  children: [
                    ToolsRing(
                      key: const ValueKey('clear-ring'),
                      fraction: open == 0 ? 0 : clearing / open,
                      size: 48,
                      stroke: 5,
                      child: const SizedBox.shrink(),
                    ),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              MmCountUp(
                                value: clearing,
                                fromZeroOnFirstBuild: false,
                                duration: const Duration(milliseconds: 360),
                                style: type.figureCompact.copyWith(fontSize: 28, height: 1.1),
                                semanticsLabel: '$clearing',
                              ),
                              const SizedBox(width: MmSpace.s8),
                              Text(ToolsCopy.couldClearWord, style: type.labelLarge),
                            ],
                          ),
                          Text(ToolsCopy.ofOpenToYou(open), style: type.caption.copyWith(color: colors.ink2)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
