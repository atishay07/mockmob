import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode;
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
  });

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
  final GlobalKey _weekKey = GlobalKey();
  Timer? _later;
  bool _read = false;
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
    final reading = readWeek(week: widget.week, now: _now(), mode: widget.celebrations);
    if (reading != null) {
      _read = true;
      _entrance = _consume(reading);
    }
  }

  @override
  void didUpdateWidget(SheetCard old) {
    super.didUpdateWidget(old);
    if (_read) return;
    final reading = readWeek(week: widget.week, now: _now(), mode: widget.celebrations);
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
    // A goal the server has counted as met keeps a proud face all week (a calm one under Off),
    // whether or not today's act is spent: the face is a state, the act is a moment.
    _mobi.setMood(reading.gate == HubMobiGate.met && widget.celebrations != CelebrationMode.off ? MobiMood.proud : MobiMood.calm);
    switch (reading.gate) {
      case HubMobiGate.met:
        if (!MobiRation.helloToday('you:week')) return MobiAct.idle;
      case HubMobiGate.nudge:
        if (!MobiRation.nudgeToday('you')) return MobiAct.idle;
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
    final missingTarget = target.course == null && target.colleges.isEmpty;
    const fieldInset = EdgeInsets.symmetric(horizontal: youText);

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
                      Semantics(header: true, child: Text(title, style: type.display, maxLines: 3, overflow: TextOverflow.ellipsis)),
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
              YouMobi(size: 120, controller: _mobi, entrance: _entrance, follow: true),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        KeyedSubtree(key: _weekKey, child: WeekField(week: week, onOpen: widget.onOpenRhythm)),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (target.course != null)
              Padding(
                padding: fieldInset,
                child: SheetField(label: YouCopy.fieldCourse, child: Text(target.course!, style: type.title)),
              ),
            if (target.colleges.isNotEmpty)
              Padding(
                padding: fieldInset,
                child: SheetField(label: YouCopy.fieldColleges, child: CollegeList(colleges: target.colleges)),
              ),
            if (subjects.isNotEmpty)
              SubjectsField(subjects: subjects, onEdit: onEditSubjects),
            if (missingTarget && onEdit != null) Padding(padding: fieldInset, child: _FinishPrompt(onTap: onEdit)),
          ],
        ),
      ],
    );
  }
}

/// Shown when the sheet has no course or colleges yet: one line and the one volt key that fills
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
