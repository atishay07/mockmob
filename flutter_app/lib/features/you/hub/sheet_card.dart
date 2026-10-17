import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode;
import '../../tools/data/my_colleges_actions.dart' show myCollegesProvider;
import '../../tools/my_colleges/my_colleges_parts.dart' show MyCollegesFieldList, myCollegesHaveAny;
import '../copy.dart';
import '../data/student_target.dart';
import '../widgets/you_motion.dart';
import '../widgets/you_page.dart' show youText;
import 'hub_mobi.dart';
import 'sheet_fields.dart';

/// The student's sheet for the season (brief section 12, You): the identity at the top of You.
///
/// It is a hero, not a card. Mobi waves at the top right in the lamp light, the name stands at
/// display size on the ground, and under it this week stands on the ground in the lamp light. The
/// course, colleges and subjects follow as ruled fields like the header boxes of an answer
/// sheet: hairlines, no outer card, no box inside a box. It prints only what is known; a field
/// with nothing in it is left off, and the sheet says what is missing with one way to fill it.
/// The Edit key lives in the page's top row; the subjects field opens the subjects editor.
class SheetCard extends StatefulWidget {
  const SheetCard({
    super.key,
    required this.name,
    required this.email,
    required this.target,
    required this.subjects,
    required this.week,
    required this.onOpenRhythm,
    this.onEdit,
    this.onEditSubjects,
    this.celebrations = CelebrationMode.full,
    this.now,
    this.showTarget = true,
    this.onEditName,
    this.showWeek = true,
    this.weekKey,
    this.landedBadge,
  });

  /// The name of a badge that landed since the last visit: Mobi reads it once, ahead of the week.
  final String? landedBadge;

  /// False leaves the week field off: the hub shows it inside its one Study block (critic 16 Oct,
  /// finding 27), so the ring is not drawn twice on one screen.
  final bool showWeek;

  /// The key of the week field when it stands somewhere else (the hub's Study block), so Mobi can
  /// still point at it while it is on screen. Null uses this card's own key.
  final GlobalKey? weekKey;

  /// Opens the name editor. The name stands as a key (a small pencil follows it) when this is set.
  final VoidCallback? onEditName;

  /// The course, colleges and subjects fields under the week. The hub shows them in their own
  /// section ([TargetFields]) and turns this off.
  final bool showTarget;

  /// The Celebrations setting: Quiet swaps Mobi's proud for a nod, Off plays nothing.
  final CelebrationMode celebrations;

  /// The clock for Mobi's late-night rule (0 to 4 AM he is sleepy). Null reads the ration's clock.
  final DateTime Function()? now;

  final String? name;
  final String? email;
  final StudentTarget target;

  /// Public subject ids from the profile.
  final List<String> subjects;

  /// The rhythm field's state.
  final SheetWeek week;
  final VoidCallback onOpenRhythm;

  /// Opens the sheet editor. Used by the finish prompt; the page's top row carries the Edit key.
  final VoidCallback? onEdit;

  /// Opens the subjects editor.
  final VoidCallback? onEditSubjects;

  @override
  State<SheetCard> createState() => _SheetCardState();
}

class _SheetCardState extends State<SheetCard> {
  final MobiController _mobi = MobiController();
  final GlobalKey _ownWeekKey = GlobalKey();
  GlobalKey get _weekKey => widget.weekKey ?? _ownWeekKey;
  Timer? _later;
  bool _read = false;
  bool _badgeRead = false;
  MobiAct _entrance = MobiAct.idle;

  /// The nudge is waiting for the student to be still: a touch or a scroll anywhere restarts its
  /// [MobiRation.nudgeAfter] wait.
  bool _nudging = false;
  bool _routed = false;

  DateTime _now() => (widget.now ?? MobiRation.now)();

  @override
  void initState() {
    super.initState();
    // Mobi reads the real week once, the first time it is known. A week still loading leaves him
    // idle; the reading plays when it lands.
    final reading = readWeek(week: widget.week, now: _now(), mode: widget.celebrations, landedBadge: widget.landedBadge);
    if (reading != null) {
      _read = true;
      _entrance = _consume(reading);
    }
  }

  @override
  void didUpdateWidget(SheetCard old) {
    super.didUpdateWidget(old);
    // A badge that lands after the first reading is the moment of the visit: he reads it once.
    if (!_badgeRead && widget.landedBadge != null && old.landedBadge == null) {
      final badge = readWeek(week: widget.week, now: _now(), mode: widget.celebrations, landedBadge: widget.landedBadge);
      if (badge != null && badge.gate == HubMobiGate.badge) {
        _badgeRead = true;
        _read = true;
        _mobi.react(_consume(badge));
        return;
      }
    }
    if (_read) return;
    final reading = readWeek(week: widget.week, now: _now(), mode: widget.celebrations, landedBadge: widget.landedBadge);
    if (reading == null) return;
    _read = true;
    _mobi.react(_consume(reading));
  }

  @override
  void dispose() {
    _later?.cancel();
    if (_routed) GestureBinding.instance.pointerRouter.removeGlobalRoute(_onPointer);
    _mobi.dispose();
    super.dispose();
  }

  void _onPointer(PointerEvent event) {
    if (!_nudging) return;
    if (event is PointerDownEvent || event is PointerMoveEvent || event is PointerScrollEvent) _armNudge();
  }

  /// (Re)starts the wait; when it runs out with no touch, Mobi points at the Rhythm field.
  void _armNudge() {
    if (!_routed) {
      GestureBinding.instance.pointerRouter.addGlobalRoute(_onPointer);
      _routed = true;
    }
    _nudging = true;
    _later?.cancel();
    _later = Timer(MobiRation.nudgeAfter, _pointAtWeek);
  }

  void _pointAtWeek() {
    _nudging = false;
    if (!mounted) return;
    // Only while the field is on screen: pointing at a place the student has scrolled away from
    // would be pointing at nothing.
    final box = _weekKey.currentContext?.findRenderObject();
    final screen = MediaQuery.maybeSizeOf(context);
    if (box is! RenderBox || !box.attached || !box.hasSize || screen == null) return;
    final top = box.localToGlobal(Offset.zero).dy;
    if (top < 0 || top + box.size.height > screen.height) return;
    _mobi.pointAtWidget(_weekKey);
    _mobi.react(MobiMoments.act(MobiEvent.showAction));
  }

  /// Spends the reading's once-a-day gate and schedules its words or its point. Returns the act
  /// to play now. A reading whose gate is already spent today is just a still Mobi.
  MobiAct _consume(HubMobiReading reading) {
    // The week is not on this card (it stands lower down, in the Study block): a point at it would
    // aim at nothing, so the nudge waits, unspent, for a card that has the field.
    if (!widget.showWeek && reading.gate == HubMobiGate.nudge) return MobiAct.idle;
    // A goal the server has counted as met keeps a proud face all week (a calm one under Off),
    // whether or not today's act is spent: the face is a state, the act is a moment.
    _mobi.setMood((reading.gate == HubMobiGate.met || reading.gate == HubMobiGate.badge) && widget.celebrations != CelebrationMode.off ? MobiMood.proud : MobiMood.calm);
    switch (reading.gate) {
      case HubMobiGate.met:
        if (!MobiRation.helloToday('you:week')) return MobiAct.idle;
      case HubMobiGate.nudge:
        if (!MobiRation.nudgeToday('you')) return MobiAct.idle;
      case HubMobiGate.badge:
        if (!MobiRation.helloToday('you:badge')) return MobiAct.idle;
      case HubMobiGate.none:
        // A plain hello is the first open of the day only.
        if (reading.act == MobiAct.hello) return MobiRation.helloToday('you') ? MobiAct.hello : MobiAct.idle;
    }
    final line = reading.line;
    if (line != null) {
      // The words come after the act has landed: he never speaks over his own moment.
      final wait = widget.celebrations == CelebrationMode.off ? Duration.zero : Duration(milliseconds: (MobiMoves.duration(reading.act) * 1000).round());
      _later?.cancel();
      _later = Timer(wait, () {
        if (mounted) _mobi.sayOnce('you:week', line, live: true);
      });
    }
    if (reading.pointAtWeek) {
      // After 4 s with no touch and no scroll, once a day: he points at the Rhythm field.
      _armNudge();
      return MobiAct.idle;
    }
    return reading.act;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final name = widget.name;
    final email = widget.email;
    final target = widget.target;
    final subjects = widget.subjects;
    final week = widget.week;
    final onEdit = widget.onEdit;
    final onEditSubjects = widget.onEditSubjects;
    final trimmed = name?.trim();
    final title = trimmed == null || trimmed.isEmpty ? YouCopy.sheetNameFallback : trimmed;
    final year = target.stage?.cuetYear ?? 2027;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(youText, 0, MmSpace.s12, 0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: MmSpace.s8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(YouCopy.sheetOverlineFor(year), style: type.caption.copyWith(color: colors.ink2)),
                      const SizedBox(height: MmSpace.s8),
                      _NameLine(title: title, style: type.display, onEdit: widget.onEditName),
                      if (target.stage != null) ...[
                        const SizedBox(height: MmSpace.s8),
                        Text(target.stage!.sheetLine, style: type.small.copyWith(color: colors.ink2)),
                      ],
                      if (email != null) ...[
                        const SizedBox(height: MmSpace.s4),
                        Text(email, style: type.caption.copyWith(color: colors.ink3), maxLines: 2, overflow: TextOverflow.ellipsis),
                      ],
                      // Mobi's one factual line about the week (a met goal), typed in after he has
                      // played his act. Plain text on the ground: no box, never over anything.
                      ValueListenableBuilder<MobiSpeech?>(
                        valueListenable: _mobi.speech,
                        builder: (context, speech, _) => speech == null
                            ? const SizedBox.shrink()
                            : Padding(
                                padding: const EdgeInsets.only(top: MmSpace.s8),
                                child: MobiBubble(key: ValueKey(speech.id), speech: speech, boxed: false, maxWidth: 240),
                              ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: MmSpace.s8),
              // Mobi reads the week once a day (proud for a met goal, a nudge toward the Rhythm
              // field one day short, sleepy from midnight to 5 AM), then he is simply there:
              // he breathes and blinks, and each tap plays the next small act.
              YouMobi(size: 72, controller: _mobi, entrance: _entrance, follow: true),
            ],
          ),
        ),
        if (widget.showWeek) ...[
          const SizedBox(height: MmSpace.s16),
          KeyedSubtree(key: _weekKey, child: WeekField(week: week, onOpen: widget.onOpenRhythm)),
        ],
        if (widget.showTarget)
          TargetFields(target: target, subjects: subjects, onEdit: onEdit, onEditSubjects: onEditSubjects),
      ],
    );
  }
}

/// The name at display size. With [onEdit] it is a key: a pencil follows the words and a tap
/// opens the name editor.
class _NameLine extends StatelessWidget {
  const _NameLine({required this.title, required this.style, this.onEdit});

  final String title;
  final TextStyle style;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final text = Text(title, style: style, maxLines: 3, overflow: TextOverflow.ellipsis);
    if (onEdit == null) return Semantics(header: true, child: text);
    // The pencil sits at the end of the first line, on the name's own baseline row.
    final named = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Flexible(child: text),
        const SizedBox(width: MmSpace.s8),
        Padding(padding: const EdgeInsets.only(top: MmSpace.s8), child: Icon(LucideIcons.pencilLine, size: 18, color: colors.ink3)),
      ],
    );
    return MmPressable(
      onTap: onEdit,
      haptic: MmPressHaptic.selection,
      pressedScale: 0.99,
      focusRadius: MmRadius.smallAll,
      semanticsLabel: '${YouCopy.editName}. $title',
      builder: (context, pressed, focused) => ConstrainedBox(constraints: const BoxConstraints(minHeight: 48), child: Align(alignment: Alignment.centerLeft, child: named)),
    );
  }
}

/// The course, the colleges in order and the subjects: ruled fields like the header boxes of an
/// answer sheet. Each field opens its editor (the course and colleges in the plan editor, the
/// subjects in the subjects editor). A field with nothing in it is left off, and a plan with no
/// course or colleges says so with the one key that fills them in.
class TargetFields extends ConsumerWidget {
  const TargetFields({super.key, required this.target, required this.subjects, this.onEdit, this.onEditSubjects, this.ruledTop = true});

  /// False leaves the hairline off above the first field (a section title already stands above it).
  final bool ruledTop;

  final StudentTarget target;
  final List<String> subjects;
  final VoidCallback? onEdit;
  final VoidCallback? onEditSubjects;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    // The colleges are My colleges (one list, saved to your account): the colleges named in the setup
    // stand in until it is known.
    final hasColleges = myCollegesHaveAny(ref.watch(myCollegesProvider), target.colleges);
    final missingTarget = target.course == null && !hasColleges;
    const fieldInset = EdgeInsets.symmetric(horizontal: youText);
    final hasCourse = target.course != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (hasCourse)
          Padding(
            padding: fieldInset,
            child: _Tappable(
              onTap: onEdit,
              child: SheetField(
                first: !ruledTop,
                label: YouCopy.fieldCourse,
                trailing: onEdit == null ? null : const _EditHint(),
                child: Text(target.course!, style: type.title),
              ),
            ),
          ),
        if (hasColleges)
          Padding(
            padding: fieldInset,
            child: _Tappable(
              onTap: onEdit,
              child: SheetField(
                first: !ruledTop && !hasCourse,
                label: YouCopy.fieldColleges,
                trailing: onEdit == null ? null : const _EditHint(),
                child: MyCollegesFieldList(fallback: CollegeList(colleges: target.colleges)),
              ),
            ),
          ),
        if (subjects.isNotEmpty) SubjectsField(subjects: subjects, onEdit: onEditSubjects, first: !ruledTop && !hasCourse && !hasColleges),
        if (missingTarget && onEdit != null) Padding(padding: fieldInset, child: _FinishPrompt(onTap: onEdit!)),
      ],
    );
  }
}

/// "Edit" and a chevron at the end of a field's label line.
class _EditHint extends StatelessWidget {
  const _EditHint();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(YouCopy.editSubjects, style: context.mmType.labelLarge.copyWith(fontSize: 14)),
        const SizedBox(width: MmSpace.s4),
        Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
      ],
    );
  }
}

/// A whole field as one pressable (a 48 dp or taller target) that sinks a touch and ticks.
class _Tappable extends StatelessWidget {
  const _Tappable({required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    if (onTap == null) return child;
    return MmPressable(
      onTap: onTap,
      haptic: MmPressHaptic.selection,
      highlight: true,
      pressedScale: 0.99,
      focusRadius: BorderRadius.circular(MmRhythm.plainRadius),
      excludeSemantics: false,
      builder: (context, pressed, focused) => child,
    );
  }
}

/// Shown when the plan has no course or colleges yet: one line and the one volt key that fills
/// them in. Mobi is already waving in the header, so he is not drawn twice.
class _FinishPrompt extends StatelessWidget {
  const _FinishPrompt({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: const EdgeInsets.only(top: MmSpace.s20, bottom: MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(YouCopy.finishSheet, style: context.mmType.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            KeyButton(label: YouCopy.finishSheetKey, onPressed: onTap),
          ],
        ),
      ),
    );
  }
}
