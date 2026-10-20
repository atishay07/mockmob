// C2, the Mob's tab of the chains (spec 5.3, F8): the pennant and its weeks in a row, this week's quest
// with its twelve-segment bar, what filled it (by game, never by person, never "N of you"), the parcel's
// silhouette, how the quest counts with the step-out link, and the path of den items.
//
// Nobody can break the chain alone and nothing here says who did or did not answer. Past the goal the
// true total shows ("70 answered. The quest needed 60.") and the bar stays full (F8).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import 'chain_paper.dart';
import 'chain_pennant.dart';
import 'fold_puppet.dart';
import 'quest_segments.dart';
import 'sheet_parts.dart' show LinkKey;

class ChainMobBody extends ConsumerStatefulWidget {
  const ChainMobBody({super.key, required this.den, this.pennantWidth = 96, this.afterQuest, this.footer, this.crown = false});

  final DenView den;

  /// The This week sheet draws the pennant large.
  final double pennantWidth;

  /// The week's crown at the latest stitch (This week, when Mob hours name someone who studied the most).
  final bool crown;

  /// Drawn right under the quest card (Mob hours in the This week sheet).
  final Widget? afterQuest;

  /// Drawn last (the link to Your chain in the This week sheet).
  final Widget? footer;

  @override
  ConsumerState<ChainMobBody> createState() => _ChainMobBodyState();
}

class _ChainMobBodyState extends ConsumerState<ChainMobBody> {
  bool _busy = false;
  String? _error;

  MobV3 get v3 => widget.den.v3;

  Future<void> _stepOut() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(mobV3ActionsProvider).stepOut(!v3.quest.youSteppedOut);
      if (mounted) setState(() => _busy = false);
    } on Object catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = MobV3Copy.error(e);
        });
      }
    }
  }

  /// The pennant beside its title and line; at large text the pennant sits centred above them so the words keep a
  /// readable column (the same test the Mob hours block uses).
  Widget _header(BuildContext context, MobChainSummary chain, bool broke, String mob) {
    final colors = context.mmColors;
    final type = context.mmType;
    final stack = MediaQuery.textScalerOf(context).scale(16) > 18.5;
    final pennant = ChainPennant(weeks: chain.weeks, width: widget.pennantWidth, crown: widget.crown);
    final words = Column(
      crossAxisAlignment: stack ? CrossAxisAlignment.center : CrossAxisAlignment.start,
      children: [
        Text(MobV3Copy.mobChainTitle(chain.weeks), textAlign: stack ? TextAlign.center : TextAlign.start, style: type.headline.copyWith(fontSize: 26, height: 1.08)),
        const SizedBox(height: MmSpace.s8),
        Text(broke ? MobV3Copy.newMobChain(chain.best) : MobV3Copy.mobChainLine(mob), textAlign: stack ? TextAlign.center : TextAlign.start, style: type.body.copyWith(color: colors.ink2)),
        if (!broke) ...[
          const SizedBox(height: MmSpace.s8),
          Text(MobV3Copy.bestRun(chain.best), textAlign: stack ? TextAlign.center : TextAlign.start, style: type.small.copyWith(color: colors.ink3)),
        ],
      ],
    );
    if (stack) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [Center(child: pennant), const SizedBox(height: MmSpace.s12), words]);
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [pennant, const SizedBox(width: MmSpace.s16), Expanded(child: words)],
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = v3.quest;
    final chain = v3.mobChain;
    final mob = v3.name.text;
    final broke = chain.weeks == 0 && chain.best > 0;
    final each = q.sizedFor <= 0 ? q.target : q.target ~/ q.sizedFor;
    final count = q.past ? MobV3Copy.questPast(q.answered, q.target) : MobV3Copy.questAnswered(q.answered, q.target);
    // The figure is the number the line starts with; the rest of the sentence follows it in text.
    final figure = '${q.answered}';
    final rest = count.startsWith(figure) ? count.substring(figure.length) : ' $count';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _header(context, chain, broke, mob),
        const SizedBox(height: MmSpace.s24),
        MmSurface.plain(
          padding: const EdgeInsets.all(MmSpace.s20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(MobV3Copy.questTitle, style: type.subhead),
              const SizedBox(height: 2),
              Text(MobV3Copy.questEnds, style: type.small.copyWith(color: colors.ink3)),
              const SizedBox(height: MmSpace.s8),
              Text(MobV3Copy.questGoal(q.target), style: type.small.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s12),
              Semantics(
                container: true,
                label: count,
                child: ExcludeSemantics(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: figure, style: type.figure.copyWith(fontSize: 44, height: 1)),
                        TextSpan(text: rest, style: type.body.copyWith(color: colors.ink2)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: MmSpace.s12),
              QuestSegments(answered: q.answered, target: q.target, semanticsLabel: count),
              if (q.bySource.isNotEmpty) ...[
                const SizedBox(height: MmSpace.s16),
                Divider(height: 1, thickness: 1, color: colors.line),
                const SizedBox(height: MmSpace.s12),
                Text(MobV3Copy.whatFilled, style: type.label.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s4),
                for (final s in q.bySource)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: Text(s.label, style: type.body)),
                        const SizedBox(width: MmSpace.s12),
                        Text('${s.answered}', style: type.body.copyWith(fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
              ],
              if (!q.done) ...[
                const SizedBox(height: MmSpace.s12),
                Divider(height: 1, thickness: 1, color: colors.line),
                const SizedBox(height: MmSpace.s16),
                _Parcel(parcel: q.parcel, mob: mob),
              ],
            ],
          ),
        ),
        if (widget.afterQuest != null) ...[const SizedBox(height: MmSpace.s16), widget.afterQuest!],
        const SizedBox(height: MmSpace.s32),
        Text(MobV3Copy.howItCounts, style: type.subhead),
        const SizedBox(height: MmSpace.s8),
        Text(MobV3Copy.countsLine(q.sizedFor, each), style: type.body.copyWith(color: colors.ink2)),
        if (!q.done) ...[
          const SizedBox(height: MmSpace.s4),
          LinkKey(label: q.youSteppedOut ? MobV3Copy.steppedOut : MobV3Copy.stepOut, onPressed: _busy ? null : _stepOut),
        ],
        if (_error != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(_error!, style: type.small.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s24),
        Text(MobV3Copy.onTheWay, style: type.subhead),
        const SizedBox(height: MmSpace.s8),
        _DenPath(owned: v3.shelf.items),
        if (widget.footer != null) ...[const SizedBox(height: MmSpace.s16), widget.footer!],
      ],
    );
  }
}

/// The parcel's true contents in silhouette, and the sentence that says what finishing the quest brings.
class _Parcel extends StatelessWidget {
  const _Parcel({required this.parcel, required this.mob});

  final QuestParcel parcel;
  final String mob;

  static IconData _iconFor(String? item) => switch (item) {
        'desk_bell' => LucideIcons.bellRing,
        'brass_lamp' => LucideIcons.lightbulb,
        'foil_seal' => LucideIcons.award,
        _ => LucideIcons.stamp,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final Widget art = switch (parcel.kind) {
      ParcelKind.fold => FoldPuppet(fold: parcel.fold ?? FoldKey.hop, size: 64, locked: true, shadow: false, blink: false, fallbackName: MobV3Copy.foldName(parcel.fold ?? FoldKey.hop)),
      ParcelKind.item => Icon(_iconFor(parcel.item), size: 34, color: colors.ink3),
      ParcelKind.stitch => Icon(LucideIcons.flag, size: 34, color: colors.ink3),
    };
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 76,
          height: 76,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: colors.sunken, borderRadius: BorderRadius.circular(18), border: Border.all(color: colors.line)),
          child: art,
        ),
        const SizedBox(width: MmSpace.s16),
        Expanded(child: Text(MobV3Copy.parcelHolds(parcel, mob), style: type.body)),
      ],
    );
  }
}

class _DenPath extends StatelessWidget {
  const _DenPath({required this.owned});

  final List<String> owned;

  static const List<(int, String)> _steps = [(2, 'den_stamp'), (4, 'desk_bell'), (8, 'brass_lamp'), (12, 'foil_seal')];

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final firstUndone = _steps.indexWhere((s) => !owned.contains(s.$2));
    return Column(
      children: [
        for (var i = 0; i < _steps.length; i++)
          Builder(
            builder: (context) {
              final (at, item) = _steps[i];
              final done = owned.contains(item);
              final next = i == firstUndone;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: done ? ChainPaper.fill(context) : null,
                        border: done ? Border.all(color: ChainPaper.edge(context)) : Border.all(color: next ? colors.ink2 : colors.ink4, width: next ? 2 : 1.5),
                      ),
                      child: Text('$at', style: type.figureCompact.copyWith(fontSize: 18, height: 1, color: done ? ChainPaper.ink : (next ? colors.ink : colors.ink3))),
                    ),
                    const SizedBox(width: MmSpace.s16),
                    Expanded(child: Text(MobV3Copy.mobPath[i], style: type.labelLarge.copyWith(color: done || next ? colors.ink : colors.ink2))),
                    if (done) Icon(LucideIcons.check, size: 20, color: colors.ink2),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}
