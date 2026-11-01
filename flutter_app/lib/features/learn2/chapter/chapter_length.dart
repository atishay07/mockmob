import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/controls/segmented.dart';
import '../../../core/widgets/controls/selection_style.dart';
import '../../../core/widgets/key_button.dart';
import '../../../core/widgets/materials/shape.dart';
import '../../../core/widgets/mm_sheet.dart';
import '../../../core/widgets/pressable.dart';
import 'chapter_model.dart';

/// "How long have you got?": the app's segmented control, 5 min | 10 min | 20 min | Your own. The segment keeps what was
/// chosen (`35 min` stays `35 min`); the real length is on the Start key and the reason in the quiet line under it. Pressing
/// "Your own" again opens its sheet again.
class LengthControl extends StatelessWidget {
  const LengthControl({super.key, required this.minutes, required this.onChange, required this.onOwn, this.semanticsLabel = 'How long have you got?'});

  final int minutes;

  /// One of the three ready lengths.
  final ValueChanged<int> onChange;

  /// "Your own" was pressed: the page opens its sheet.
  final VoidCallback onOwn;
  final String semanticsLabel;

  /// The control's row, a 48 dp touch target.
  static const double height = 48;

  static const String ownValue = 'own';

  @override
  Widget build(BuildContext context) {
    final own = !ChapterModel.lengths.contains(minutes);
    final control = MmSegmented<Object>(
      showBubbles: false,
      semanticsLabel: semanticsLabel,
      segments: [
        for (final m in ChapterModel.lengths) MmSegment<Object>(m, '$m min'),
        MmSegment<Object>(ownValue, own ? ChapterModel.minutesLabel(minutes) : 'Your own'),
      ],
      value: own ? ownValue : minutes,
      onChanged: (v) => v == ownValue ? onOwn() : onChange(v as int),
    );
    return SizedBox(
      height: height,
      child: LayoutBuilder(
        builder: (context, box) {
          // The track keeps 4 dp inside its ends; its four segments share the rest.
          final segment = (box.maxWidth - 8) / 4;
          return Stack(
            children: [
              Center(child: control),
              // The control ignores a press on the segment already chosen, so a chosen "Your own" gets a key of its own over
              // its segment (a screen reader finds it by its words).
              if (own)
                Positioned(
                  right: 4,
                  top: 0,
                  bottom: 0,
                  width: segment,
                  child: MmPressable(
                    onTap: onOwn,
                    pressedScale: 0.98,
                    lift: false,
                    focusRadius: MmRadius.pillAll,
                    haptic: MmPressHaptic.selection,
                    semanticsLabel: 'Your own length, ${ChapterModel.minutesLabel(minutes)}. Change it',
                    builder: (context, pressed, focused) => const SizedBox.expand(),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// Opens "Your own": three ready lengths (one press chooses) and a stepper in 5-minute steps chosen with its own key.
/// Closes with the minutes chosen, or null.
Future<int?> showOwnLengthSheet(BuildContext context, {required int minutes}) => showMmSheet<int>(
  context: context,
  title: 'Your own length',
  builder: (sheet) => OwnLengthBody(minutes: minutes, onChoose: (m) => Navigator.of(sheet).pop(m)),
);

/// The sheet's body (its own widget, so a test can draw it without a route).
class OwnLengthBody extends StatefulWidget {
  const OwnLengthBody({super.key, required this.minutes, required this.onChoose});

  /// The length the page has now.
  final int minutes;
  final ValueChanged<int> onChoose;

  @override
  State<OwnLengthBody> createState() => _OwnLengthBodyState();
}

class _OwnLengthBodyState extends State<OwnLengthBody> {
  late int _own = ChapterModel.lengths.contains(widget.minutes) || ChapterModel.ownPresets.contains(widget.minutes) ? 35 : widget.minutes;

  void _step(int d) => setState(() => _own = (_own + d * ChapterModel.ownStep).clamp(ChapterModel.ownMin, ChapterModel.ownMax));

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            for (final (i, m) in ChapterModel.ownPresets.indexed) ...[
              if (i > 0) const SizedBox(width: MmSpace.s8),
              Expanded(child: _Preset(minutes: m, chosen: widget.minutes == m, onTap: () => widget.onChoose(m))),
            ],
          ],
        ),
        const SizedBox(height: MmSpace.s16),
        DecoratedBox(
          decoration: ShapeDecoration(
            color: colors.sunken,
            shape: mmShapeBorder(BorderRadius.circular(14), side: BorderSide(color: colors.line)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: Row(
              children: [
                _Nudge(icon: LucideIcons.minus, label: '5 minutes less', onTap: _own <= ChapterModel.ownMin ? null : () => _step(-1)),
                Expanded(
                  child: Semantics(
                    label: 'Minutes',
                    value: '$_own minutes',
                    increasedValue: '${(_own + ChapterModel.ownStep).clamp(ChapterModel.ownMin, ChapterModel.ownMax)} minutes',
                    decreasedValue: '${(_own - ChapterModel.ownStep).clamp(ChapterModel.ownMin, ChapterModel.ownMax)} minutes',
                    onIncrease: _own >= ChapterModel.ownMax ? null : () => _step(1),
                    onDecrease: _own <= ChapterModel.ownMin ? null : () => _step(-1),
                    excludeSemantics: true,
                    child: Center(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(text: '$_own', style: type.headline.copyWith(fontSize: 26, height: 1, color: colors.ink)),
                            TextSpan(text: ' min', style: type.labelLarge.copyWith(color: colors.ink2)),
                          ],
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
                _Nudge(icon: LucideIcons.plus, label: '5 minutes more', onTap: _own >= ChapterModel.ownMax ? null : () => _step(1)),
              ],
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        KeyButton(label: 'Use $_own minutes', onPressed: () => widget.onChoose(_own)),
      ],
    );
  }
}

class _Preset extends StatelessWidget {
  const _Preset({required this.minutes, required this.chosen, required this.onTap});

  final int minutes;
  final bool chosen;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      pressedScale: 0.97,
      lift: false,
      focusRadius: BorderRadius.circular(12),
      haptic: MmPressHaptic.selection,
      semanticsLabel: ChapterModel.minutesLabel(minutes),
      selected: chosen,
      builder: (context, pressed, focused) => DecoratedBox(
        decoration: ShapeDecoration(
          color: MmSelection.fill(colors, selected: chosen, pressed: pressed),
          shape: mmShapeBorder(BorderRadius.circular(12), side: MmSelection.side(colors, selected: chosen)),
        ),
        child: SizedBox(
          height: MmTarget.min,
          child: Center(child: Text(ChapterModel.minutesLabel(minutes), style: type.labelLarge.copyWith(color: colors.ink))),
        ),
      ),
    );
  }
}

class _Nudge extends StatelessWidget {
  const _Nudge({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Opacity(
      opacity: onTap == null ? 0.4 : 1,
      child: MmPressable(
        onTap: onTap,
        pressedScale: 0.94,
        lift: false,
        focusRadius: BorderRadius.circular(11),
        haptic: MmPressHaptic.selection,
        semanticsLabel: label,
        builder: (context, pressed, focused) => DecoratedBox(
          decoration: ShapeDecoration(
            color: colors.raised,
            shape: mmShapeBorder(BorderRadius.circular(11), side: BorderSide(color: colors.lineStrong)),
          ),
          child: SizedBox.square(dimension: MmTarget.min, child: Icon(icon, size: 18, color: colors.ink)),
        ),
      ),
    );
  }
}
