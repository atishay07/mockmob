import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/du_repository.dart';
import '../domain/du_eligibility.dart';
import '../domain/du_helpers.dart';
import '../domain/du_models.dart';
import '../widgets/sort_key.dart';
import '../widgets/tools_page.dart';
import 'compass_controller.dart';

enum SeatSort { fit, high, low, name }

const int _pageSize = 25;

/// College by college minimum allocation scores (CSAS 2026, Rounds I to III) for the chosen
/// category, the effective cutoff being the lower of the UR and category lists. With a score,
/// each college says which round it would have cleared. Search, four orders, 25 at a time.
class CutoffTable extends ConsumerStatefulWidget {
  const CutoffTable({super.key, required this.group, required this.state});

  final DuGroup group;
  final CompassState state;

  @override
  ConsumerState<CutoffTable> createState() => _CutoffTableState();
}

class _CutoffTableState extends ConsumerState<CutoffTable> {
  final _search = TextEditingController();
  String _query = '';
  SeatSort? _sort;
  int _shown = _pageSize;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<DuSeat> _ordered(List<DuSeat> seats, int cat, double? score, SeatSort sort) {
    final q = _query.trim().toLowerCase();
    final list = seats.where((r) => q.isEmpty || '${r.college} ${r.programme}'.toLowerCase().contains(q)).toList();
    double? r1(DuSeat r) => duEffectiveCutoff(r.rounds[0], cat);
    double? best(DuSeat r) {
      final vals = [for (final x in r.rounds) ?duEffectiveCutoff(x, cat)];
      return vals.isEmpty ? null : vals.reduce((a, b) => a < b ? a : b);
    }

    switch (sort) {
      case SeatSort.name:
        list.sort((a, b) {
          final c = a.college.compareTo(b.college);
          return c != 0 ? c : a.programme.compareTo(b.programme);
        });
      case SeatSort.low:
        list.sort((a, b) => (best(a) ?? 9999).compareTo(best(b) ?? 9999));
      case SeatSort.fit when score != null:
        list.sort((a, b) {
          final ba = best(a), bb = best(b);
          final ca = ba != null && score >= ba, cb = bb != null && score >= bb;
          if (ca != cb) return ca ? -1 : 1;
          if (ca) return (r1(b) ?? 0).compareTo(r1(a) ?? 0);
          return (ba ?? 9999).compareTo(bb ?? 9999);
        });
      case SeatSort.fit || SeatSort.high:
        list.sort((a, b) => (r1(b) ?? -1).compareTo(r1(a) ?? -1));
    }
    return list;
  }

  static String _label(SeatSort s) => switch (s) {
        SeatSort.fit => ToolsCopy.sortFit,
        SeatSort.high => ToolsCopy.sortHigh,
        SeatSort.low => ToolsCopy.sortLow,
        SeatSort.name => ToolsCopy.sortCollegeName,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final async = ref.watch(duOfferingsProvider(widget.group.id));
    return switch (async) {
      AsyncData(:final value) => _table(context, value.seats),
      AsyncError(:final error) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: InlineBanner(
            tone: error is DuLoadError && error.offline ? BannerTone.offline : BannerTone.error,
            message: error is DuLoadError && error.offline ? ToolsCopy.cutoffsOffline : ToolsCopy.cutoffsError,
            actionLabel: ToolsCopy.tryAgain,
            onAction: () => ref.invalidate(duOfferingsProvider(widget.group.id)),
          ),
        ),
      _ => Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: SkeletonGroup(
            label: ToolsCopy.loadingCutoffs,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < 3; i++) ...[
                  const Skeleton.line(width: 200),
                  const SizedBox(height: MmSpace.s8),
                  Row(children: [for (var j = 0; j < 3; j++) ...[const Skeleton(width: 64, height: 28), const SizedBox(width: 24)]]),
                  const SizedBox(height: MmSpace.s20),
                ],
                Text(ToolsCopy.loadingCutoffs, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          ),
        ),
    };
  }

  Widget _table(BuildContext context, List<DuSeat> seats) {
    final type = context.mmType;
    final s = widget.state;
    final score = s.score;
    final cat = s.categoryIndex;
    // Best fit needs a score. Without one (never given, or cleared since) the choice falls back
    // to the high-cutoff order, which is what the list shows and what the sort sheet marks.
    final chosen = _sort == SeatSort.fit && score == null ? null : _sort;
    final sort = chosen ?? (score != null ? SeatSort.fit : SeatSort.high);
    final rows = _ordered(seats, cat, score, sort);
    final clearing = score == null ? null : seats.where((r) => duSeatStatus(score, r, cat).clears).length;
    final options = [if (score != null) SeatSort.fit, SeatSort.high, SeatSort.low, SeatSort.name];
    // Round III is empty for most programmes: its column only shows when any college has a figure.
    final showThird = seats.any((r) => r.rounds.length > 2 && duEffectiveCutoff(r.rounds[2], cat) != null);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (clearing != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s12),
            child: Semantics(
              liveRegion: true,
              child: Text(ToolsCopy.clearing(duFormatScore(score), clearing, seats.length), style: type.body),
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: Row(
            children: [
              if (seats.length > 6) ...[
                Expanded(
                  child: ToolsSearchField(
                    controller: _search,
                    hint: ToolsCopy.searchColleges,
                    onChanged: (v) => setState(() {
                      _query = v;
                      _shown = _pageSize;
                    }),
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
              ] else
                const Spacer(),
              ToolsSortKey<SeatSort>(
                options: options,
                value: sort,
                labelOf: _label,
                onChanged: (v) => setState(() => _sort = v),
                sheetTitle: 'Sort colleges',
              ),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        if (rows.isEmpty)
          ToolsNote(ToolsCopy.noCollegeMatch, top: MmSpace.s8)
        else
          ToolsPanel(
            children: [
              for (final r in rows.take(_shown)) SeatRow(seat: r, groupName: widget.group.name, state: s, showThird: showThird),
            ],
          ),
        if (rows.length > _shown)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, 0),
            child: KeyButton.secondary(
              label: ToolsCopy.showMore(_pageSize < rows.length - _shown ? _pageSize : rows.length - _shown, rows.length - _shown),
              onPressed: () => setState(() => _shown += _pageSize),
            ),
          ),
        ToolsNote(ToolsCopy.scaleNote, top: MmSpace.s12),
      ],
    );
  }
}

/// One college: Round I, II and III cutoffs for the category in aligned columns (marked
/// "Unreserved" when the Unreserved list was the lower one), and, with a score, the round it
/// would have cleared.
class SeatRow extends StatelessWidget {
  const SeatRow({super.key, required this.seat, required this.groupName, required this.state, this.showThird = true});

  final DuSeat seat;
  final String groupName;
  final CompassState state;

  /// False leaves the Round III column out (no college of this programme has a Round III figure).
  final bool showThird;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final cat = state.categoryIndex;
    final score = state.score;
    final status = score == null ? null : duSeatStatus(score, seat, cat);
    final subtitle = duNormName(seat.programme) == duNormName(groupName) ? null : seat.programme;
    const names = ['I', 'II', 'III'];
    final cells = [
      for (var i = 0; i < (showThird ? 3 : 2); i++)
        (name: names[i], value: duEffectiveCutoff(seat.rounds[i], cat), ur: duViaUr(seat.rounds[i], cat)),
    ];
    final spoken = [
      seat.college,
      ?subtitle,
      for (final c in cells) 'Round ${c.name}: ${c.value == null ? 'no cutoff' : duFormatScore(c.value)}${c.ur ? ', ${ToolsCopy.viaUr}' : ''}',
      ?status?.label,
    ].join('. ');
    final tone = switch (status?.id) {
      DuSeatStatusId.r1 || DuSeatStatusId.r2 || DuSeatStatusId.r3 => ToolTone.good,
      DuSeatStatusId.below => ToolTone.low,
      _ => ToolTone.quiet,
    };
    // The round this score would have cleared reads in the accent; the others stay quiet.
    final cleared = switch (status?.id) {
      DuSeatStatusId.r1 => 0,
      DuSeatStatusId.r2 => 1,
      DuSeatStatusId.r3 => 2,
      _ => -1,
    };
    return ToolsRowFrame(
      semanticsLabel: spoken,
      padding: const EdgeInsets.fromLTRB(MmSpace.s20, 14, MmSpace.s20, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The verdict leads: can I get in comes before which college this is.
          if (status != null) ...[
            ToolTag(status.label, tone: tone),
            const SizedBox(height: MmSpace.s8),
          ],
          Text(seat.college, maxLines: 2, overflow: TextOverflow.ellipsis, style: type.labelLarge.copyWith(fontSize: 16)),
          if (subtitle != null) Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.caption.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          Row(
            children: [
              for (final (i, c) in cells.indexed)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Round ${c.name}', style: type.caption.copyWith(color: i == cleared ? colors.ink : colors.ink3)),
                      Text(
                        duFormatScore(c.value),
                        style: type.timer.copyWith(fontSize: 18, color: c.value == null ? colors.ink3 : (i == cleared ? colors.accentText : colors.ink)),
                      ),
                      if (c.ur)
                        // The word, under the score: three columns leave no room beside it.
                        Tooltip(
                          message: ToolsCopy.viaUr,
                          child: Text(ToolsCopy.viaUrBadge, style: type.caption.copyWith(color: colors.accentText, fontWeight: FontWeight.w600)),
                        ),
                    ],
                  ),
                ),
              if (!showThird) const Spacer(),
            ],
          ),
        ],
      ),
    );
  }
}
