// The hero's monumental number with its meaning ("4  to repair / tonight"). The meaning sits
// beside the number on its baseline when both fit the column; otherwise it goes under the
// number on one line, so a two-digit number never squeezes its words (ui-blitz/today.md 2.2).
// The number rolls in once (landing just after the stage arrives, with a selection tick) and
// again whenever the chosen duration reshapes the task; after landing it never moves (brief
// section 7). With a [NumberBlock.memoryKey] it remembers the count it last showed: a hero built
// again (a sealed result opened, a resumed paper finished) rolls on from that count instead of
// from 0, and an unchanged count is simply there. Its words cross-fade when they change ("in
// 10 min" to "tonight"), and a move between beside and under eases instead of jumping.
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'today_entrance.dart';
import 'today_type.dart';

class NumberBlock extends StatefulWidget {
  const NumberBlock({super.key, required this.number, this.label, this.semanticsLabel, this.besideWidth, this.memoryKey});

  final String number;

  /// Up to two short lines ("to repair\ntonight").
  final String? label;
  final String? semanticsLabel;

  /// The width the number and a beside label must fit in (the column clear of the art). Null:
  /// the full width given.
  final double? besideWidth;

  /// Names the figure for [MmNumberMemory] ("today.hero.ready.accountancy"); null forgets. The
  /// memory only sets where a roll starts. A count of mistakes is not a score, so it never takes
  /// the shared rise and fall tint (volt on a rise would praise more mistakes).
  final String? memoryKey;

  static const double _gap = MmSpace.s12;

  /// The air `MonumentalNumber` keeps under a figure's baseline, as a share of its size (its box
  /// is the cap height plus this above and below).
  static const double _figureAir = 0.025;

  /// While Today's entrance is playing the roll waits a moment, so the number lands at about
  /// 660 ms from the open, just after its card (MOTION.md 4.3: the roll takes 500 ms). Afterwards
  /// (a length chip reshaping the task, a page that loaded behind the skeleton, a refresh) it
  /// rolls at once, from the value it showed.
  static const Duration entranceRollDelay = Duration(milliseconds: 160);

  static Duration rollDelay(BuildContext context) {
    final entrance = TodayEntranceScope.of(context);
    if (entrance == null || entrance.isCompleted || Motion.reduced(context)) return Duration.zero;
    return entranceRollDelay;
  }

  /// Whether [number] and its [label] fit side by side in [room].
  static bool fitsBeside(String number, String label, TextStyle numberStyle, TextStyle labelStyle, TextScaler scaler, double room) {
    final numberWidth = _width(number, numberStyle.copyWith(fontSize: scaler.scale(numberStyle.fontSize!)), TextScaler.noScaling);
    final labelWidth = _width(label, labelStyle, scaler);
    return numberWidth + _gap + labelWidth <= room;
  }

  @override
  State<NumberBlock> createState() => _NumberBlockState();

  /// How far the box of [text]'s last line reaches below that line's baseline.
  static double _descentBelowBaseline(String text, TextStyle style, TextScaler scaler) {
    final painter = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler)..layout();
    final lines = painter.computeLineMetrics();
    final below = lines.isEmpty ? 0.0 : painter.height - lines.last.baseline;
    painter.dispose();
    return below;
  }

  static double _width(String text, TextStyle style, TextScaler scaler) {
    final painter = TextPainter(text: TextSpan(text: text, style: style), textDirection: TextDirection.ltr, textScaler: scaler)..layout();
    final w = painter.width;
    painter.dispose();
    return w;
  }
}

class _NumberBlockState extends State<NumberBlock> {
  /// The digits handed to the figure: the remembered count on the first frame of a rebuilt hero,
  /// then the real one, so the figure rolls on from what the student last saw.
  late String _shown;

  /// Whether the figure rolls up from 0 when it first appears (nothing remembered).
  bool _fromZero = true;

  @override
  void initState() {
    super.initState();
    _shown = widget.number;
    final key = widget.memoryKey;
    final remembered = key == null ? null : MmNumberMemory.recall(key);
    if (remembered is String && remembered.isNotEmpty) {
      _fromZero = false;
      if (remembered != widget.number) {
        _shown = remembered;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && _shown != widget.number) setState(() => _shown = widget.number);
        });
      }
    }
    _remember();
  }

  @override
  void didUpdateWidget(NumberBlock old) {
    super.didUpdateWidget(old);
    if (old.number != widget.number || old.memoryKey != widget.memoryKey) {
      _shown = widget.number;
      _remember();
    }
  }

  void _remember() {
    final key = widget.memoryKey;
    if (key != null) MmNumberMemory.remember(key, widget.number);
  }

  @override
  Widget build(BuildContext context) {
    final number = widget.number;
    final label = widget.label;
    final colors = context.mmColors;
    final type = context.mmType;
    final labelStyle = type.stageLabel.copyWith(color: colors.ink);
    final numberStyle = type.stageNumber(number);
    final figure = MonumentalNumber(
      value: _shown,
      color: colors.ink,
      style: numberStyle,
      fromZeroOnFirstBuild: _fromZero,
      delay: NumberBlock.rollDelay(context),
      // The number landing is the moment the card finishes arriving: one selection tick.
      onLanded: () {
        if (context.mounted) mmFireHaptic(context, MmPressHaptic.selection);
      },
    );

    // The words cross-fade when they change (the chip turns part of the chapter into all of it),
    // on the shared overlap rule, so two labels never read on top of each other.
    Widget words(String text, {required bool oneLine}) => MmOverlapSwitcher.fade(
          alignment: Alignment.bottomLeft,
          child: oneLine
              ? FittedBox(
                  key: ValueKey('under:$text'),
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(text, style: labelStyle, maxLines: 1, softWrap: false),
                )
              : Text(text, key: ValueKey('beside:$text'), style: labelStyle, softWrap: false),
        );

    return Semantics(
      container: true,
      label: widget.semanticsLabel ?? [number, if (label != null) label.replaceAll('\n', ' ')].join(' '),
      excludeSemantics: true,
      child: label == null
          ? Align(alignment: Alignment.centerLeft, child: figure)
          : LayoutBuilder(
              builder: (context, box) {
                final scaler = MediaQuery.textScalerOf(context);
                final room = (widget.besideWidth ?? box.maxWidth).clamp(0.0, box.maxWidth);
                final beside = NumberBlock.fitsBeside(number, label, numberStyle, labelStyle, scaler, room);
                // A change of place (beside to under, when a second digit arrives) eases the
                // card's height instead of jumping it.
                return MmSizeEase(
                  duration: Motion.ui,
                  curve: Motion.out,
                  alignment: Alignment.topLeft,
                  clipBehavior: Clip.none,
                  child: beside ? _beside(figure, label, labelStyle, numberStyle, scaler, words) : _under(figure, label, words),
                );
              },
            ),
    );
  }

  Widget _beside(
    Widget figure,
    String label,
    TextStyle labelStyle,
    TextStyle numberStyle,
    TextScaler scaler,
    Widget Function(String text, {required bool oneLine}) words,
  ) {
    // The label's last line sits on the number's baseline (SPACING.md 3.2), by the real metrics
    // instead of a padding guess: the figure's box ends a hair of air under its baseline, the
    // label's ends its descent under its own.
    final air = NumberBlock._figureAir * scaler.scale(numberStyle.fontSize!);
    final drop = NumberBlock._descentBelowBaseline(label, labelStyle, scaler) - air;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        figure,
        const SizedBox(width: NumberBlock._gap),
        Flexible(child: Transform.translate(offset: Offset(0, drop), child: words(label, oneLine: false))),
      ],
    );
  }

  Widget _under(Widget figure, String label, Widget Function(String text, {required bool oneLine}) words) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          figure,
          const SizedBox(height: MmSpace.s4),
          words(label.replaceAll('\n', ' '), oneLine: true),
        ],
      );
}
