import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../compass/compass_controller.dart';
import '../copy.dart';
import '../data/du_repository.dart';
import '../data/my_colleges_actions.dart';
import '../data/tools_store.dart';
import '../domain/du_eligibility.dart';
import '../domain/du_helpers.dart';
import '../domain/du_models.dart';
import '../my_colleges/my_colleges_body.dart';
import '../widgets/tools_card.dart';
import '../widgets/tools_page.dart';
import 'compass_pro_models.dart';
import 'compass_pro_repository.dart';

/// The Pro half of Compass: the practice projection (each paper out of 250, with its range), the
/// one paper to work on, and a shortlist of DU colleges set against the projected range. It
/// appears only for an account the server lets read it. For anyone else it is not on the screen
/// at all: no lock, no pitch.
class CompassProSection extends ConsumerStatefulWidget {
  const CompassProSection({super.key, required this.state});

  final CompassState state;

  @override
  ConsumerState<CompassProSection> createState() => _CompassProSectionState();
}

class _CompassProSectionState extends ConsumerState<CompassProSection> {
  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    if (!ref.read(compassProAccessProvider)) return;
    scheduleMicrotask(() {
      if (mounted) unawaited(ref.read(compassProRepositoryProvider.notifier).refresh());
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<bool>(compassProAccessProvider, (previous, next) {
      if (next && previous != true) _load();
    });
    if (!ref.watch(compassProAccessProvider)) return const SizedBox.shrink();
    final remote = ref.watch(compassProRepositoryProvider);
    final pro = remote.value;
    if (pro == null) {
      if (remote.error != null) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmRhythm.section, MmSpace.gutter, 0),
          child: InlineBanner(
            tone: remote.error!.isOffline ? BannerTone.offline : BannerTone.error,
            message: remote.error!.isOffline ? ToolsCopy.offlineBody : ToolsCopy.proUnavailable,
            actionLabel: ToolsCopy.tryAgain,
            onAction: _load,
          ),
        );
      }
      if (remote.loading) {
        return const Padding(
          padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmRhythm.section, MmSpace.gutter, 0),
          child: SkeletonGroup(
            label: ToolsCopy.proReading,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Skeleton.line(width: 200), SizedBox(height: MmSpace.s12), Skeleton(width: 120, height: 48)]),
          ),
        );
      }
      return const SizedBox.shrink();
    }
    if (pro.locked) return const SizedBox.shrink();
    return _ProContent(pro: pro, state: widget.state);
  }
}

class _ProContent extends ConsumerWidget {
  const _ProContent({required this.pro, required this.state});

  final CompassPro pro;
  final CompassState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final total = pro.total;
    final mine = ref.watch(myCollegesProvider);
    final shortlist = ref.watch(shortlistProvider);
    final full = shortlist.length >= ShortlistController.limit;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const ToolsHeading(ToolsCopy.proHeading, note: ToolsCopy.proLead),
        ToolsCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (pro.hasReadyPaper && total != null && total.count > 0) ...[
                MergeSemantics(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ToolsNumber(value: '${total.mid}', unit: 'of ${total.max}', semanticsLabel: '${total.mid} of ${total.max}'),
                      const SizedBox(height: MmSpace.s8),
                      Text(ToolsCopy.proRange(total.low, total.high), style: type.labelLarge),
                      const SizedBox(height: 2),
                      Text(
                        total.complete ? ToolsCopy.proTotalComplete : ToolsCopy.proTotalPartial(total.count),
                        style: type.caption.copyWith(color: colors.ink3),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: MmSpace.s20),
              ] else ...[
                Text(ToolsCopy.proNoneReady(pro.minSample), style: type.body.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s16),
              ],
              for (final (i, p) in pro.papers.indexed) ...[
                if (i > 0) const SizedBox(height: MmSpace.s16),
                _PaperRow(paper: p, max: pro.paperMax),
              ],
            ],
          ),
        ),
        if (pro.next != null) ...[
          const SizedBox(height: MmRhythm.item),
          ToolsCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ToolsCopy.proNextHeading, style: type.labelLarge.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s8),
                Text(ToolsCopy.proNextLead(pro.next!.name, pro.next!.open, pro.paperMax), style: type.body),
                if (pro.next!.chapter != null && pro.next!.chapter!.isNotEmpty) ...[
                  const SizedBox(height: MmSpace.s8),
                  Text(
                    ToolsCopy.proNextChapter(pro.next!.chapter!, pro.next!.wrong, pro.next!.blank, pro.next!.chapterN),
                    style: type.caption.copyWith(color: colors.ink2),
                  ),
                ],
                const SizedBox(height: MmSpace.s16),
                KeyButton(
                  label: ToolsCopy.proPractise(pro.next!.name),
                  // Pushed over Compass, so Back returns here.
                  onPressed: () => context.push(
                    Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'subject': pro.next!.subject}).toString(),
                  ),
                ),
              ],
            ),
          ),
        ],
        ToolsHeading(
          ToolsCopy.shortlistHeading,
          note: ToolsCopy.shortlistNote,
          trailing: KeyButton.quiet(
            label: ToolsCopy.shortlistAdd,
            onPressed: full || !mine.ready || mine.busy ? null : () => showShortlistSheet(context, state),
          ),
        ),
        // The list is My colleges. Until it has loaded the section says so; it never shows an empty
        // list that simply did not load.
        const Padding(padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter), child: MyCollegesAvailability(signedOutNote: false)),
        if (mine.ready && shortlist.isEmpty)
          const ToolsNote(ToolsCopy.shortlistEmpty, top: 0)
        else if (shortlist.isNotEmpty)
          ToolsPanel(
            children: [
              for (final t in shortlist) _TargetRow(key: ValueKey('${t.groupId}::${t.college}'), target: t, state: state, band: pro.total),
            ],
          ),
        if (mine.notice.isNotEmpty) ToolsNote(mine.notice, top: MmSpace.s8),
        if (full) const ToolsNote(ToolsCopy.shortlistFull, top: MmSpace.s8),
      ],
    );
  }
}

/// One paper: its name and projected marks, what the projection rests on, and a bar showing the
/// range with the middle marked. A paper with too little practice says how much more it needs.
class _PaperRow extends StatelessWidget {
  const _PaperRow({required this.paper, required this.max});

  final ProPaper paper;
  final int max;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final p = paper;
    if (!p.ready) {
      return MergeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(p.name, style: type.labelLarge),
            const SizedBox(height: 2),
            Text(ToolsCopy.proThin(p.needed), style: type.caption.copyWith(color: colors.ink2)),
          ],
        ),
      );
    }
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(child: Text(p.name, style: type.labelLarge)),
              Text('${p.mid}', style: type.labelLarge.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
              Text(' of $max', style: type.caption.copyWith(color: colors.ink2)),
            ],
          ),
          const SizedBox(height: 2),
          Text(ToolsCopy.proPaperMeta(p.n, p.accuracyPct, p.attemptSharePct), style: type.caption.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s8),
          SizedBox(
            height: 14,
            child: CustomPaint(
              size: const Size(double.infinity, 14),
              painter: RangeBarPainter(colors: colors, low: p.low / max, mid: p.mid / max, high: p.high / max),
            ),
          ),
          const SizedBox(height: 2),
          Text(ToolsCopy.proRange(p.low, p.high), style: type.caption.copyWith(color: colors.ink2)),
        ],
      ),
    );
  }
}

/// A track with the low-to-high range as a span and the middle as a dot. Fractions are of the
/// paper maximum.
class RangeBarPainter extends CustomPainter {
  RangeBarPainter({required this.colors, required this.low, required this.mid, required this.high});

  final MmColors colors;
  final double low;
  final double mid;
  final double high;

  @override
  void paint(Canvas canvas, Size size) {
    const track = 6.0;
    final y = size.height / 2;
    final bar = RRect.fromLTRBR(0, y - track / 2, size.width, y + track / 2, const Radius.circular(track / 2));
    canvas.drawRRect(bar, Paint()..color = colors.line);
    double x(double f) => (f.clamp(0.0, 1.0)) * size.width;
    final span = RRect.fromLTRBR(x(low), y - track / 2, x(high) < x(low) + track ? x(low) + track : x(high), y + track / 2, const Radius.circular(track / 2));
    canvas.drawRRect(span, Paint()..color = colors.ink3);
    final c = Offset(x(mid).clamp(7.0, size.width - 7), y);
    canvas.drawCircle(c, 7, Paint()..color = colors.volt);
    canvas.drawCircle(
      c,
      7,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = colors.voltEdge,
    );
  }

  @override
  bool shouldRepaint(RangeBarPainter old) => old.colors != colors || old.low != low || old.mid != mid || old.high != high;
}

/// The row of [seats] a shortlist target means: the same college and programme. A target saved
/// before the programme was kept (an empty one) reads the college's first row.
///
/// My colleges names a college once for each programme, and the website saves the programme's own
/// name, which is not one of a college's rows (a college can list a programme under several
/// subject combinations). A saved programme that matches no row reads the college's first row.
DuSeat? shortlistSeat(List<DuSeat> seats, ShortlistTarget target) {
  DuSeat? first;
  for (final s in seats) {
    if (s.college != target.college) continue;
    if (target.programme.isEmpty || s.programme == target.programme) return s;
    first ??= s;
  }
  return first;
}

/// What the student can add for [group]: one entry per college and programme row (a college can
/// list one programme under several subject combinations, each with its own cutoffs), by
/// college and then programme.
List<ShortlistTarget> shortlistChoices(DuGroup group, List<DuSeat> seats) {
  final all = <ShortlistTarget>{
    for (final s in seats) ShortlistTarget(groupId: group.id, college: s.college, programme: s.programme),
  }.toList();
  all.sort((a, b) {
    final c = a.college.compareTo(b.college);
    return c != 0 ? c : a.programme.compareTo(b.programme);
  });
  return all;
}

/// One shortlist target: the college and programme, the three rounds' cutoffs for the category,
/// and where the projected range sits against the earliest listed cutoff. Nothing is said about
/// the cutoffs until the file has loaded: a skeleton while it loads, Try again if it did not.
class _TargetRow extends ConsumerWidget {
  const _TargetRow({super.key, required this.target, required this.state, required this.band});

  final ShortlistTarget target;
  final CompassState state;
  final ProTotal? band;

  static const _rounds = ['Round 1', 'Round 2', 'Round 3'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final group = state.catalog.group(target.groupId);
    final offerings = ref.watch(duOfferingsProvider(target.groupId));
    final programme = group?.name ?? target.groupId;
    final seat = switch (offerings) {
      AsyncData(:final value) => shortlistSeat(value.seats, target),
      _ => null,
    };
    // The row's own programme, when it says more than the group's name does.
    final seatProgramme = seat != null && seat.programme.isNotEmpty && duNormName(seat.programme) != duNormName(programme) ? seat.programme : null;
    final Widget body = switch (offerings) {
      AsyncData() => _Cutoffs(seat: seat, categoryIndex: state.categoryIndex, band: band, rounds: _rounds),
      AsyncError(:final error) => InlineBanner(
          tone: error is DuLoadError && error.offline ? BannerTone.offline : BannerTone.error,
          message: error is DuLoadError && error.offline ? ToolsCopy.cutoffsOffline : ToolsCopy.cutoffsError,
          actionLabel: ToolsCopy.tryAgain,
          onAction: () => ref.invalidate(duOfferingsProvider(target.groupId)),
        ),
      _ => const SkeletonGroup(
          label: ToolsCopy.loadingCutoffs,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [Skeleton.line(width: 220), SizedBox(height: MmSpace.s8), Skeleton.line(width: 160)],
          ),
        ),
    };
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s12, MmSpace.s4, MmSpace.s12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: MergeSemantics(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(target.college, style: type.labelLarge.copyWith(fontSize: 16)),
                  Text(programme, style: type.caption.copyWith(color: colors.ink2)),
                  if (seatProgramme != null) Text(seatProgramme, style: type.caption.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s8),
                  body,
                ],
              ),
            ),
          ),
          IconButton(
            tooltip: ToolsCopy.shortlistRemove(target.college),
            icon: Icon(LucideIcons.trash2, size: 18, color: colors.ink2),
            onPressed: () => unawaited(ShortlistController.remove(ref, target)),
          ),
        ],
      ),
    );
  }
}

/// The three rounds and the verdict, once the programme's cutoffs have loaded.
class _Cutoffs extends StatelessWidget {
  const _Cutoffs({required this.seat, required this.categoryIndex, required this.band, required this.rounds});

  final DuSeat? seat;
  final int categoryIndex;
  final ProTotal? band;
  final List<String> rounds;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final cutoffs = [for (final r in seat?.rounds ?? const <List<double?>?>[null, null, null]) duEffectiveCutoff(r, categoryIndex)];
    final first = cutoffs.firstWhere((c) => c != null, orElse: () => null);
    final b = band;
    final String verdict;
    if (b == null || !b.complete) {
      verdict = ToolsCopy.proNeedsFull;
    } else {
      final cmp = proCompare(b, first);
      verdict = switch (cmp.position) {
        ProPosition.above => ToolsCopy.proAbove(duFormatScore(cmp.by)),
        ProPosition.within => ToolsCopy.proWithin,
        ProPosition.below => ToolsCopy.proBelow(duFormatScore(cmp.by)),
        ProPosition.none => ToolsCopy.proNoCutoff,
      };
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (cutoffs.every((c) => c == null))
          Text(ToolsCopy.proNoCutoff, style: type.caption.copyWith(color: colors.ink2))
        else ...[
        Wrap(
          spacing: MmSpace.s16,
          runSpacing: MmSpace.s4,
          children: [
            for (var i = 0; i < 3; i++)
              if (cutoffs[i] != null)
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: '${rounds[i]}  ', style: type.caption.copyWith(color: colors.ink3)),
                  TextSpan(
                    text: duFormatScore(cutoffs[i]),
                    style: type.labelLarge.copyWith(fontSize: 14, fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                ]),
              ),
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        Text(verdict, style: type.caption.copyWith(color: colors.ink2)),
        ],
      ],
    );
  }
}

/// Adds a target: first a programme the student's subjects open, then one of its colleges.
Future<void> showShortlistSheet(BuildContext context, CompassState state) => showMmSheet<void>(
      context: context,
      title: ToolsCopy.shortlistAdd,
      builder: (sheet) => _AddTarget(state: state),
    );

class _AddTarget extends ConsumerStatefulWidget {
  const _AddTarget({required this.state});

  final CompassState state;

  @override
  ConsumerState<_AddTarget> createState() => _AddTargetState();
}

class _AddTargetState extends ConsumerState<_AddTarget> {
  static bool _showsProgramme(ShortlistTarget t, DuGroup group) => t.programme.isNotEmpty && duNormName(t.programme) != duNormName(group.name);

  DuGroup? _group;
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final group = _group;
    if (group == null) return _programmes(context, colors, type);
    final offerings = ref.watch(duOfferingsProvider(group.id));
    // A college is on My colleges once for each programme, so one row of it is enough.
    final taken = {for (final t in ref.watch(shortlistProvider)) if (t.groupId == group.id) t.college};
    final offered = <String>{};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: KeyButton.quiet(label: group.name, onPressed: () => setState(() => _group = null)),
        ),
        Text(ToolsCopy.shortlistChooseCollege, style: type.caption.copyWith(color: colors.ink3)),
        const SizedBox(height: MmSpace.s8),
        switch (offerings) {
          AsyncData(:final value) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final target in shortlistChoices(group, value.seats))
                  if (!taken.contains(target.college) && offered.add(target.college))
                    ToolsRowFrame(
                      padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
                      semanticsLabel: _showsProgramme(target, group) ? '${target.college}. ${target.programme}' : target.college,
                      onTap: () {
                        unawaited(ShortlistController.add(ref, target));
                        Navigator.of(context).maybePop();
                      },
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(target.college, style: type.labelLarge),
                                if (_showsProgramme(target, group)) Text(target.programme, style: type.caption.copyWith(color: colors.ink2)),
                              ],
                            ),
                          ),
                          Icon(LucideIcons.plus, size: 16, color: colors.ink3),
                        ],
                      ),
                    ),
              ],
            ),
          AsyncError() => InlineBanner(
              tone: BannerTone.error,
              message: ToolsCopy.cutoffsError,
              actionLabel: ToolsCopy.tryAgain,
              onAction: () => ref.invalidate(duOfferingsProvider(group.id)),
            ),
          _ => const SkeletonGroup(label: ToolsCopy.loadingCutoffs, child: Skeleton.line(width: 220)),
        },
      ],
    );
  }

  Widget _programmes(BuildContext context, MmColors colors, MmType type) {
    final q = _query.trim().toLowerCase();
    final eligible = [for (final v in widget.state.eligible) v.group]
      ..sort((a, b) => a.name.compareTo(b.name));
    final shown = [for (final g in eligible) if (q.isEmpty || g.name.toLowerCase().contains(q)) g];
    if (eligible.isEmpty) return Text(ToolsCopy.shortlistNoEligible, style: type.body.copyWith(color: colors.ink2));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ToolsSearchField(controller: _search, hint: ToolsCopy.searchProgrammes, onChanged: (v) => setState(() => _query = v)),
        const SizedBox(height: MmSpace.s8),
        Text(ToolsCopy.shortlistChooseProgramme, style: type.caption.copyWith(color: colors.ink3)),
        for (final g in shown)
          ToolsRowFrame(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
            semanticsLabel: g.name,
            onTap: () => setState(() => _group = g),
            child: Row(children: [Expanded(child: Text(g.name, style: type.labelLarge)), Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3)]),
          ),
        if (shown.isEmpty) const ToolsNote(ToolsCopy.nothingMatches, top: MmSpace.s12),
      ],
    );
  }
}
