// The road board under "The road to May" (owner test 15 Oct: "showing the board, making it a bit
// more interactive, and making it editable or changeable"). Four tiles that are the student's
// own: the exam day they count to, the full mocks behind them against their own target, the study
// days left at their goal, and this week. Every tile opens: the date and the target are changed
// in their sheets and kept on this phone, the study days open the study days editor, and the week
// opens the week. The numbers are the record and the calendar; nothing predicts marks.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart' show formatDayMonth;
import '../../../core/domain/cuet_dates.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/widgets/goal_editor.dart' show showGoalEditor;
import '../copy.dart';
import '../data/road_plan.dart';
import '../logic/links.dart';
import '../logic/road_board.dart';
import '../logic/today_model.dart';
import 'today_entrance.dart';
import 'today_reveal.dart';
import 'today_tones.dart';
import 'today_type.dart';

class RoadBoardGrid extends StatelessWidget {
  const RoadBoardGrid({super.key, required this.board, this.onWeek, this.onOpen});

  final RoadBoard board;

  /// Opens the week (the This week tile).
  final VoidCallback? onWeek;

  /// Opens a screen from a sheet (Start a full mock).
  final void Function(TodayTarget target)? onOpen;

  @override
  Widget build(BuildContext context) {
    final b = board;
    final taken = b.mocksTaken;
    final target = b.mockTarget;
    final tiles = <Widget>[
      _Tile(
        key: const ValueKey('road-tile-date'),
        label: b.ownDate ? TodayCopy.boardYourDate : TodayCopy.boardExpectedDate,
        value: formatDayMonth(b.examDate),
        caption: TodayCopy.boardDaysLeft(b.daysToExam),
        icon: LucideIcons.pencil,
        accent: true,
        onTap: () => showExamDateSheet(context, board: b),
      ),
      _Tile(
        key: const ValueKey('road-tile-mocks'),
        label: TodayCopy.boardMocks,
        value: taken == null ? TodayCopy.boardNotRead : '$taken',
        caption: target == null ? TodayCopy.boardSetTarget : TodayCopy.boardOfTarget(target),
        progress: taken == null || target == null || target == 0 ? null : (taken / target).clamp(0.0, 1.0),
        icon: LucideIcons.pencil,
        onTap: () => showMocksSheet(context, board: b, onOpen: onOpen),
      ),
      _Tile(
        key: const ValueKey('road-tile-days'),
        label: TodayCopy.boardStudyDays,
        value: b.studyDaysLeft == null ? TodayCopy.boardNoGoal : '${b.studyDaysLeft}',
        caption: b.goal == null ? TodayCopy.boardSetDays : TodayCopy.boardAtGoal(b.goal!),
        icon: LucideIcons.chevronRight,
        onTap: () => showStudyDaysSheet(context, board: b),
      ),
      _Tile(
        key: const ValueKey('road-tile-week'),
        label: TodayCopy.boardThisWeek,
        value: b.weekDone == null ? TodayCopy.boardNotRead : (b.weekGoal == null ? '${b.weekDone}' : '${b.weekDone} of ${b.weekGoal}'),
        caption: TodayCopy.boardStudyDaysWord(b.weekGoal ?? b.weekDone ?? 0),
        progress: b.weekDone == null || b.weekGoal == null || b.weekGoal == 0 ? null : (b.weekDone! / b.weekGoal!).clamp(0.0, 1.0),
        icon: LucideIcons.chevronRight,
        onTap: onWeek,
      ),
    ];
    return TodayReveal(
      child: Builder(
        builder: (context) => LayoutBuilder(
          builder: (context, box) {
            const gap = MmSpace.s12;
            // Two across on a phone; one across when the text is very large.
            final large = MediaQuery.textScalerOf(context).scale(16) > 24;
            final across = large ? 1 : 2;
            final width = (box.maxWidth - gap * (across - 1)) / across;
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: [
                for (final (i, t) in tiles.indexed)
                  SizedBox(
                    width: width,
                    child: _Stagger(delay: Duration(milliseconds: 60 * i), child: t),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Each tile rises 12 dp and fades in turn as the board comes into view.
class _Stagger extends StatelessWidget {
  const _Stagger({required this.delay, required this.child});

  final Duration delay;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = todayEnterValue(context, delay: delay, length: const Duration(milliseconds: 360));
    return AnimatedBuilder(
      animation: t,
      child: child,
      builder: (context, child) => Opacity(
        opacity: t.value.clamp(0.0, 1.0),
        child: Transform.translate(offset: Offset(0, 12 * (1 - t.value)), child: child),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    super.key,
    required this.label,
    required this.value,
    required this.caption,
    required this.icon,
    this.progress,
    this.accent = false,
    this.onTap,
  });

  final String label;
  final String value;
  final String caption;
  final IconData icon;

  /// A thin bar under the figure (done of target), or null.
  final double? progress;

  /// The exam date: its figure in the accent ink.
  final bool accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmSurface.plain(
      onTap: onTap,
      semanticsLabel: '$label, $value, $caption',
      padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s12, MmSpace.s16),
      child: ConstrainedBox(
        // 48 dp is the floor for a target; a tile is far taller.
        constraints: const BoxConstraints(minHeight: 104),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: Text(label, style: type.microStrong.copyWith(color: colors.ink2))),
                const SizedBox(width: MmSpace.s4),
                Icon(icon, size: 16, color: colors.ink3),
              ],
            ),
            const SizedBox(height: MmSpace.s8),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: type.scoreFigure.copyWith(color: accent ? (colors.isNight ? colors.volt : colors.accentText) : colors.ink),
            ),
            const SizedBox(height: MmSpace.s4),
            Text(caption, style: type.micro.copyWith(color: colors.ink3)),
            if (progress != null) ...[
              const SizedBox(height: MmSpace.s8),
              _Bar(value: progress!),
            ],
          ],
        ),
      ),
    );
  }
}

/// Done of target as a short groove with its ink, filling on the shared draw-in rule.
class _Bar extends StatelessWidget {
  const _Bar({required this.value});

  final double value;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final t = todayEnterValue(context, delay: const Duration(milliseconds: 200), length: Motion.drawIn);
    return ExcludeSemantics(
      child: AnimatedBuilder(
        animation: t,
        builder: (context, _) => ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: SizedBox(
            height: 6,
            child: Stack(
              children: [
                Positioned.fill(child: ColoredBox(color: colors.ink.withValues(alpha: colors.isNight ? 0.08 : 0.07))),
                FractionallySizedBox(
                  widthFactor: (value * t.value).clamp(0.0, 1.0),
                  child: ColoredBox(color: value >= 1 ? colors.litMark : colors.ink.withValues(alpha: 0.55)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

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
        Text(TodayCopy.boardOnThisPhone, style: type.micro.copyWith(color: colors.ink3)),
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
        Text(TodayCopy.boardOnThisPhone, style: type.micro.copyWith(color: colors.ink3)),
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

/// The study days left at the student's goal, how they are counted, and the editor.
Future<void> showStudyDaysSheet(BuildContext context, {required RoadBoard board}) => showMmSheet<void>(
      context: context,
      title: TodayCopy.boardStudyDaysTitle,
      builder: (context) => _StudyDaysSheet(board: board),
    );

class _StudyDaysSheet extends StatelessWidget {
  const _StudyDaysSheet({required this.board});

  final RoadBoard board;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final goal = board.goal;
    final left = board.studyDaysLeft;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          goal == null || left == null ? TodayCopy.boardStudyDaysNone : TodayCopy.boardStudyDaysBody(left, goal, formatDayMonth(board.examDate)),
          style: type.body.copyWith(color: colors.ink2),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(TodayCopy.boardBoardsCount, style: type.caption.copyWith(color: colors.ink3)),
        const SizedBox(height: MmSpace.s20),
        KeyButton(
          label: goal == null ? TodayCopy.boardSetDays : TodayCopy.boardChangeDays,
          onPressed: () async {
            final navigator = Navigator.of(context);
            await navigator.maybePop();
            if (!navigator.mounted) return;
            await showGoalEditor(navigator.context, initialDays: goal ?? 4, done: board.weekDone ?? 0);
          },
        ),
      ],
    );
  }
}
