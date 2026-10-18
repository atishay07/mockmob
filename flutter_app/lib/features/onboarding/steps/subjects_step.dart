import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../choices_copy.dart';
import '../copy.dart';
import '../data/eligibility.dart';
import '../data/subject_sets.dart';
import '../data/subjects.dart';
import '../model/answers.dart';
import '../model/deck.dart';
import '../model/plan.dart';
import '../state/answers_controller.dart';
import '../widgets/entrance.dart';
import '../widgets/flip_reorder.dart';
import '../widgets/step_frame.dart';
import '../widgets/step_layout.dart';
import '../widgets/subject_picker.dart';
import '../widgets/subject_row.dart';

/// The subjects a row is offered for without opening the picker: the Commerce set the course
/// list is built on, the General Test and Maths.
const List<SheetSubject> kQuickSubjects = [
  SheetSubject.accountancy,
  SheetSubject.economics,
  SheetSubject.businessStudies,
  SheetSubject.english,
  SheetSubject.generalTest,
  SheetSubject.mathematics,
];

/// Step 5: the subjects, and how solid each feels. Nothing is assumed (owner, 18 Oct, D42): "Add a
/// subject" leads, then up to three common sets that tick in one tap; with a course, only what
/// every one of its Bulletin combinations names starts ticked, marked "Needed for" it. Chosen rows
/// reorder weakest first as the student rates them; once there is one, the common single picks
/// follow. The eligibility line for the chosen course updates live.
class SubjectsStep extends ConsumerStatefulWidget {
  const SubjectsStep({super.key, required this.answers, required this.onNext});

  final OnboardingAnswers answers;
  final VoidCallback onNext;

  @override
  ConsumerState<SubjectsStep> createState() => _SubjectsStepState();
}

class _SubjectsStepState extends ConsumerState<SubjectsStep> {
  bool _capped = false;

  /// The first rated row, so a set tap can bring the ratings up under the sets (the title's
  /// question is the point of the step, not the set).
  final GlobalKey _firstRated = GlobalKey();

  /// A set was just tapped: the next frame slides the rated rows into view.
  bool _revealRated = false;

  /// The other sets are open again after a set was chosen (they fold into one quiet row).
  bool _allSets = false;

  /// The subject whose Shaky bubble pulses once, on the first set tap of a sheet with no rating.
  SheetSubject? _pulse;
  bool _pulsed = false;
  Timer? _hush;
  Timer? _unpulse;

  @override
  void dispose() {
    _hush?.cancel();
    _unpulse?.cancel();
    super.dispose();
  }

  /// A set was tapped: the rows slide up under it and Mobi asks for the honest rating.
  void _onSet(SubjectSet set) {
    final c = ref.read(onboardingAnswersProvider.notifier);
    final before = widget.answers;
    final turningOff = set.matches(before.subjects);
    setState(() {
      _capped = false;
      _allSets = false;
      c.applySubjectSet(set.subjects);
      _revealRated = !turningOff;
    });
    if (turningOff || before.confidence.isNotEmpty) return;
    final mobi = StepGuide.of(context)?.mobi;
    if (mobi != null) {
      mobi.say(OnboardingCopy.mobiRateNow);
      _hush?.cancel();
      _hush = Timer(Duration(milliseconds: (MobiTyping.duration(OnboardingCopy.mobiRateNow) * 1000).round() + 2600), mobi.hush);
    }
    if (!_pulsed) {
      _pulsed = true;
      final after = ref.read(onboardingAnswersProvider).value?.ranked;
      if (after != null && after.isNotEmpty) {
        setState(() => _pulse = after.first);
        _unpulse?.cancel();
        _unpulse = Timer(const Duration(milliseconds: 900), () {
          if (mounted) setState(() => _pulse = null);
        });
      }
    }
  }

  /// Slides the first rated row to about a third of the way down the visible list.
  void _scrollToRated() {
    final target = _firstRated.currentContext;
    if (target == null) return;
    Scrollable.ensureVisible(target, duration: Motion.of(context, const Duration(milliseconds: 360)), curve: Motion.glide, alignment: 0.3);
  }

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (mounted) ref.read(onboardingAnswersProvider.notifier).ensureSubjects();
    });
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.answers;
    final colors = context.mmColors;
    final c = ref.read(onboardingAnswersProvider.notifier);
    final included = a.ranked;
    // The single common picks join once the student has a subject; before that the sets lead.
    final rest = a.subjects.isEmpty
        ? const <SheetSubject>[]
        : [
            for (final s in kQuickSubjects)
              if (!a.subjects.contains(s)) s,
          ];
    final course = a.course;
    final check = course == null || a.subjects.isEmpty ? null : EligibilityCheck.of(course, a.subjects.toSet());
    final line = PlanSummary.eligibilityLine(a);
    final sets = SubjectSets.forCourse(course);
    final needed = neededSubjects(course);

    // Rows lift in the order they stand: Add, the sets, the note, the chosen ones, the picks.
    final lead = 1 + sets.length + (line == null ? 0 : 1);
    final order = [...included, ...rest];
    Widget row(SheetSubject s) => FlipItem(
      key: ValueKey(s),
      child: EntranceItem.answer(
        lead + order.indexOf(s),
        child: SubjectRow(
          key: included.isNotEmpty && s == included.first ? _firstRated : null,
          pulseShaky: s == _pulse,
          subject: s,
          included: a.subjects.contains(s),
          confidence: a.confidence[s],
          note: course != null && needed.contains(s) ? ChoicesCopy.neededFor(course.short) : null,
          onToggle: () => setState(() => _capped = !c.toggleSubject(s)),
          onConfidence: (v) => c.setConfidence(s, v),
        ),
      ),
    );

    if (_revealRated) {
      _revealRated = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _scrollToRated();
      });
    }
    // Once a set is chosen the other sets fold into one quiet row, so the rated rows sit above
    // the key (they open again with a tap, or when the sheet no longer matches a set).
    final chosenSet = sets.where((x) => x.matches(a.subjects)).firstOrNull;
    final folded = chosenSet != null && !_allSets && sets.length > 1;
    final shownSets = folded ? [chosenSet] : sets;

    return StepLayout(
      title: OnboardingCopy.subjectsTitle,
      support: ChoicesCopy.subjectsSupportOpen,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EntranceItem.answer(0, child: _AddRow(onTap: () => showSubjectPicker(context))),
          if (sets.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s20, bottom: MmSpace.s8),
              child: Text(ChoicesCopy.quickSetsLabel, style: context.mmType.label.copyWith(color: colors.ink3)),
            ),
            for (var i = 0; i < shownSets.length; i++)
              EntranceItem.answer(
                1 + i,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: MmSpace.s8),
                  child: _SetRow(
                    key: ValueKey(shownSets[i].title),
                    set: shownSets[i],
                    on: shownSets[i].matches(a.subjects),
                    onTap: () => _onSet(shownSets[i]),
                  ),
                ),
              ),
            if (folded)
              EntranceItem.answer(
                2,
                child: _OtherSetsRow(count: sets.length - 1, onTap: () => setState(() => _allSets = true)),
              ),
          ],
          if (line != null)
            EntranceItem.answer(
              1 + sets.length,
              child: Padding(
                padding: const EdgeInsets.only(top: MmSpace.s12, bottom: MmSpace.s4),
                child: _Note(
                  text: line,
                  icon: check?.eligible ?? false ? LucideIcons.check : LucideIcons.circleAlert,
                  color: check?.eligible ?? false ? colors.accentText : colors.warnText,
                ),
              ),
            ),
          if (included.isNotEmpty) const SizedBox(height: MmSpace.s12),
          for (final s in included) row(s),
          if (_capped)
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s8),
              child: _Note(text: OnboardingCopy.fiveMax, icon: LucideIcons.info, color: colors.ink2),
            ),
          if (rest.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s12, bottom: MmSpace.s8),
              child: Text(OnboardingCopy.commonPicks, style: context.mmType.label.copyWith(color: colors.ink3)),
            ),
            for (final s in rest) row(s),
          ],
        ],
      ),
      bottom: KeyButton(
        label: OnboardingCopy.next,
        disabledReason: a.subjects.isEmpty ? OnboardingCopy.pickOne : null,
        onPressed: a.subjects.isEmpty
            ? null
            : () {
                c.edit((x) => x.mark(Steps.subjects));
                widget.onNext();
              },
      ),
    );
  }
}

/// One common set as a row: its name, the subjects in it, and the select bubble that inks when
/// the sheet holds exactly this set.
class _SetRow extends StatelessWidget {
  const _SetRow({super.key, required this.set, required this.on, required this.onTap});

  final SubjectSet set;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return MmSelectRow(title: set.title, note: [for (final s in set.subjects) s.label].join(', '), selected: on, onTap: onTap);
  }
}

/// The other sets, folded into one quiet 48 dp row once a set is chosen: a tap opens them again.
class _OtherSetsRow extends ConsumerWidget {
  const _OtherSetsRow({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    return MmPressable(
      semanticsLabel: '${ChoicesCopy.otherSets}, $count',
      pressedScale: 0.97,
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => AnimatedContainer(
        duration: Motion.of(context, const Duration(milliseconds: 120)),
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
        decoration: BoxDecoration(color: pressed ? colors.raised : Colors.transparent, borderRadius: BorderRadius.circular(MmRadius.key)),
        child: Row(
          children: [
            Expanded(
              child: Text(
                ChoicesCopy.otherSets,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.mmType.body.copyWith(color: colors.ink2, fontWeight: FontWeight.w600),
              ),
            ),
            Text('$count', style: context.mmType.small.copyWith(color: colors.ink3)),
            const SizedBox(width: MmSpace.s8),
            Icon(LucideIcons.chevronDown, size: 18, color: colors.ink3),
          ],
        ),
      ),
    );
  }
}

/// "Add a subject": a dashed bubble, the line, and how many MockMob offers.
class _AddRow extends ConsumerWidget {
  const _AddRow({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: OnboardingCopy.addSubject,
      pressedScale: 0.98,
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? colors.raised : Colors.transparent,
          shape: mmShapeBorder(MmRadius.keyAll, side: BorderSide(color: colors.lineStrong)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          // Vertical room too: a note that wraps (a large text size) grows the card instead of sitting on its border.
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s8),
            child: Row(
              children: [
                SizedBox.square(
                  dimension: 40,
                  child: Center(child: Icon(LucideIcons.plus, size: 20, color: colors.ink)),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(OnboardingCopy.addSubject, style: type.body.copyWith(fontWeight: FontWeight.w600)),
                      Text(OnboardingCopy.addSubjectNote, style: type.caption.copyWith(color: colors.ink3)),
                    ],
                  ),
                ),
                Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A one-line note with its glyph, read out when it changes.
class _Note extends StatelessWidget {
  const _Note({required this.text, required this.icon, required this.color});

  final String text;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s4),
      child: Semantics(
        liveRegion: true,
        container: true,
        label: text,
        excludeSemantics: true,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Icon(icon, size: 16, color: color),
            ),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: Text(text, style: context.mmType.small.copyWith(color: context.mmColors.ink)),
            ),
          ],
        ),
      ),
    );
  }
}
