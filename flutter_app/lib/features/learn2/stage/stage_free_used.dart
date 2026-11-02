/// Free after the day's session, the start refused (the web's `FreeUsed`; R3-SPEC ruling F): the feed's 402, and the run's on a
/// second tab. The same block as Learn home's Free-done state, word for word:
///
///   headline   "That was today's free session."  (Bricolage 750 30/1.1)
///   line       "Questions come back tomorrow. Your Key cards stay open."
///   main key   See Pro (the one volt key)
///   Or rows    up to 2 quiet hairline rows with a chevron, in this order, only those that apply:
///                1. "Continue · N min"           today's own unfinished run (the 402's `resume`)
///                2. "Revise N due cards · M min" due > 0 (a cards run, never counted)
///                3. "Answer single questions"    Explore stays free
/// Every row is a key the server accepts today. The X and "Close" above it return to where the student came from.
/// "Learn opens again tomorrow" never appears.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/pressable.dart';
import '../data/learn_words.dart';
import 'end_form.dart' show EndScreen;
import 'stage_balance.dart';
import 'stage_end_model.dart';
import 'stage_keys.dart';

/// The refusal as a whole layer: the Close row, then the block. [topGap] is the space between them (the run's own state asks for
/// 48 dp, the feed's none).
class StageFreeUsedScreen extends StatelessWidget {
  const StageFreeUsedScreen({super.key, required this.close, required this.rows, required this.onSeePro, required this.onRow, this.topGap = 0});

  /// The X and the word: a `StageCloseKey`.
  final Widget close;

  /// `StageEndModel.freeUsedRows` of the 402 body, after dropping the rows the screen cannot open.
  final List<FreeUsedRow> rows;

  /// Opens Pro; null leaves the See Pro key out (a build that shows no Pro nudges).
  final VoidCallback? onSeePro;

  /// A row was pressed: its id (`continue`, `revise`, `singles`).
  final ValueChanged<String> onRow;
  final double topGap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final pad = MediaQuery.paddingOf(context);
    return ColoredBox(
      color: colors.ground,
      // From the top, as the web's FreeUsed sits: the Close row first, the block right under it (never centred in the screen).
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: EndScreen.maxWidth),
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, math.max(24, pad.bottom) + 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: EndScreen.closeRow + pad.top,
                  child: Padding(
                    padding: EdgeInsets.only(top: pad.top),
                    child: Align(alignment: Alignment.centerLeft, child: Transform.translate(offset: const Offset(-10, 0), child: close)),
                  ),
                ),
                if (topGap > 0) SizedBox(height: topGap),
                StageFreeUsed(rows: rows, onSeePro: onSeePro, onRow: onRow),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The block itself: headline, line, See Pro and the Or rows.
class StageFreeUsed extends StatelessWidget {
  const StageFreeUsed({super.key, required this.rows, required this.onSeePro, required this.onRow});

  final List<FreeUsedRow> rows;
  final VoidCallback? onSeePro;
  final ValueChanged<String> onRow;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: StageBalancedText(
            TextSpan(text: LearnFreeWords.doneHeadline, style: type.headline.copyWith(fontSize: 30, height: 1.1, color: colors.ink)),
          ),
        ),
        const SizedBox(height: 10),
        Text(LearnFreeWords.doneLine, style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
        if (onSeePro != null) ...[
          const SizedBox(height: 18),
          StageStepKey(label: LearnWords.seePro, onTap: onSeePro, minHeight: 56),
        ],
        if (rows.isNotEmpty) ...[
          const SizedBox(height: 22),
          Text('Or', style: type.label.copyWith(fontSize: 13, height: 1.3, color: colors.ink3)),
          const SizedBox(height: 4),
          for (final (i, r) in rows.indexed) _Row(label: r.label, last: i == rows.length - 1, onTap: () => onRow(r.id)),
        ],
      ],
    );
  }
}

/// One quiet row: 52 dp at the least, a hairline above (and under the last), the words (600 15) and a chevron.
class _Row extends StatelessWidget {
  const _Row({required this.label, required this.last, required this.onTap});

  final String label;
  final bool last;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      lift: false,
      pressedScale: 0.99,
      focusRadius: BorderRadius.circular(8),
      highlight: true,
      semanticsLabel: label,
      builder: (context, pressed, focused) => DecoratedBox(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: colors.line), bottom: last ? BorderSide(color: colors.line) : BorderSide.none),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Row(
              children: [
                Expanded(child: Text(label, style: type.label.copyWith(fontSize: 15, height: 1.35, color: colors.ink))),
                const SizedBox(width: MmSpace.s12),
                Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
