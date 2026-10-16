import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/hybrid/hybrid.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../domain/du_combos.dart' show duDefaultMaxPapers;
import '../domain/du_helpers.dart';
import '../domain/du_models.dart';
import '../widgets/action_chip.dart';
import '../widgets/chip_flight.dart';
import '../widgets/subject_picker_sheet.dart';
import '../widgets/tools_card.dart';
import '../widgets/tools_parts.dart';
import 'compass_controller.dart';

/// Opens the subject picker wired to Compass.
Future<void> openCompassPicker(BuildContext context, WidgetRef ref, DuCatalog catalog) {
  final controller = ref.read(compassControllerProvider.notifier);
  return showSubjectPicker(
    context: context,
    catalog: catalog,
    watch: (ref) => ref.watch(compassControllerProvider).value?.selection.picks.toSet() ?? const {},
    onToggle: controller.toggle,
    onPreset: controller.applyPreset,
    onClear: controller.clear,
  );
}

/// What the hero says about a change in what the subjects open: the figure the delta chip shows.
/// Pure, so the choices are tested without a screen.
abstract final class CompassReaction {
  /// The eligible count the hero shows: nothing ticked is 0.
  static int openOf(CompassState s) => s.selection.isEmpty ? 0 : s.eligible.length;

  /// "+12" or "-4"; null when nothing changed (or there was no count before to compare with).
  static String? deltaText({required int before, required int after}) {
    final d = after - before;
    if (d == 0 || before == 0) return null;
    return d > 0 ? '+$d' : '$d';
  }
}

/// The focal pane of Compass: how many DU programmes the ticked subjects open (out of all of
/// them), the subjects themselves as inked chips (tap one to take it off), and the key to edit.
/// With nothing ticked it becomes the starting point: the rule of thumb and the presets.
///
/// With subjects ticked the count rolls from the old value to the new, the ring travels from the
/// previous fraction, and a small "+12" or "-4" chip rises beside the figure for a couple of
/// seconds. The gimbal compass beside the figure is the card's one character: it carries the share
/// open round its dial and swings its needle with each change (off the line while nothing is
/// open). No Mobi here: the compass is the largest thing on the card and two characters competing
/// in one card read as clutter. Every figure is the real count.
class CompassHero extends ConsumerStatefulWidget {
  const CompassHero({super.key, required this.state});

  final CompassState state;

  /// How long the delta chip stays.
  static const Duration deltaHold = Duration(milliseconds: 2400);

  /// The compass art's height (it is a little narrower than tall).
  static const double compassHeight = 84;

  /// Where the needle rests while nothing is open: well off the lubber line, toward ten o'clock.
  static const double noHeading = -1.15;

  @override
  ConsumerState<CompassHero> createState() => _CompassHeroState();
}

class _CompassHeroState extends ConsumerState<CompassHero> {
  String? _delta;
  int _deltaId = 0;
  Timer? _deltaTimer;

  /// False while the page is opening: chips drawn then are simply there; a chip added after it
  /// springs in (or flies in from the unlock chip that was committed).
  bool _settled = false;

  /// Goes up on every change of the count: the compass needle is knocked off its heading and
  /// settles on it again, the way the count is weighed again ([_nudgeWay] is the direction).
  int _nudge = 0;
  int _nudgeWay = 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _settled = true);
  }

  @override
  void didUpdateWidget(CompassHero old) {
    super.didUpdateWidget(old);
    final before = CompassReaction.openOf(old.state);
    final after = CompassReaction.openOf(widget.state);
    if (before == after) return;
    _nudge++;
    _nudgeWay = after > before ? 1 : -1;
    final text = CompassReaction.deltaText(before: before, after: after);
    _deltaTimer?.cancel();
    if (text == null || after == 0) {
      _delta = null;
      return;
    }
    _delta = text;
    _deltaId++;
    _deltaTimer = Timer(CompassHero.deltaHold, () {
      if (mounted) setState(() => _delta = null);
    });
  }

  @override
  void dispose() {
    _deltaTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = widget.state;
    final controller = ref.read(compassControllerProvider.notifier);

    if (s.selection.isEmpty) {
      return ToolsCard(
        lit: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(ToolsCopy.emptyHeroTitle, style: type.cardTitle),
            const SizedBox(height: MmSpace.s8),
            Text(ToolsCopy.emptyHeroBody, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            Text(ToolsCopy.quickStart, style: type.caption.copyWith(color: colors.ink3)),
            const SizedBox(height: MmSpace.s4),
            Wrap(
              spacing: MmSpace.s8,
              children: [
                for (final p in duPresets)
                  ToolsActionChip(label: p.label, icon: LucideIcons.zap, onTap: () => controller.applyPreset(p)),
              ],
            ),
            const SizedBox(height: MmSpace.s20),
            KeyButton(label: ToolsCopy.pickSubjects, onPressed: () => openCompassPicker(context, ref, s.catalog)),
          ],
        ),
      );
    }

    final open = s.eligible.length;
    final fraction = s.total == 0 ? 0.0 : open / s.total;
    return ToolsCard(
      lit: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: MergeSemantics(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Flexible(child: ToolsNumber(value: '$open', unit: 'of ${s.total}', semanticsLabel: '$open of ${s.total}')),
                          const SizedBox(width: MmSpace.s8),
                          _DeltaSlot(delta: _delta, id: _deltaId),
                        ],
                      ),
                      const SizedBox(height: MmSpace.s8),
                      Text(ToolsCopy.programmesOpen, style: type.labelLarge),
                      const SizedBox(height: 2),
                      Text(ToolsCopy.rulesLine, style: type.caption.copyWith(color: colors.ink3)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              // The compass is the card's art and its second signal: its needle settles on the lubber
              // line once the count is in, is knocked off and settles again when the count changes,
              // and comes to rest off the line, with no heading, while nothing is open. The share
              // open runs round its dial (it was the ring), travelling from the old share to the
              // new. Decorative: the figure says it all. (It searches only while the lists load.)
              HybridCompass(
                key: const ValueKey('compass-ring'),
                height: CompassHero.compassHeight,
                heading: open == 0 ? CompassHero.noHeading : 0,
                nudge: _nudge,
                nudgeDirection: _nudgeWay,
                arc: fraction,
              ),
            ],
          ),
          const SizedBox(height: MmSpace.s16),
          Wrap(
            spacing: MmSpace.s8,
            children: [
              for (final pick in s.selection.picks)
                FlyInChip(
                  key: ValueKey('subject-${pick.key}'),
                  id: pick.key,
                  label: pick.name(s.catalog, short: true),
                  arrives: _settled,
                  child: MmChip(
                    label: pick.name(s.catalog, short: true),
                    selected: true,
                    onTap: () => controller.toggle(pick),
                  ),
                ),
            ],
          ),
          const SizedBox(height: MmSpace.s4),
          Text(ToolsCopy.subjectsTapToRemove, style: type.caption.copyWith(color: colors.ink3)),
          if (s.previewing) ...[
            const SizedBox(height: MmSpace.s8),
            Text(ToolsCopy.fromCombo, style: type.caption.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s4),
            KeyButton.quiet(label: ToolsCopy.keepCombo, onPressed: controller.keepCombination),
          ],
          if (s.selection.count > duDefaultMaxPapers) ...[
            const SizedBox(height: MmSpace.s12),
            InlineBanner(message: ToolsCopy.overLimit(s.selection.count, duDefaultMaxPapers), tone: BannerTone.warning),
          ],
          const SizedBox(height: MmSpace.s4),
          Transform.translate(
            offset: const Offset(-MmSpace.s8, 0),
            child: ToolsInlineAction(
              label: ToolsCopy.editSubjects,
              icon: LucideIcons.pencilLine,
              onTap: () => openCompassPicker(context, ref, s.catalog),
            ),
          ),
        ],
      ),
    );
  }
}

/// The "+12" or "-4" chip: it fades up beside the figure and goes after [CompassHero.deltaHold].
/// A new change swaps it in place. The slot keeps its height, so the figure never shifts.
class _DeltaSlot extends StatelessWidget {
  const _DeltaSlot({required this.delta, required this.id});

  final String? delta;
  final int id;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    final text = delta;
    final more = text != null && text.startsWith('+');
    return AnimatedSwitcher(
      duration: reduced ? Duration.zero : Motion.crossFade,
      switchInCurve: Motion.glide,
      switchOutCurve: Motion.exit,
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(position: Tween(begin: const Offset(0, 0.5), end: Offset.zero).animate(animation), child: child),
      ),
      child: text == null
          ? const SizedBox(key: ValueKey('no-delta'), height: 24)
          : Semantics(
              key: ValueKey('delta-$id'),
              label: more ? '${text.substring(1)} more open than before' : '${text.substring(1)} fewer open than before',
              excludeSemantics: true,
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  shape: const StadiumBorder(),
                  color: more ? (colors.isNight ? colors.volt : colors.accentText).withValues(alpha: 0.16) : colors.raised2,
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 2),
                  child: Text(
                    text,
                    style: type.caption.copyWith(
                      fontWeight: FontWeight.w700,
                      color: more ? colors.accentText : colors.ink2,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}
