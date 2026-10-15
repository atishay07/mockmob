// `/today/alternatives`: "Choose something else" (spec 5.3). The plan's own alternatives first,
// then the usual ways to practise, then Review. "Not today" hides only tonight's repair until
// 4:00 AM or the next submitted paper; nothing in Review or the record changes. Costs are not
// shown here: they live on the confirm sheet (brief section 8).
//
// Design critic 16 Oct, finding 17: the sheet speaks the Start sheet's language (its deck, its
// lit objects and their gestures, its title cut) instead of four flat grey tiles, so the two
// sheets for the same job read as one. Quick practice leads, Full mock and One chapter pair up,
// Review runs as a list row, and "Not today" is a full 48 dp key with its line under it.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/action_router.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../practice/widgets/choice_deck.dart' show ChoiceDeck, ChoiceOption, ChoiceRow;
import '../../practice/widgets/choice_glyphs.dart' show ChoiceGlyphKind;
import '../copy.dart';
import '../data/today_providers.dart';
import '../logic/links.dart';
import '../../../core/domain/repair_candidates.dart' show repairDurationOptions;
import '../logic/move_builder.dart';

/// The role a way to practise plays in the deck: the lead, one of the pair, or a list row.
enum AlternativeRole { plan, lead, pair, row }

class AlternativeRow {
  const AlternativeRow({required this.title, required this.note, required this.location, required this.glyph, required this.role});

  final String title;
  final String note;
  final String location;

  /// The Start sheet's drawn object for this kind of session.
  final ChoiceGlyphKind glyph;
  final AlternativeRole role;
}

/// The rows for [subject] (public or internal id), with the plan's native alternatives first.
List<AlternativeRow> alternativeRows({String? subject, List<({String title, String? note, String? href})> plan = const []}) {
  return [
    for (final a in plan.take(2))
      if (ActionRouter.resolve(a.href) case NativeTarget(:final location))
        AlternativeRow(title: a.title, note: a.note ?? '', location: location, glyph: ChoiceGlyphKind.smart, role: AlternativeRole.plan),
    AlternativeRow(title: TodayCopy.altQuick, note: TodayCopy.altQuickLine, location: TodayLinks.quick(subject: subject), glyph: ChoiceGlyphKind.quick, role: AlternativeRole.lead),
    AlternativeRow(title: TodayCopy.altFullMock, note: TodayCopy.altFullMockLine, location: TodayLinks.fullMock(subject: subject), glyph: ChoiceGlyphKind.mock, role: AlternativeRole.pair),
    AlternativeRow(title: TodayCopy.altChapter, note: TodayCopy.altChapterLine, location: AppRoutes.practiceSetup('chapter'), glyph: ChoiceGlyphKind.chapter, role: AlternativeRole.pair),
    const AlternativeRow(title: TodayCopy.altReview, note: TodayCopy.altReviewLine, location: AppRoutes.review, glyph: ChoiceGlyphKind.repair, role: AlternativeRole.row),
  ];
}

/// The deck's rows for [rows]: plan rows and the review row as list rows, the lead as the lit
/// hero, and the pair side by side (a lone one of a pair runs as a list row).
List<ChoiceRow> alternativeDeck(List<AlternativeRow> rows, ValueChanged<AlternativeRow> onRow) {
  ChoiceOption option(AlternativeRow r) => ChoiceOption(id: r.title, glyph: r.glyph, title: r.title, note: r.note, onTap: () => onRow(r));
  final pair = [for (final r in rows) if (r.role == AlternativeRole.pair) r];
  return [
    for (final r in rows)
      if (r.role == AlternativeRole.plan) ChoiceRow.wide(option(r)),
    for (final r in rows)
      if (r.role == AlternativeRole.lead) ChoiceRow.lead(option(r)),
    if (pair.length >= 2) ChoiceRow.pair(option(pair[0]), option(pair[1])) else for (final r in pair) ChoiceRow.wide(option(r)),
    for (final r in pair.skip(2)) ChoiceRow.wide(option(r)),
    for (final r in rows)
      if (r.role == AlternativeRole.row) ChoiceRow.wide(option(r)),
  ];
}

class AlternativesSheet extends ConsumerWidget {
  const AlternativesSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inputs = ref.watch(todayInputsProvider);
    final facts = MoveFacts(inputs);
    final basis = facts.basis;
    final canDismiss = basis != null && facts.candidates.isNotEmpty && !facts.dismissed;
    final plan = inputs.plan;
    final rows = alternativeRows(
      subject: basis?.subject ?? (inputs.subjects.isEmpty ? null : inputs.subjects.first),
      plan: [for (final a in plan?.alternatives ?? const []) (title: a.title, note: a.duration, href: a.href)],
    );
    final durations = facts.tonight == null || facts.dismissed ? const <int>[] : [for (final o in repairDurationOptions(facts.tonight!.items.length)) o.minutes];
    return AlternativesSheetBody(
      durations: durations,
      // The same pick the Today card makes, so the sheet never highlights another length.
      minutes: repairMinutesSelected(inputs, facts),
      onMinutes: (m) => ref.read(todayMinutesProvider.notifier).choose(m),
      rows: rows,
      onRow: (row) {
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
    this.durations = const [],
    this.minutes,
    this.onMinutes,
    this.animateIn = true,
  });

  final List<AlternativeRow> rows;

  /// The lengths tonight's repair can take ("5 min", "10 min"), when it can change size.
  final List<int> durations;
  final int? minutes;
  final ValueChanged<int>? onMinutes;
  final ValueChanged<AlternativeRow> onRow;
  final VoidCallback? onNotToday;

  /// Whether the deck's rows rise in one after another (off for goldens).
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
          // The Start sheet's title cut, so the two sheets for one job read as one.
          Semantics(
            header: true,
            child: Text(TodayCopy.alternativesTitle, style: type.screenTitle.copyWith(fontSize: 24), maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(height: MmSpace.s16),
          if (durations.length > 1 && minutes != null) ...[
            Text(TodayCopy.repairLength, style: type.labelLarge),
            const SizedBox(height: MmSpace.s8),
            MmSegmented<int>(
              semanticsLabel: TodayCopy.repairLength,
              segments: [for (final d in durations) MmSegment(d, '$d min')],
              value: minutes!,
              onChanged: onMinutes,
            ),
            const SizedBox(height: MmSpace.s20),
          ],
          ChoiceDeck(rows: alternativeDeck(rows, onRow), onSheet: true, animateIn: animateIn),
          if (onNotToday != null) ...[
            const SizedBox(height: MmSpace.s16),
            Divider(height: 1, thickness: 1, color: colors.line),
            const SizedBox(height: MmSpace.s12),
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
