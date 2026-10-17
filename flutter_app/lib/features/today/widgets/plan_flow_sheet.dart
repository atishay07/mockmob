// Change plan as a guided sentence, never a form (TODAY-1018 6.4, the owner's D3: "It should never
// look like just a basic form ... always leading and interactive UI which leads you to the next
// thing"). One sentence with three answers as underlined tokens, "I sit CUET UG on [Sat 1 May,
// expected], study [4 days] a week, and take [14 full mocks] before it.", asked one at a time
// under it; the outcome previews live. Each answer saves when tapped and says "Saved." only once
// the save has returned; a saved date leads on to the next question by itself.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/widgets/goal_editor.dart' show spreadDays;
import '../copy.dart';
import '../copy_glance.dart';
import '../logic/road_board.dart';
import '../logic/road_builder.dart' show expectedWindowStart;
import '../logic/today_model.dart';
import 'today_type.dart';
import 'road_section.dart' show RoadActions;

/// Opens Change plan; returns the receipt line once something was saved and the sheet closed.
Future<String?> showPlanFlow(BuildContext context, {required RoadLayers layers, required RoadModel road, RoadActions? actions, int initialStep = 0}) =>
    showMmSheet<String>(
      context: context,
      title: GlanceCopy.planTitle,
      builder: (context) => PlanFlowBody(layers: layers, road: road, actions: actions, initialStep: initialStep),
    );

enum _Save { idle, saving, saved, failed }

enum _Pace { fortnight, week, month, own }

class PlanFlowBody extends StatefulWidget {
  const PlanFlowBody({super.key, required this.layers, required this.road, this.actions, this.initialStep = 0, this.onClose});

  final RoadLayers layers;
  final RoadModel road;
  final RoadActions? actions;
  final int initialStep;

  /// Closes the sheet with the receipt (default: pops it).
  final ValueChanged<String?>? onClose;

  @override
  State<PlanFlowBody> createState() => _PlanFlowBodyState();
}

class _PlanFlowBodyState extends State<PlanFlowBody> {
  late int _step = widget.initialStep;
  int _direction = 1;
  late DateTime _exam = widget.layers.examDate;
  late bool _own = widget.layers.ownDate;
  late bool _monthOpen = widget.layers.ownDate;
  late Set<int> _days = (widget.road.plannedDays?.isNotEmpty ?? false)
      ? {...widget.road.plannedDays!}
      : spreadDays(widget.layers.perWeek ?? widget.layers.weekGoal ?? 4);
  late int _target = widget.layers.mockTarget;
  late _Pace _pace = _paceFor(widget.layers.mockTarget);
  final Map<int, _Save> _saves = {};
  bool _savedAny = false;
  bool _keepOne = false;
  Timer? _lead;
  Timer? _daysDebounce;

  DateTime get _today => widget.road.today;
  int get _taken => widget.layers.mocksTaken;
  int get _daysToExam => _exam.difference(_today).inDays.clamp(0, 9999);
  int get _weeks => _daysToExam ~/ 7;

  // The three named paces as totals: what is taken plus the papers still to come at that pace,
  // so the number beside "One a fortnight" leaves exactly one a fortnight to go.
  int get _fortnight => fortnightTarget(weeks: _weeks, taken: _taken);
  int get _weekly => paceTarget(weeks: _weeks, taken: _taken, weeksPerMock: 1);
  int get _monthly => paceTarget(weeks: _weeks, taken: _taken, weeksPerMock: 4.35);

  _Pace _paceFor(int n) {
    if (n == _fortnight) return _Pace.fortnight;
    if (n == _weekly) return _Pace.week;
    if (n == _monthly) return _Pace.month;
    return _Pace.own;
  }

  @override
  void dispose() {
    _lead?.cancel();
    _daysDebounce?.cancel();
    super.dispose();
  }

  void _go(int step) {
    if (step == _step || step < 0 || step > 2) return;
    _lead?.cancel();
    setState(() {
      _direction = step > _step ? 1 : -1;
      _step = step;
    });
  }

  Future<void> _run(int step, Future<void> Function() save, {bool lead = false}) async {
    setState(() => _saves[step] = _Save.saving);
    try {
      await save();
      if (!mounted) return;
      setState(() {
        _saves[step] = _Save.saved;
        _savedAny = true;
      });
      if (lead && step < 2) {
        _lead?.cancel();
        _lead = Timer(Duration(milliseconds: Motion.reduced(context) ? 0 : 520), () {
          if (mounted && _step == step) _go(step + 1);
        });
      }
    } catch (_) {
      if (mounted) setState(() => _saves[step] = _Save.failed);
    }
  }

  void _saveDate() {
    final actions = widget.actions;
    final day = _own ? _exam : null;
    _run(0, () async => actions?.setExamDate(day), lead: true);
  }

  void _pickExpected() {
    HapticFeedback.selectionClick();
    setState(() {
      _own = false;
      _monthOpen = false;
      _exam = expectedWindowStart;
    });
    _saveDate();
  }

  void _pickOwnDay(DateTime day) {
    HapticFeedback.selectionClick();
    setState(() {
      _own = true;
      _exam = day;
    });
    _saveDate();
  }

  void _toggleDay(int d) {
    HapticFeedback.selectionClick();
    if (_days.contains(d) && _days.length == 1) {
      setState(() => _keepOne = true);
      return;
    }
    setState(() {
      _keepOne = false;
      final next = {..._days};
      if (!next.remove(d)) next.add(d);
      _days = next;
    });
    _daysDebounce?.cancel();
    final picked = {..._days};
    _daysDebounce = Timer(const Duration(milliseconds: 450), () {
      final actions = widget.actions;
      _run(1, () async => actions?.savePace(picked));
    });
  }

  void _pickPace(_Pace pace, int n) {
    HapticFeedback.selectionClick();
    final target = n.clamp(_taken + 1 > mockTargetMax ? mockTargetMax : _taken + 1, mockTargetMax);
    setState(() {
      _pace = pace;
      _target = target;
    });
    final actions = widget.actions;
    _run(2, () async => actions?.setMockTarget(target));
  }

  void _close() {
    final receipt = _savedAny ? GlanceCopy.planSaved(DateTime.now(), _weeks, _days.length, _target) : null;
    final close = widget.onClose;
    if (close != null) {
      close(receipt);
    } else {
      Navigator.of(context).maybePop(receipt);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final question = switch (_step) {
      0 => GlanceCopy.askDate,
      1 => GlanceCopy.askDays,
      _ => GlanceCopy.askMocks,
    };
    final body = switch (_step) {
      0 => _dateStep(context),
      1 => _daysStep(context),
      _ => _mocksStep(context),
    };
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s4, MmSpace.gutter, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _Sentence(
            step: _step,
            date: GlanceCopy.tokenDate(_exam, own: _own),
            days: GlanceCopy.tokenDays(_days.length),
            mocks: GlanceCopy.tokenMocks(_target),
            onStep: _go,
          ),
          const SizedBox(height: MmSpace.s20),
          // One question at a time slides in from the side it comes from (12 dp, 220 ms), and the
          // sheet eases to its height (a month view opening, a shorter step).
          MmSizeEase(
            duration: Motion.ui,
            curve: Motion.out,
            alignment: Alignment.topCenter,
            clipBehavior: Clip.none,
            child: MmOverlapSwitcher.axis(
            direction: _direction,
            travel: 12,
            duration: const Duration(milliseconds: 220),
            child: Column(
              key: ValueKey('step-$_step'),
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Semantics(header: true, child: Text(question, style: type.labelLarge.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: colors.ink))),
                const SizedBox(height: MmSpace.s12),
                body,
              ],
            ),
          ),
          ),
          const SizedBox(height: MmSpace.s8),
          _SaveLine(state: _saves[_step] ?? _Save.idle, step: _step, onRetry: _retry),
          const SizedBox(height: MmSpace.s12),
          Divider(height: 1, thickness: 1, color: colors.line),
          const SizedBox(height: MmSpace.s16),
          _Preview(
            weeks: _weeks,
            days: _daysToExam,
            own: _own,
            studyDays: sessionsUntil(_today, _exam, daysPerWeek: _days.length),
            perWeek: _days.length,
            left: (_target - _taken).clamp(0, 999),
            pace: GlanceCopy.paceWords(_target - _taken <= 0 || _daysToExam <= 0 ? null : (_daysToExam / (_target - _taken)).floor().clamp(1, 999)),
          ),
          const SizedBox(height: MmSpace.s20),
          Row(
            children: [
              if (_step > 0)
                KeyButton.quiet(label: GlanceCopy.back, onPressed: () => _go(_step - 1))
              else
                const SizedBox.shrink(),
              const Spacer(),
              if (_step < 2)
                _NextKey(onTap: () => _go(_step + 1))
              else
                SizedBox(width: 140, child: KeyButton(label: GlanceCopy.done, onPressed: _close, expanded: true)),
            ],
          ),
        ],
      ),
    );
  }

  void _retry() {
    switch (_step) {
      case 0:
        _saveDate();
      case 1:
        final actions = widget.actions;
        final picked = {..._days};
        _run(1, () async => actions?.savePace(picked));
      default:
        _pickPace(_pace, _target);
    }
  }

  Widget _dateStep(BuildContext context) {
    final colors = context.mmColors;
    final windowStart = expectedWindowStart;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Two answers side by side, each with its date as the figure: a choice to make, not a
        // field to fill.
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _Tile(
                  key: const ValueKey('plan-date-expected'),
                  selected: !_own,
                  onTap: _pickExpected,
                  semantics: '${GlanceCopy.dateExpected}. ${GlanceCopy.dateExpectedNote(windowStart)}',
                  label: GlanceCopy.dateExpected,
                  figure: GlanceCopy.dateFigure(windowStart),
                  note: GlanceCopy.dateExpectedShort,
                ),
              ),
              const SizedBox(width: MmSpace.s8),
              Expanded(
                child: _Tile(
                  key: const ValueKey('plan-date-own'),
                  selected: _own,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() => _monthOpen = true);
                  },
                  semantics: '${GlanceCopy.dateOwn}. ${GlanceCopy.dateOwnNote}',
                  label: GlanceCopy.dateOwn,
                  figure: _own ? GlanceCopy.dateFigure(_exam) : GlanceCopy.pickADay,
                  figureColor: _own ? null : colors.ink3,
                  note: GlanceCopy.dateOwnNote,
                ),
              ),
            ],
          ),
        ),
        MmSizeEase(
          duration: Motion.ui,
          curve: Motion.out,
          alignment: Alignment.topCenter,
          clipBehavior: Clip.hardEdge,
          child: _monthOpen
              ? Padding(
                  padding: const EdgeInsets.only(top: MmSpace.s16),
                  child: _MonthView(
                    months: [DateTime.utc(windowStart.year, 5), DateTime.utc(windowStart.year, 6)],
                    selected: _own ? _exam : null,
                    ringed: windowStart,
                    first: _today.add(const Duration(days: 1)),
                    last: latestExamDate(windowStart),
                    onDay: _pickOwnDay,
                  ),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }

  Widget _daysStep(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // The week as seven answer bubbles: a chosen day is filled in, like a mark on the sheet.
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            for (var d = 0; d < 7; d++) _DayBubble(label: TodayCopy.weekdayShort[d], on: _days.contains(d), onTap: () => _toggleDay(d)),
          ],
        ),
        const SizedBox(height: MmSpace.s12),
        Text(_keepOne ? GlanceCopy.keepOneDay : GlanceCopy.daysHint, style: type.caption.copyWith(fontSize: 13.5, height: 19 / 13.5, color: _keepOne ? colors.ink : colors.ink2)),
      ],
    );
  }

  Widget _mocksStep(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rows = [
      (_Pace.fortnight, GlanceCopy.paceFortnight, _fortnight, true),
      (_Pace.week, GlanceCopy.paceWeek, _weekly, false),
      (_Pace.month, GlanceCopy.paceMonth, _monthly, false),
    ];
    final note = switch (_pace) {
      _Pace.fortnight => GlanceCopy.paceFortnightWhy,
      _Pace.week => GlanceCopy.paceWeekNote,
      _Pace.month => GlanceCopy.paceMonthNote,
      _Pace.own => GlanceCopy.paceOwnNote(_taken),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Three paces as figures side by side: the total each one reaches by the exam.
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var k = 0; k < rows.length; k++) ...[
                if (k > 0) const SizedBox(width: MmSpace.s8),
                Expanded(
                  child: _Tile(
                    key: ValueKey('plan-pace-${rows[k].$1.name}'),
                    selected: _pace == rows[k].$1,
                    onTap: () => _pickPace(rows[k].$1, rows[k].$3),
                    semantics: '${rows[k].$2}, ${rows[k].$3} full mocks${rows[k].$4 ? ', suggested' : ''}',
                    tag: rows[k].$4 ? GlanceCopy.suggested : null,
                    figure: '${rows[k].$3}',
                    note: rows[k].$2,
                    big: true,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        _Tile(
          key: const ValueKey('plan-pace-own'),
          selected: _pace == _Pace.own,
          onTap: () => _pickPace(_Pace.own, _target),
          semantics: '${GlanceCopy.paceOwn}, $_target full mocks',
          label: GlanceCopy.paceOwn,
          trailing: _Stepper(
            value: _target,
            canLess: _target > _taken + 1 && _target > mockTargetMin,
            canMore: _target < mockTargetMax,
            onLess: () => _pickPace(_Pace.own, _target - 1),
            onMore: () => _pickPace(_Pace.own, _target + 1),
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        MmOverlapSwitcher.fade(
          alignment: Alignment.topLeft,
          child: Text(note, key: ValueKey(note), style: type.caption.copyWith(fontSize: 13.5, height: 19 / 13.5, color: colors.ink2)),
        ),
      ],
    );
  }
}

/// The sentence, with its three answers as tokens: the current one underlined in the accent,
/// the others in a quiet line. Tapping a token jumps to its question.
class _Sentence extends StatelessWidget {
  const _Sentence({required this.step, required this.date, required this.days, required this.mocks, required this.onStep});

  final int step;
  final String date;
  final String days;
  final String mocks;
  final ValueChanged<int> onStep;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final base = type.headline.copyWith(fontSize: 25, height: 1.5, color: colors.ink3, fontWeight: FontWeight.w600);
    InlineSpan token(int k, String text) => WidgetSpan(
          alignment: PlaceholderAlignment.baseline,
          baseline: TextBaseline.alphabetic,
          child: _Token(text: text, current: step == k, style: base.copyWith(color: colors.ink), onTap: () => onStep(k), step: k),
        );
    return Semantics(
      container: true,
      child: Text.rich(
        TextSpan(children: [
          const TextSpan(text: GlanceCopy.sentenceA),
          token(0, date),
          const TextSpan(text: GlanceCopy.sentenceB),
          token(1, days),
          const TextSpan(text: GlanceCopy.sentenceC),
          token(2, mocks),
          const TextSpan(text: GlanceCopy.sentenceD),
        ]),
        style: base,
      ),
    );
  }
}

class _Token extends StatelessWidget {
  const _Token({required this.text, required this.current, required this.style, required this.onTap, required this.step});

  final String text;
  final bool current;
  final TextStyle style;
  final VoidCallback onTap;
  final int step;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    return MmPressable(
      key: ValueKey('plan-token-$step'),
      onTap: onTap,
      semanticsLabel: GlanceCopy.stepSemantics(step + 1, text),
      selected: current,
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.97,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: Motion.of(context, const Duration(milliseconds: 200)),
        curve: Motion.out,
        padding: const EdgeInsets.only(bottom: 2),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: current ? accent : colors.lineStrong, width: 2)),
        ),
        child: Text(text, style: style.copyWith(color: pressed ? colors.ink2 : colors.ink)),
      ),
    );
  }
}

/// One answer as a tile: an optional tag ("Suggested"), its label, its figure, a note, and an
/// optional control. Chosen, it is filled and edged in ink; there is no radio mark: the figure is
/// the answer.
class _Tile extends StatelessWidget {
  const _Tile({
    super.key,
    required this.selected,
    required this.onTap,
    required this.semantics,
    this.label,
    this.figure,
    this.figureColor,
    this.note,
    this.tag,
    this.trailing,
    this.big = false,
  });

  final bool selected;
  final VoidCallback onTap;
  final String semantics;
  final String? label;
  final String? figure;
  final Color? figureColor;
  final String? note;
  final String? tag;
  final Widget? trailing;

  /// A pace tile: the figure leads, large, with a line kept for the tag so the three align.
  final bool big;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final accent = colors.isNight ? colors.volt : colors.accentText;
    final tagStyle = type.micro.copyWith(fontSize: 11.5, height: 15 / 11.5, color: accent, fontWeight: FontWeight.w700, letterSpacing: 0.2);
    final words = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (big) ...[
          // The tag's line is kept on every pace tile, so the three figures stand on one line.
          Text(tag ?? ' ', style: tagStyle),
          const SizedBox(height: MmSpace.s4),
        ],
        if (label != null)
          Text(label!, style: type.labelLarge.copyWith(fontSize: 14, height: 19 / 14, fontWeight: FontWeight.w600, color: colors.ink2)),
        if (figure != null) ...[
          if (label != null) const SizedBox(height: MmSpace.s6),
          Text(
            figure!,
            style: type.figureCompact.copyWith(fontSize: big ? 34 : 24, height: 1, color: figureColor ?? colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
          ),
        ],
        if (note != null) ...[
          SizedBox(height: big ? MmSpace.s6 : MmSpace.s8),
          Text(
            note!,
            style: big
                ? type.labelLarge.copyWith(fontSize: 13.5, height: 18 / 13.5, fontWeight: FontWeight.w600, color: colors.ink)
                : type.caption.copyWith(fontSize: 12.5, height: 17 / 12.5, color: colors.ink2),
          ),
        ],
      ],
    );
    return MmPressable(
      onTap: onTap,
      semanticsLabel: semantics,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      focusRadius: BorderRadius.circular(18),
      pressedScale: 0.975,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: Motion.of(context, const Duration(milliseconds: 180)),
        curve: Motion.out,
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s12, MmSpace.s12),
        decoration: BoxDecoration(
          color: selected ? colors.selectedSurface : (pressed ? colors.raised2.withValues(alpha: 0.5) : Colors.transparent),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: selected ? colors.ink2 : colors.line, width: selected ? 1.5 : 1),
        ),
        child: trailing == null
            ? Align(alignment: Alignment.topLeft, child: words)
            : Row(children: [Expanded(child: words), const SizedBox(width: MmSpace.s8), trailing!]),
      ),
    );
  }
}

/// One weekday as an answer bubble: chosen, it is filled in ink with its name in the ground's
/// colour; open, it is a ring. 44 dp, the whole bubble is the target.
class _DayBubble extends StatelessWidget {
  const _DayBubble({required this.label, required this.on, required this.onTap});

  final String label;
  final bool on;
  final VoidCallback onTap;

  static const double size = 44;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      checked: on,
      focusRadius: MmRadius.pillAll,
      pressedScale: 0.92,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: Motion.of(context, const Duration(milliseconds: 180)),
        curve: Motion.out,
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: on ? colors.ink : (pressed ? colors.raised2 : Colors.transparent),
          border: on ? null : Border.all(color: colors.ink3, width: 1.5),
        ),
        child: Text(
          label,
          maxLines: 1,
          softWrap: false,
          textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.15),
          style: type.micro.copyWith(fontSize: 12.5, fontWeight: FontWeight.w700, color: on ? colors.ground : colors.ink2),
        ),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.value, required this.canLess, required this.canMore, required this.onLess, required this.onMore});

  final int value;
  final bool canLess;
  final bool canMore;
  final VoidCallback onLess;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    Widget key(IconData icon, String label, bool enabled, VoidCallback onTap) => MmPressable(
          onTap: enabled ? onTap : null,
          semanticsLabel: label,
          focusRadius: MmRadius.pillAll,
          pressedScale: 0.92,
          haptic: MmPressHaptic.selection,
          builder: (context, pressed, _) => Container(
            width: MmTarget.min,
            height: MmTarget.min,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.lineStrong), color: pressed ? colors.raised2 : null),
            child: Icon(icon, size: 16, color: enabled ? colors.ink : colors.ink4),
          ),
        );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        key(LucideIcons.minus, GlanceCopy.fewer, canLess, onLess),
        SizedBox(
          width: 44,
          child: Text('$value', textAlign: TextAlign.center, style: type.figureCompact.copyWith(fontSize: 22, height: 1, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
        ),
        key(LucideIcons.plus, GlanceCopy.more, canMore, onMore),
      ],
    );
  }
}

/// May and June as month views: the expected day ringed, the chosen day filled in ink.
class _MonthView extends StatelessWidget {
  const _MonthView({required this.months, required this.selected, required this.ringed, required this.first, required this.last, required this.onDay});

  final List<DateTime> months;
  final DateTime? selected;
  final DateTime ringed;
  final DateTime first;
  final DateTime last;
  final ValueChanged<DateTime> onDay;

  static const List<String> _names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    bool same(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final m in months) ...[
          Text('${_names[m.month - 1]} ${m.year}', style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink)),
          const SizedBox(height: MmSpace.s8),
          // The weekdays over their columns, so a date reads as a day.
          ExcludeSemantics(
            child: Row(
              children: [
                for (final d in TodayCopy.weekdayShort)
                  Expanded(
                    child: Text(d, textAlign: TextAlign.center, style: type.micro.copyWith(fontSize: 11.5, fontWeight: FontWeight.w600, color: colors.ink3)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s4),
          LayoutBuilder(
            builder: (context, box) {
              final cell = box.maxWidth / 7;
              final lead = DateTime.utc(m.year, m.month, 1).weekday - 1;
              final count = DateTime.utc(m.year, m.month + 1, 0).day;
              return Wrap(
                children: [
                  for (var k = 0; k < lead; k++) SizedBox(width: cell, height: MmTarget.min),
                  for (var d = 1; d <= count; d++)
                    () {
                      final day = DateTime.utc(m.year, m.month, d);
                      final enabled = !day.isBefore(first) && !day.isAfter(last);
                      final chosen = selected != null && same(selected!, day);
                      final ring = same(ringed, day);
                      // The whole cell is the target (at least 44 dp); the day's circle is 36.
                      return SizedBox(
                        width: cell,
                        height: MmTarget.min,
                        child: MmPressable(
                            onTap: enabled ? () => onDay(day) : null,
                            semanticsLabel: '${GlanceCopy.dayShort(day)}${ring ? ', expected start' : ''}',
                            selected: chosen,
                            focusRadius: MmRadius.pillAll,
                            pressedScale: 0.92,
                            builder: (context, pressed, _) => Center(
                              child: Container(
                              width: 36,
                              height: 36,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: chosen ? colors.ink : (pressed ? colors.raised2 : null),
                                border: ring && !chosen ? Border.all(color: colors.ink2, width: 1.5) : null,
                              ),
                              child: Text(
                                '$d',
                                style: type.caption.copyWith(
                                  fontSize: 14,
                                  fontWeight: chosen || ring ? FontWeight.w700 : FontWeight.w500,
                                  color: chosen ? colors.ground : (enabled ? colors.ink : colors.ink4),
                                  fontFeatures: const [FontFeature.tabularFigures()],
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }(),
                ],
              );
            },
          ),
          const SizedBox(height: MmSpace.s12),
        ],
      ],
    );
  }
}

class _SaveLine extends StatelessWidget {
  const _SaveLine({required this.state, required this.step, required this.onRetry});

  final _Save state;
  final int step;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.caption.copyWith(fontSize: 13.5, color: colors.ink2);
    final Widget child = switch (state) {
      _Save.idle => const SizedBox(height: 20, width: double.infinity),
      _Save.saving => Text(GlanceCopy.saving, key: const ValueKey('saving'), style: style),
      _Save.saved => Row(
          key: const ValueKey('saved'),
          children: [
            Icon(LucideIcons.check, size: 14, color: colors.goodText),
            const SizedBox(width: MmSpace.s6),
            Text(GlanceCopy.saved, style: style.copyWith(color: colors.ink)),
          ],
        ),
      _Save.failed => Row(
          key: const ValueKey('failed'),
          children: [
            Expanded(
              child: Text(
                switch (step) {
                  0 => GlanceCopy.notSavedDate,
                  1 => GlanceCopy.notSavedDays,
                  _ => GlanceCopy.notSavedMocks,
                },
                style: style.copyWith(color: colors.ink),
              ),
            ),
            KeyButton.quiet(label: GlanceCopy.tryAgain, onPressed: onRetry),
          ],
        ),
    };
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 24),
      child: Semantics(liveRegion: true, child: MmOverlapSwitcher.fade(alignment: Alignment.centerLeft, child: child)),
    );
  }
}

/// The outcome, live: weeks to the date, study days at the pace, mocks to go.
class _Preview extends StatelessWidget {
  const _Preview({required this.weeks, required this.days, required this.own, required this.studyDays, required this.perWeek, required this.left, required this.pace});

  final int weeks;
  final int days;
  final bool own;
  final int studyDays;
  final int perWeek;
  final int left;
  final String pace;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    Widget cell(int value, String label) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              MmCountUp(
                value: value,
                fromZeroOnFirstBuild: false,
                style: type.figureCompact.copyWith(fontSize: 26, height: 1, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
              const SizedBox(height: MmSpace.s6),
              Text(label, style: type.caption.copyWith(fontSize: 12.5, height: 17 / 12.5, color: colors.ink2)),
            ],
          ),
        );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        days >= 7 ? cell(weeks, TodayCopy.roadWeeksTo(own: own, n: weeks)) : cell(days, TodayCopy.roadDaysTo(own: own, n: days)),
        const SizedBox(width: MmSpace.s12),
        cell(studyDays, GlanceCopy.previewStudy(perWeek)),
        const SizedBox(width: MmSpace.s12),
        cell(left, GlanceCopy.previewMocks(pace)),
      ],
    );
  }
}

class _NextKey extends StatelessWidget {
  const _NextKey({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      key: const ValueKey('plan-next'),
      onTap: onTap,
      semanticsLabel: GlanceCopy.next,
      focusRadius: MmRadius.pillAll,
      pressedScale: 0.96,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s24),
        alignment: Alignment.center,
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : colors.selectedSurface,
          shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
        ),
        child: Text(GlanceCopy.next, style: type.labelLarge.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: colors.ink)),
      ),
    );
  }
}
