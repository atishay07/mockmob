// `/today/alternatives`: "Something else instead" (TODAY-1017 4.2 and 11.3). A short plain list of
// real alternatives to tonight's move, each with its own object, a reason from the student's
// record and a unit ("Repair 2 mistakes" / "From Mock 1 on 15 Oct, in Partnership fundamentals.
// About 10 min."). Whatever the move already is never appears again here.
//
// Device walk 17 Oct and the visual critic: the sheet used to carry a full copy of the Start
// sheet (a lit Quick practice card with a volt play key, then Full mock and One chapter tiles)
// under two server rows with the same target glyph and a bare "10". That made it a third Start
// surface. The Start key already opens Start; this sheet is three or four rows and Not today.
// Costs are not shown here: they live on the confirm sheet (brief section 8).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/repair_candidates.dart' show repairDurationOptions, repairMinutes;
import '../../../core/models/attempt.dart';
import '../../../core/models/learning_plan.dart' show PlanAction;
import '../../../core/router/action_router.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../practice/model/practice_selection.dart' show mockQuestionCount;
import '../../practice/widgets/choice_deck.dart' show ChoiceDeck, ChoiceOption, ChoiceRow;
import '../../practice/widgets/choice_glyphs.dart' show ChoiceGlyphKind;
import '../../pro_nudge/pro_nudge.dart' show ProReason, showUpgradeSheetIfOn;
import '../../review/revise/revise_data.dart' show reviseCapProvider, reviseEntryProvider;
import '../../runner/runner_routes.dart' show NtaRoutes;
import '../copy.dart';
import '../data/today_providers.dart';
import '../logic/links.dart';
import '../logic/move_builder.dart';
import '../logic/subjects.dart';
import '../logic/today_inputs.dart';
import '../logic/today_model.dart';

/// What a row is, so no two rows of the sheet are the same kind of session.
enum AlternativeKind { repair, revise, practice, mock, nta, plan, review }

class AlternativeRow {
  const AlternativeRow({required this.title, required this.note, required this.location, required this.glyph, required this.kind});

  final String title;

  /// The reason and the unit: where it comes from and how long it takes.
  final String note;
  final String location;

  /// The Start sheet's drawn object for this kind of session: each row has its own.
  final ChoiceGlyphKind glyph;
  final AlternativeKind kind;
}

/// Today's Revise round, as the sheet needs it: the round's size at the student's cap and how many
/// are due in all.
typedef ReviseRound = ({int size, int due});

/// The most rows before Review (which always ends the list): four, so NTA mode has a place (F18).
const int _maxRows = 4;

/// The rows for the student's record, leaving out whatever [moveKind] already is. Pure, so tests
/// feed it fixtures.
List<AlternativeRow> alternativeRows(
  TodayInputs inputs, {
  MoveKind? moveKind,
  String? moveSubject,
  ReviseRound? revise,
  List<PlanAction> plan = const [],
}) {
  final facts = MoveFacts(inputs);
  final attempts = facts.attempts;
  final rows = <AlternativeRow>[];
  final basis = facts.basis;
  final subject = canonicalSubject(moveSubject ?? basis?.subject ?? (attempts.isNotEmpty ? attempts.first.subject : (inputs.subjects.isEmpty ? '' : inputs.subjects.first)));

  // 1. Tonight's repair, when it is not already the move.
  final tonight = facts.tonight;
  final repairIsMove = moveKind == MoveKind.repair || moveKind == MoveKind.firstRepair || moveKind == MoveKind.returning;
  if (!repairIsMove && basis != null && tonight != null && !facts.dismissed && tonight.items.isNotEmpty) {
    final options = repairDurationOptions(tonight.items.length);
    final chosen = repairMinutesSelected(inputs, facts);
    final option = options.where((o) => o.minutes == chosen).firstOrNull ?? options.firstOrNull;
    final n = option?.mistakes ?? tonight.items.length;
    final minutes = option?.minutes ?? repairMinutes(n) ?? 10;
    rows.add(AlternativeRow(
      title: TodayCopy.altRepairTitle(n),
      note: TodayCopy.altRepairNote(
        TodayCopy.revisePaper(paperLabel(attempts, basis), inputs.date(basis.completedAt)),
        tonight.hasNamedChapter ? tonight.chapter : null,
        minutes,
      ),
      location: TodayLinks.repair(basis.id, tonight.items.first.questionId, n),
      glyph: ChoiceGlyphKind.repair,
      kind: AlternativeKind.repair,
    ));
  }

  // 2. Today's Revise round, when it has questions and is not already the move.
  if (moveKind != MoveKind.revise && revise != null && revise.size > 0) {
    final minutes = revise.size <= 5 ? 5 : 10;
    rows.add(AlternativeRow(
      title: TodayCopy.altReviseTitle(revise.size),
      note: TodayCopy.altReviseNote(revise.size, revise.due, minutes),
      location: TodayLinks.revise,
      glyph: ChoiceGlyphKind.smart,
      kind: AlternativeKind.revise,
    ));
  }

  // 3. Practise the subject left longest (never practised first); with one subject, that subject.
  final subjects = <String>[for (final s in inputs.subjects) canonicalSubject(s)];
  for (final a in attempts) {
    final s = canonicalSubject(a.subject);
    if (!subjects.contains(s)) subjects.add(s);
  }
  final others = [for (final s in subjects) if (s != subject && s.isNotEmpty) s];
  DateTime? lastOf(String s) => attempts.where((a) => canonicalSubject(a.subject) == s).firstOrNull?.completedAt;
  String? practise;
  if (others.isNotEmpty) {
    others.sort((a, b) {
      final la = lastOf(a);
      final lb = lastOf(b);
      if (la == null && lb == null) return 0;
      if (la == null) return -1;
      if (lb == null) return 1;
      return la.compareTo(lb);
    });
    practise = others.first;
  } else if (subject.isNotEmpty) {
    practise = subject;
  }
  if (practise != null) {
    final last = lastOf(practise);
    rows.add(AlternativeRow(
      title: TodayCopy.altPractiseTitle(subjectName(practise)),
      note: TodayCopy.altPractiseNote(10, last == null ? null : inputs.daysSince(last)),
      location: TodayLinks.quick(subject: practise),
      glyph: ChoiceGlyphKind.quick,
      kind: AlternativeKind.practice,
    ));
  }

  // 4. A full mock in the move's subject, unless the move is the first full mock.
  if (moveKind != MoveKind.firstMock && subject.isNotEmpty) {
    Attempt? lastMock;
    for (final a in attempts) {
      if (a.isMock && canonicalSubject(a.subject) == subject) {
        lastMock = a;
        break;
      }
    }
    rows.add(AlternativeRow(
      title: TodayCopy.altMockTitle(subjectName(subject)),
      note: TodayCopy.altMockNote(
        mockQuestionCount,
        60,
        lastMock == null ? null : TodayCopy.revisePaper(paperLabel(attempts, lastMock), inputs.date(lastMock.completedAt)),
      ),
      location: TodayLinks.fullMock(subject: subject),
      glyph: ChoiceGlyphKind.mock,
      kind: AlternativeKind.mock,
    ));
    // 5. NTA mode, once a full mock in this subject is on record: the next one on the exam-day
    // screen (FEATURE-ADOPTION FA-8, taught at the moment it is a real next step).
    if (lastMock != null) {
      rows.add(AlternativeRow(
        title: TodayCopy.altNtaTitle(subjectName(subject)),
        note: TodayCopy.altNtaNote(mockQuestionCount, 60, pro: inputs.isPro),
        location: NtaRoutes.location(subject),
        glyph: ChoiceGlyphKind.nta,
        kind: AlternativeKind.nta,
      ));
    }
  }

  // The server's own alternatives fill a free place, when this app can open them and they are a
  // kind of session the list does not have yet.
  final taken = {for (final r in rows) r.kind};
  for (final a in plan) {
    if (rows.length >= _maxRows) break;
    final kind = switch (a.kind) {
      'repair' || 'investigate' => AlternativeKind.repair,
      'ordinary_practice' || 'baseline' || 'fresh_check' => AlternativeKind.practice,
      _ => AlternativeKind.plan,
    };
    if (taken.contains(kind) || a.title.trim().isEmpty) continue;
    if (ActionRouter.resolve(a.href) case NativeTarget(:final location)) {
      rows.add(AlternativeRow(
        title: a.title,
        note: TodayCopy.altPlanNote(a.reason, a.duration),
        location: location,
        glyph: ChoiceGlyphKind.resume,
        kind: kind,
      ));
      taken.add(kind);
    }
  }

  return [
    ...rows.take(_maxRows),
    const AlternativeRow(title: TodayCopy.altReview, note: TodayCopy.altReviewLine, location: AppRoutes.review, glyph: ChoiceGlyphKind.chapter, kind: AlternativeKind.review),
  ];
}

/// The sheet's rows as plain list rows: the object at the left, the reason under the title, a rule
/// under each. No lit card, no go disc: nothing here competes with the move's key.
List<ChoiceRow> alternativeDeck(List<AlternativeRow> rows, ValueChanged<AlternativeRow> onRow) => [
      for (final r in rows)
        ChoiceRow.wide(ChoiceOption(id: r.title, glyph: r.glyph, title: r.title, note: r.note, noteLines: 2, onTap: () => onRow(r))),
    ];

class AlternativesSheet extends ConsumerWidget {
  const AlternativesSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inputs = ref.watch(todayInputsProvider);
    final facts = MoveFacts(inputs);
    final canDismiss = facts.basis != null && facts.candidates.isNotEmpty && !facts.dismissed;
    final hero = ref.watch(todayViewProvider).hero;
    final move = hero is MoveHero ? hero : null;
    final read = ref.watch(reviseEntryProvider).value;
    final cap = ref.watch(reviseCapProvider).value ?? 10;
    ReviseRound? revise;
    if (read != null && !read.isUnavailable && !read.isEmpty && read.due > 0) {
      final left = read.shown > 0 ? read.shown : read.due;
      revise = (size: left < cap ? left : cap, due: read.due);
    }
    final rows = alternativeRows(
      inputs,
      moveKind: move?.kind,
      moveSubject: move?.subjectId,
      revise: revise,
      plan: inputs.plan?.alternatives ?? const [],
    );
    return AlternativesSheetBody(
      rows: rows,
      onRow: (row) {
        // NTA mode comes with Pro: a Free student meets the Upgrade sheet (PLAY_BILLING on); otherwise as before.
        if (row.kind == AlternativeKind.nta && !inputs.isPro && showUpgradeSheetIfOn(context, reason: ProReason.ntaMode)) return;
        final router = GoRouter.of(context);
        Navigator.of(context).maybePop();
        if (AppRoutes.tabRoots.contains(row.location)) {
          router.go(row.location);
        } else {
          unawaited(router.push(row.location));
        }
      },
      onNotToday: canDismiss
          ? () async {
              await ref.read(todayActionsProvider).notToday();
              if (context.mounted) await Navigator.of(context).maybePop();
            }
          : null,
    );
  }
}

class AlternativesSheetBody extends StatelessWidget {
  const AlternativesSheetBody({
    super.key,
    required this.rows,
    required this.onRow,
    this.onNotToday,
    this.animateIn = true,
  });

  final List<AlternativeRow> rows;
  final ValueChanged<AlternativeRow> onRow;
  final VoidCallback? onNotToday;

  /// Whether the rows rise in one after another (off for goldens).
  final bool animateIn;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.sheetSide, MmSpace.s4, MmSpace.sheetSide, MmSpace.s20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(TodayCopy.alternativesTitle, style: type.screenTitle.copyWith(fontSize: 24), maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(height: MmSpace.s8),
          ChoiceDeck(rows: alternativeDeck(rows, onRow), onSheet: true, animateIn: animateIn),
          if (onNotToday != null) ...[
            const SizedBox(height: MmSpace.s16),
            // A real key, 48 dp tall, with what it does on the line under it.
            KeyButton.secondary(label: TodayCopy.notToday, onPressed: onNotToday, minHeight: MmTarget.min),
            const SizedBox(height: MmSpace.s8),
            Text(TodayCopy.notTodayNote, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink2)),
          ],
        ],
      ),
    );
  }
}
