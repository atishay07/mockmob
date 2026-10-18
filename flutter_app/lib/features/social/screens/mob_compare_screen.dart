import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider;
import '../../you/widgets/you_page.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_navigator.dart';
import '../data/mob_repository.dart';
import '../widgets/mob_parts.dart';
import '../widgets/mob_pro_entry.dart';
import '../widgets/mob_ring.dart';

/// The side-by-side of one paper (SOCIAL-SPEC section 15): per question, what each member who shares
/// picked, who changed an answer and how long it took. Free: once, for your first Mob week. Pro: every
/// week. Members who keep their answers private are counted, never named, and nobody is ranked or
/// drawn as a gap. Nothing here is a card inside a card: one list on the ground, a hairline between
/// questions, and no volt at all (the page's actions are quiet keys).
class MobCompareScreen extends ConsumerStatefulWidget {
  const MobCompareScreen({super.key, required this.data, this.week, this.extra});

  final MobCompare data;

  /// What to read again after the share switch changes: a week's Monday, or an extra paper's id.
  final String? week;
  final String? extra;

  @override
  ConsumerState<MobCompareScreen> createState() => _MobCompareScreenState();
}

class _MobCompareScreenState extends ConsumerState<MobCompareScreen> {
  late MobCompare _data = widget.data;
  bool _busy = false;
  String? _notice;
  MobFailure? _failure;

  /// Turning sharing on shows the members who share: the side-by-side is read again.
  Future<void> _share() async {
    ref.read(hapticsProvider).toggle(true);
    setState(() {
      _busy = true;
      _notice = null;
      _failure = null;
    });
    final actions = ref.read(mobActionsProvider);
    final failure = await actions.updateMe(showScore: true);
    if (failure != null) {
      if (mounted) {
        setState(() {
          _busy = false;
          _notice = ref.read(mobActionsProvider).say(failure);
          _failure = failure;
        });
      }
      return;
    }
    final (fresh, failure2) = await actions.compare(week: widget.extra == null ? widget.week : null, extra: widget.extra);
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (fresh != null) _data = fresh;
      _notice = failure2 == null ? null : ref.read(mobActionsProvider).say(failure2);
      _failure = failure2;
    });
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final mob = ref.watch(currentMobProvider);
    final you = mob?.you ?? const MobYou();
    final d = _data;
    return YouPage(
      title: MobCopy.sideBySide,
      children: [
        Padding(
          padding: youGutter,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: MmSpace.s4),
              Semantics(header: true, child: Text(MobCopy.sideBySideTitle(d), style: type.title.copyWith(color: colors.ink))),
              const SizedBox(height: MmSpace.s4),
              Text(MobCopy.sideBySideSat(d), style: type.body.copyWith(color: colors.ink2)),
              if (d.teaser != null) ...[
                const SizedBox(height: MmSpace.s8),
                Text(d.teaser!.text, style: type.body.copyWith(color: colors.ink)),
              ],
              if (d.access == MobCompareAccess.sample) ...[
                const SizedBox(height: MmSpace.s8),
                // Pro is named only where it can be had, with the key to the Upgrade sheet on it (D80).
                MobNote(MobCopy.sampleLeadFor(sell: ref.watch(proNudgesOnProvider))),
                const MobProEntry(reason: ProReason.mob),
              ],
              if (!d.youShare) ...[
                const SizedBox(height: MmSpace.s8),
                MobSwitchRow(title: MobCopy.shareLabel, note: MobCopy.shareHintCompare, value: false, enabled: !_busy, onChanged: (_) => _share(), padding: EdgeInsets.zero),
              ],
              if (_notice != null) ...[
                const SizedBox(height: MmSpace.s8),
                Semantics(liveRegion: true, child: Text(_notice!, style: type.small.copyWith(color: colors.ink))),
                MobProEntry(failure: _failure),
              ],
              const SizedBox(height: MmSpace.s16),
            ],
          ),
        ),
        if (d.questions.isEmpty)
          Padding(padding: youGutter, child: MobNote(MobCopy.noQuestions))
        else
          for (var i = 0; i < d.questions.length; i++)
            _QuestionBlock(
              question: d.questions[i],
              you: you,
              first: i == 0,
              resultId: d.yourResultId,
              partial: d.hidden > 0,
            ),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
          child: MobNote(MobCopy.sideBySideFoot),
        ),
      ],
    );
  }
}

class _QuestionBlock extends ConsumerWidget {
  const _QuestionBlock({required this.question, required this.you, required this.first, this.resultId, this.partial = false});

  final MobCompareQuestion question;
  final MobYou you;
  final bool first;
  final String? resultId;

  /// A member keeps their answers private: the counts are over you and the members who share.
  final bool partial;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    final q = question;
    final trap = q.trap;
    final rows = <Widget>[
      if (q.you != null) _PickRow(name: you.name, colour: you.colour, pick: q.you!, isYou: true),
      for (final o in q.others) _PickRow(name: o.name, colour: o.colour, pick: o.pick),
    ];
    return Padding(
      padding: youGutter,
      child: DecoratedBox(
        decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
        child: Padding(
          padding: const EdgeInsets.only(top: MmSpace.s16, bottom: MmSpace.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Semantics(header: true, child: Text(MobCopy.questionNumber(q.number), style: type.labelLarge.copyWith(color: colors.ink))),
                  const Spacer(),
                  if (q.split == true) ...[
                    Text(MobCopy.split, style: type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
                    const SizedBox(width: MmSpace.s12),
                  ],
                  if (q.key != null) Text(MobCopy.answerKey(q.key!), style: type.small.copyWith(color: colors.ink2)),
                ],
              ),
              if (q.stem.isNotEmpty) ...[
                const SizedBox(height: MmSpace.s4),
                Text(q.stem, style: type.body.copyWith(color: colors.ink2)),
              ],
              if (rows.isNotEmpty) ...[const SizedBox(height: MmSpace.s8), ...rows],
              if (q.picks != null && q.picks!.isNotEmpty) ...[
                const SizedBox(height: MmSpace.s4),
                MobNote(MobCopy.howPicked(q.picks!, partial: partial)),
              ],
              if (trap != null) ...[
                const SizedBox(height: MmSpace.s12),
                Text(
                  '${MobCopy.trapLine(MobTrap(questionNumber: q.number, option: trap.option, count: trap.count, of: trap.of))} ${trap.trapName == null ? 'A common wrong pick.' : 'Trap: ${trap.trapName}.'}',
                  style: type.body.copyWith(color: colors.ink),
                ),
                const SizedBox(height: MmSpace.s8),
                PillKey(
                  label: q.you?.right == true ? MobCopy.seeWhy(trap.option) : MobCopy.repairIt,
                  onPressed: () => ref
                      .read(mobNavigatorProvider)
                      .openTrap(context, MobTrap(questionNumber: q.number, option: trap.option, count: trap.count, of: trap.of), resultId: resultId),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// One member's pick: the disc, the name, how the answer moved, then the letter and the verdict in
/// words, so colour is never the only signal.
class _PickRow extends StatelessWidget {
  const _PickRow({required this.name, required this.colour, required this.pick, this.isYou = false});

  final String name;
  final int colour;
  final MobPick pick;
  final bool isYou;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final detail = [
      if ((pick.changed ?? 0) > 0) MobCopy.changed(pick.changed!),
      if (pick.seconds != null) MobCopy.seconds(pick.seconds!),
    ].join('. ');
    final verdict = pick.picked == null ? MobCopy.noAnswer : (pick.right == true ? MobCopy.right : (pick.right == false ? MobCopy.wrong : ''));
    final verdictColor = pick.right == true ? colors.goodText : (pick.right == false ? colors.wrongText : colors.ink3);
    final who = isYou ? MobCopy.youRow : name;
    return Semantics(
      container: true,
      label: '$who, ${pick.picked ?? MobCopy.none}, $verdict${detail.isEmpty ? '' : ', $detail'}',
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Row(
          children: [
            InitialDisc(member: MobMember(memberId: '', name: name, colour: colour), size: 28),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(who, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w600)),
                  if (detail.isNotEmpty) Text(detail, style: type.small.copyWith(color: colors.ink2)),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(pick.picked ?? MobCopy.none, style: type.labelLarge.copyWith(color: colors.ink)),
                if (verdict.isNotEmpty) Text(verdict, style: type.small.copyWith(color: verdictColor)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
