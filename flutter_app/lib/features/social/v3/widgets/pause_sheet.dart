// P5 Exam pause days (spec 5.3): a month calendar with multi-select of future days. "Pause 3 days" sets
// them (your chain holds on those days), "Clear these days" takes chosen paused days away. The server
// owns the rules: PAUSE_PAST and PAUSE_LIMIT come back as its sentences and show inline under the keys.
// Days up to today cannot be chosen; days already paused wear the lamp dot.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import 'chain_calendar.dart';

class _PauseController extends ChangeNotifier {
  final Set<String> selected = {};
  int offset = 0;
  bool busy = false;
  String? error;

  void toggle(String key) {
    if (!selected.add(key)) selected.remove(key);
    error = null;
    notifyListeners();
  }

  void shift(int by) {
    offset = (offset + by).clamp(0, _maxOffset);
    notifyListeners();
  }

  void set({bool? busy, String? error, bool clearError = false, bool clearSelection = false}) {
    if (busy != null) this.busy = busy;
    if (error != null) this.error = error;
    if (clearError) this.error = null;
    if (clearSelection) selected.clear();
    notifyListeners();
  }

  /// A season is a year at most; six months ahead is enough for a school's exam weeks.
  static const int _maxOffset = 6;
}

Future<void> showPauseSheet(BuildContext context) async {
  // A notifier with no listeners left holds nothing, so there is nothing to dispose when the sheet leaves.
  final c = _PauseController();
  await showMmSheet<void>(
    context: context,
    title: MobV3Copy.examPause,
    builder: (_) => _PauseBody(controller: c),
    footer: (_) => _PauseKeys(controller: c),
  );
}

String _todayOf(ChainState c) => c.week.isNotEmpty ? c.week.last.day : (c.calendar.isNotEmpty ? c.calendar.last.day : '');

class _PauseBody extends ConsumerWidget {
  const _PauseBody({required this.controller});

  final _PauseController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chain = ref.watch(chainProvider).value;
    if (chain == null) {
      return const Padding(padding: EdgeInsets.symmetric(vertical: MmSpace.s24), child: SkeletonGroup(label: MobV3Copy.loading, child: Skeleton(height: 280, radius: 24)));
    }
    final todayKey = _todayOf(chain);
    final today = DateTime.tryParse(todayKey) ?? DateTime.now();
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final base = DateTime.utc(today.year, today.month + controller.offset, 1);
        final states = <String, ChainDayState>{
          for (final d in chain.calendar) d.day: d.state == ChainDayState.today ? ChainDayState.none : d.state,
          for (final d in chain.pauseDays) d: ChainDayState.paused,
        };
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(MobV3Copy.pauseLine(chain.pauseLeft), style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            Row(
              children: [
                Expanded(child: Text('${MobTime.monthName(base.month)} ${base.year}', style: type.cardTitle)),
                _MonthKey(icon: LucideIcons.chevronLeft, label: MobV3Copy.earlierMonth, onTap: controller.offset > 0 ? () => controller.shift(-1) : null),
                _MonthKey(icon: LucideIcons.chevronRight, label: MobV3Copy.laterMonth, onTap: controller.offset < _PauseController._maxOffset ? () => controller.shift(1) : null),
              ],
            ),
            const SizedBox(height: MmSpace.s8),
            ChainCalendar(year: base.year, month: base.month, states: states, today: todayKey, selected: controller.selected, onToggle: controller.busy ? null : controller.toggle),
            const SizedBox(height: MmSpace.s8),
          ],
        );
      },
    );
  }
}

class _MonthKey extends StatelessWidget {
  const _MonthKey({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      haptic: MmPressHaptic.selection,
      focusRadius: MmRadius.pillAll,
      builder: (context, pressed, _) => SizedBox(width: 48, height: 48, child: Icon(icon, size: 22, color: onTap == null ? colors.ink4 : (pressed ? colors.ink2 : colors.ink))),
    );
  }
}

class _PauseKeys extends ConsumerWidget {
  const _PauseKeys({required this.controller});

  final _PauseController controller;

  Future<void> _run(WidgetRef ref, Future<void> Function(List<String>) go, List<String> days) async {
    if (controller.busy) return;
    controller.set(busy: true, clearError: true);
    try {
      await go(days);
      controller.set(busy: false, clearSelection: true);
    } on Object catch (e) {
      controller.set(busy: false, error: MobV3Copy.error(e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chain = ref.watch(chainProvider).value;
    final paused = {...?chain?.pauseDays};
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final fresh = [for (final d in controller.selected) if (!paused.contains(d)) d]..sort();
        final clear = [for (final d in controller.selected) if (paused.contains(d)) d]..sort();
        final notifier = ref.read(chainProvider.notifier);
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KeyButton(
              label: fresh.isEmpty ? MobV3Copy.pickDays : MobV3Copy.pauseKey(fresh.length),
              loading: controller.busy && fresh.isNotEmpty,
              onPressed: fresh.isEmpty ? null : () => _run(ref, notifier.pause, fresh),
            ),
            if (clear.isNotEmpty) ...[
              const SizedBox(height: MmSpace.s8),
              KeyButton.secondary(label: MobV3Copy.clearDays, loading: controller.busy, onPressed: () => _run(ref, notifier.unpause, clear)),
            ],
            if (controller.error != null) ...[
              const SizedBox(height: MmSpace.s8),
              Text(controller.error!, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
            ],
          ],
        );
      },
    );
  }
}
