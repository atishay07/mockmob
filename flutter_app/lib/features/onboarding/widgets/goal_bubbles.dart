// The daily goal's bubbles (H1, option A, 19 Oct): 10, 20 and 30 minutes exactly as they were, and
// a fourth bubble, "More", that opens a sheet for a longer day: 1 hour (a full mock a day), 2 hours
// (two full mocks) or the student's own length in 15-minute steps, with no cap. Once a long goal is
// chosen the fourth bubble shows it ("1h", "a mock a day"), filled. Onboarding's pace step and the
// goal sheet in You use the same bubbles and the same More sheet.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../goal_copy.dart';
import '../model/answers.dart' show kMaxGoalMinutes;
import 'choice_tile.dart';

/// The three short goals; anything else is a long one, shown in the fourth bubble.
const List<int> shortGoals = [10, 20, 30];

/// Four answer bubbles: 10, 20, 30 and More. [onChanged] gets the new goal in minutes.
class GoalBubbles extends ConsumerWidget {
  const GoalBubbles({super.key, required this.value, required this.onChanged, this.size = 64});

  final int value;

  /// Null shows the bubbles without taking a pick (a save in flight).
  final ValueChanged<int>? onChanged;
  final double size;

  bool get _long => !shortGoals.contains(value);

  Future<void> _more(BuildContext context) async {
    final picked = await showGoalMoreSheet(context, current: value);
    if (picked != null && picked != value) onChanged?.call(picked);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    Widget bubble({required bool on, required Widget inside, required String caption, required String spoken, required VoidCallback? onTap, bool group = true}) {
      return Expanded(
        child: MmPressable(
          semanticsLabel: spoken,
          selected: on,
          inMutuallyExclusiveGroup: group ? true : null,
          pressedScale: 0.92,
          focusRadius: MmRadius.pillAll,
          onTap: onTap,
          builder: (context, pressed, _) => Column(
            children: [
              SizedBox.square(
                dimension: size,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Bubble(state: on ? BubbleState.filled : BubbleState.hollow, size: size - 4, inkOrigin: const Offset(-0.3, 0.5)),
                    Padding(padding: const EdgeInsets.all(8), child: FittedBox(fit: BoxFit.scaleDown, child: inside)),
                  ],
                ),
              ),
              const SizedBox(height: MmSpace.s4),
              Text(
                caption,
                textAlign: TextAlign.center,
                maxLines: 2,
                style: type.caption.copyWith(color: on ? colors.ink : colors.ink3, fontWeight: on ? FontWeight.w600 : null),
              ),
            ],
          ),
        ),
      );
    }

    TextStyle figure(bool on) => type.figureCompact.copyWith(fontSize: 30, height: 1, color: on ? colors.voltInk : colors.ink);
    return Semantics(
      container: true,
      label: OnboardingCopy.minutesLabel,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final m in shortGoals)
            bubble(
              on: m == value,
              inside: Text('$m', style: figure(m == value)),
              caption: OnboardingCopy.minutesUnit,
              spoken: OnboardingCopy.minutesSpoken(m),
              onTap: onChanged == null
                  ? null
                  : () {
                      if (m == value) return;
                      ref.read(hapticsProvider).selection();
                      GuideGlance.at(context);
                      onChanged!(m);
                    },
            ),
          bubble(
            on: _long,
            inside: _long ? Text(GoalCopy.short(value), maxLines: 1, style: figure(true)) : Icon(LucideIcons.plus, size: 28, color: colors.ink),
            caption: _long ? GoalCopy.caption(value) : GoalCopy.more,
            spoken: _long ? GoalCopy.spoken(value) : GoalCopy.moreSpoken,
            onTap: onChanged == null
                ? null
                : () {
                    ref.read(hapticsProvider).selection();
                    GuideGlance.at(context);
                    _more(context);
                  },
          ),
        ],
      ),
    );
  }
}

/// Opens the More sheet over [context] and returns the goal picked, or null when it closed
/// without one. [current] marks the long goal already chosen.
Future<int?> showGoalMoreSheet(BuildContext context, {required int current}) {
  return showMmSheet<int>(
    context: context,
    title: GoalCopy.moreTitle,
    builder: (sheet) => GoalMoreSheet(current: current, onUse: (m) => Navigator.of(sheet).pop(m)),
  );
}

/// The More sheet's body: 1 hour, 2 hours, or the student's own length, and the key that uses it.
class GoalMoreSheet extends StatefulWidget {
  const GoalMoreSheet({super.key, required this.current, required this.onUse});

  final int current;
  final ValueChanged<int> onUse;

  /// The own length's step, and its shortest.
  static const int step = 15;
  static const int shortest = 15;

  /// The longest own length the stepper reaches (the store's bound, in whole steps).
  static const int longest = kMaxGoalMinutes - kMaxGoalMinutes % step;

  @override
  State<GoalMoreSheet> createState() => _GoalMoreSheetState();
}

enum _Pick { oneHour, twoHours, own }

class _GoalMoreSheetState extends State<GoalMoreSheet> {
  late _Pick _pick;
  late int _own;

  @override
  void initState() {
    super.initState();
    final c = widget.current;
    _pick = c == 120 ? _Pick.twoHours : (c == 60 || shortGoals.contains(c) ? _Pick.oneHour : _Pick.own);
    _own = shortGoals.contains(c) || c == 60 || c == 120 ? 90 : c.clamp(GoalMoreSheet.shortest, GoalMoreSheet.longest);
  }

  int get _minutes => switch (_pick) {
        _Pick.oneHour => 60,
        _Pick.twoHours => 120,
        _Pick.own => _own,
      };

  void _setOwn(int m) => setState(() {
        _own = m.clamp(GoalMoreSheet.shortest, GoalMoreSheet.longest);
        _pick = _Pick.own;
      });

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The stepper sits over the own row, outside its tap and its words, so each key is its own
    // target for touch and for TalkBack.
    const stepperWidth = 48.0 * 2 + 64;
    Widget row(_Pick p, String title, String line, {Widget? trailing}) {
      final tile = ChoiceTile(
        selected: _pick == p,
        onTap: () => setState(() => _pick = p),
        semanticsLabel: p == _Pick.own ? GoalCopy.ownSpoken(_own) : '$title. $line',
        bubble: trailing == null ? BubbleSpot.topRight : BubbleSpot.none,
        minHeight: 72,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: type.labelLarge.copyWith(fontSize: 17, color: colors.ink)),
                  const SizedBox(height: MmSpace.s2),
                  Text(line, style: type.small.copyWith(color: colors.ink2)),
                ],
              ),
            ),
            if (trailing != null) const SizedBox(width: stepperWidth + MmSpace.s4),
          ],
        ),
      );
      return Padding(
        padding: const EdgeInsets.only(bottom: MmSpace.s12),
        child: trailing == null
            ? tile
            : Stack(
                children: [
                  tile,
                  Positioned(top: 0, bottom: 0, right: MmSpace.s12, child: Center(child: trailing)),
                ],
              ),
      );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(GoalCopy.moreLead, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
        row(_Pick.oneHour, GoalCopy.oneHour, GoalCopy.oneHourLine),
        row(_Pick.twoHours, GoalCopy.twoHours, GoalCopy.twoHoursLine),
        row(
          _Pick.own,
          GoalCopy.yourOwn,
          GoalCopy.yourOwnLine,
          trailing: _Stepper(
            value: _own,
            onDown: _own > GoalMoreSheet.shortest ? () => _setOwn(_own - GoalMoreSheet.step) : null,
            onUp: _own < GoalMoreSheet.longest ? () => _setOwn(_own + GoalMoreSheet.step) : null,
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        KeyButton(label: GoalCopy.use(_minutes), onPressed: () => widget.onUse(_minutes)),
      ],
    );
  }
}

/// Minus, the own length, plus. The minus says why it stops at 15 minutes.
class _Stepper extends StatelessWidget {
  const _Stepper({required this.value, required this.onDown, required this.onUp});

  final int value;
  final VoidCallback? onDown;
  final VoidCallback? onUp;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        RoundKey(icon: LucideIcons.minus, label: onDown == null ? GoalCopy.shortest : GoalCopy.shorter, onTap: onDown),
        SizedBox(
          width: 64,
          child: Semantics(
            liveRegion: true,
            label: GoalCopy.words(value),
            excludeSemantics: true,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(GoalCopy.short(value), textAlign: TextAlign.center, style: type.figureCompact.copyWith(fontSize: 26, height: 1, color: colors.ink)),
            ),
          ),
        ),
        RoundKey(icon: LucideIcons.plus, label: onUp == null ? GoalCopy.longest : GoalCopy.longer, onTap: onUp),
      ],
    );
  }
}

/// A round 48 dp key with one glyph (the steppers' minus and plus). Disabled, it fades and its
/// label says why.
class RoundKey extends ConsumerWidget {
  const RoundKey({super.key, required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final on = onTap != null;
    return MmPressable(
      semanticsLabel: label,
      pressedScale: 0.92,
      focusRadius: MmRadius.pillAll,
      onTap: on
          ? () {
              ref.read(hapticsProvider).segmentTick();
              onTap!();
            }
          : null,
      builder: (context, pressed, _) => SizedBox.square(
        dimension: 48,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: pressed ? colors.raised2 : Colors.transparent,
            shape: CircleBorder(side: BorderSide(color: on ? colors.lineStrong : colors.line)),
          ),
          child: Icon(icon, size: 20, color: on ? colors.ink : colors.ink3),
        ),
      ),
    );
  }
}
