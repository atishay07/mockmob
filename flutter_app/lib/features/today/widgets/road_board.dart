// The road's two sheets (app-today-1016 8.6 and 8.8): the exam day the student counts to, and the
// full mocks behind them against their own target. The rail's flag and the mock ruler open them;
// both are kept on this phone. The four board tiles they used to open from are gone: the rail and
// its tuners do that job in the road itself (L05). The numbers are the record and the calendar;
// nothing predicts marks.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart' show formatDayMonth;
import '../../../core/domain/cuet_dates.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/road_plan.dart';
import '../logic/links.dart';
import '../logic/road_board.dart';
import '../logic/today_model.dart';
import 'today_type.dart';

// The sheets.

/// The day the student counts to: the expected window's start, a day inside the window, or a
/// day of their own up to the end of June. Saved on this phone at once.
Future<void> showExamDateSheet(BuildContext context, {required RoadBoard board}) => showMmSheet<void>(
      context: context,
      title: TodayCopy.boardDateTitle,
      builder: (context) => _ExamDateSheet(board: board),
    );

class _ExamDateSheet extends ConsumerWidget {
  const _ExamDateSheet({required this.board});

  final RoadBoard board;

  static final List<DateTime> _inWindow = [
    for (final d in [1, 8, 15, 22, 29]) DateTime.utc(CuetDates.windowStart.year, 5, d),
  ];

  Future<void> _choose(BuildContext context, WidgetRef ref, DateTime? day) async {
    ref.read(hapticsProvider).selection();
    await ref.read(roadPlanProvider.notifier).setExamDate(day);
    if (context.mounted) Navigator.of(context).maybePop();
  }

  Future<void> _pick(BuildContext context, WidgetRef ref) async {
    final today = board.today;
    final first = today.add(const Duration(days: 1));
    final last = latestExamDate(DateTime.utc(CuetDates.windowStart.year, 5, 1));
    final chosen = await showDatePicker(
      context: context,
      initialDate: board.examDate.isBefore(first) ? first : board.examDate,
      firstDate: first,
      lastDate: last,
      helpText: TodayCopy.boardDateTitle,
    );
    if (chosen == null || !context.mounted) return;
    await _choose(context, ref, DateTime.utc(chosen.year, chosen.month, chosen.day));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final current = ref.watch(roadPlanProvider).examDate;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(TodayCopy.boardDateBody, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s20),
        Text(TodayCopy.boardDateInWindow, style: type.microStrong.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s8),
        Wrap(
          spacing: MmSpace.s8,
          runSpacing: MmSpace.s8,
          children: [
            for (final d in _inWindow)
              if (d.isAfter(board.today))
                MmChip(
                  label: formatDayMonth(d),
                  selected: current == null ? d == _inWindow.first : current == d,
                  onTap: () => _choose(context, ref, d == _inWindow.first ? null : d),
                ),
          ],
        ),
        const SizedBox(height: MmSpace.s16),
        KeyButton.secondary(label: TodayCopy.boardDateOther, onPressed: () => _pick(context, ref)),
        if (current != null) ...[
          const SizedBox(height: MmSpace.s8),
          KeyButton.quiet(label: TodayCopy.boardDateReset, onPressed: () => _choose(context, ref, null)),
        ],
        const SizedBox(height: MmSpace.s12),
        Text(TodayCopy.savedWhere(account: ref.watch(roadPlanProvider).onAccount), style: type.micro.copyWith(color: colors.ink3)),
      ],
    );
  }
}

/// Full mocks on the record against the student's own target, the pace that target asks for,
/// and a way to start the next one.
Future<void> showMocksSheet(BuildContext context, {required RoadBoard board, void Function(TodayTarget target)? onOpen}) =>
    showMmSheet<void>(
      context: context,
      title: TodayCopy.boardMocksTitle,
      builder: (context) => _MocksSheet(board: board, onOpen: onOpen),
    );

class _MocksSheet extends ConsumerStatefulWidget {
  const _MocksSheet({required this.board, this.onOpen});

  final RoadBoard board;
  final void Function(TodayTarget target)? onOpen;

  @override
  ConsumerState<_MocksSheet> createState() => _MocksSheetState();
}

class _MocksSheetState extends ConsumerState<_MocksSheet> {
  late int _target = widget.board.mockTarget ?? suggestedMockTarget(weeks: widget.board.weeksToExam, taken: widget.board.mocksTaken ?? 0);
  bool _saving = false;

  void _step(int by) {
    final next = (_target + by).clamp(mockTargetMin, mockTargetMax);
    if (next == _target) return;
    ref.read(hapticsProvider).segmentTick();
    setState(() => _target = next);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    await ref.read(roadPlanProvider.notifier).setMockTarget(_target);
    if (!mounted) return;
    ref.read(hapticsProvider).settle();
    Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final b = widget.board;
    final taken = b.mocksTaken;
    final preview = RoadBoard(
      today: b.today,
      examDate: b.examDate,
      ownDate: b.ownDate,
      daysToExam: b.daysToExam,
      mocksTaken: taken,
      mockTarget: _target,
    );
    final left = preview.mocksLeft;
    final every = preview.daysPerMock;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          taken == null ? TodayCopy.boardMocksUnread : TodayCopy.boardMocksSoFar(taken, b.lastMockAt),
          style: type.body.copyWith(color: colors.ink2),
        ),
        const SizedBox(height: MmSpace.s20),
        Text(TodayCopy.boardTargetLabel(formatDayMonth(b.examDate)), style: type.microStrong.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s8),
        Row(
          children: [
            _StepKey(icon: LucideIcons.minus, label: TodayCopy.boardFewer, onTap: _target > mockTargetMin ? () => _step(-1) : null),
            Expanded(
              child: Semantics(
                liveRegion: true,
                label: TodayCopy.boardTargetSemantics(_target),
                excludeSemantics: true,
                child: Center(child: MonumentalNumber(value: '$_target', style: type.countFigure)),
              ),
            ),
            _StepKey(icon: LucideIcons.plus, label: TodayCopy.boardMore, onTap: _target < mockTargetMax ? () => _step(1) : null),
          ],
        ),
        const SizedBox(height: MmSpace.s12),
        MmOverlapSwitcher.fade(
          duration: const Duration(milliseconds: 180),
          alignment: Alignment.center,
          child: Text(
            key: ValueKey('$left-$every'),
            left == null ? '' : (left == 0 ? TodayCopy.boardTargetMet : TodayCopy.boardPace(left, b.weeksToExam, every)),
            textAlign: TextAlign.center,
            style: type.body.copyWith(color: colors.ink),
          ),
        ),
        const SizedBox(height: MmSpace.s20),
        KeyButton(label: TodayCopy.boardSaveTarget, loading: _saving, onPressed: _saving ? null : _save),
        if (widget.onOpen != null) ...[
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(
            label: TodayCopy.boardStartMock,
            onPressed: () {
              Navigator.of(context).maybePop();
              widget.onOpen!(GoTo(TodayLinks.fullMock()));
            },
          ),
        ],
        const SizedBox(height: MmSpace.s12),
        Text(TodayCopy.savedWhere(account: ref.watch(roadPlanProvider).onAccount), style: type.micro.copyWith(color: colors.ink3)),
      ],
    );
  }
}

/// A 48 dp round key for the stepper.
class _StepKey extends StatelessWidget {
  const _StepKey({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      excludeSemantics: true,
      child: MmSurface.inset(
        onTap: onTap,
        radius: 24,
        haptic: MmPressHaptic.none,
        child: SizedBox(
          width: 48,
          height: 48,
          child: Icon(icon, size: 20, color: onTap == null ? colors.ink3 : colors.ink),
        ),
      ),
    );
  }
}

// The study days tile opens the one study-days sheet directly (L06): the old two-sheet chain
// (a sheet that opened the editor over itself) is gone.
