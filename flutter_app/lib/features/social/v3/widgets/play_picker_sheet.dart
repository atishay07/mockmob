// P1 Play picker (spec 5.3, Arena S5 plus Live 05's "Open now"). "Play with your Mob": what is open now (a row
// for each open game and the weekly paper) and "Start a game" by what the server says this student may do.
//
// D167, D169, K9: every format starts in the one Start a game sheet (Sprint, Race, Your own round, Full mock
// together). Here "Start a game" is one row that names them all, and one line on live and 24 hours. Live is not
// a tile of its own: it is the start sheet's Anytime or Live choice.
//
// Plan words appear only when billing is on (`v3.starts.billingOn`): with it off there are no sections about
// plans, no lock and no "Pro", only "Anyone in your Mob can start a game." With it on, a start left, a start
// used (the tiles stay drawn, locked, with the reason above them), a mic passed to you, or Pro. No price
// anywhere. "What Pro adds" shows only when the Pro nudges are on.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import '../../copy.dart' show MobCopy;
import '../../data/mob_models.dart';
import '../../data/mob_navigator.dart';
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../mob_v3_nav.dart';
import 'free_pro_sheet.dart';
import 'sheet_parts.dart';
import 'start_game_sheet.dart';

/// Opens P1. The body scrolls; "Ask your Mob for a game" and "What Pro adds" stand pinned under it.
Future<void> showPlayPicker(BuildContext context) {
  final c = _PickerController();
  return showMmSheet<void>(
    context: context,
    title: MobV3Copy.pickerTitle,
    builder: (_) => _PickerBody(controller: c),
    footer: (_) => _PickerFooter(controller: c),
  );
}

class _PickerController extends ChangeNotifier {
  bool asking = false;
  bool asked = false;
  String? note;

  void update(void Function() f) {
    f();
    notifyListeners();
  }
}

class _PickerBody extends ConsumerStatefulWidget {
  const _PickerBody({required this.controller});

  final _PickerController controller;

  @override
  ConsumerState<_PickerBody> createState() => _PickerBodyState();
}

class _PickerBodyState extends ConsumerState<_PickerBody> {
  bool _sitting = false;

  _PickerController get c => widget.controller;

  Future<void> _sit(Mob mob) async {
    if (_sitting) return;
    setState(() => _sitting = true);
    c.update(() => c.note = null);
    final route = ModalRoute.of(context);
    final failure = await ref.read(mobNavigatorProvider).sitPaper(context, ref, mob);
    if (!mounted) return;
    setState(() => _sitting = false);
    if (failure != null) {
      c.update(() => c.note = MobCopy.failure(failure, sell: false));
    } else if (route != null && route.isActive) {
      // The paper opened; the sheet has done its job.
      Navigator.of(context, rootNavigator: true).removeRoute(route);
    }
  }

  Future<void> _start(GameFormat format) async {
    final count = switch (format) { GameFormat.round => 10, GameFormat.mock => 50, _ => 5 };
    final game = await showStartGame(context, prefill: StartGamePrefill(format: format, count: count));
    // A game was opened and its run is on screen: this sheet is no longer under anything the student needs.
    if (game != null && mounted) dropSheet(context);
  }

  @override
  Widget build(BuildContext context) {
    final den = ref.watch(denViewProvider);
    if (den == null) return const SizedBox.shrink();
    final now = ref.watch(nowProvider)();
    final v3 = den.v3;
    final mob = den.mob;
    final starts = v3.starts;
    final mobName = v3.name.text.isEmpty ? MobV3Copy.title : v3.name.text;
    final open = v3.openGames;
    final paperRow = mob != null && (mob.week.youSat || !mob.week.closedAt(now));

    // The one volt key: the first thing to play, else the paper.
    final firstPlayable = open.indexWhere((g) => g.yourRun != YourRun.finished);
    final paperPrimary = paperRow && firstPlayable < 0 && !mob.week.youSat;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (open.isNotEmpty || paperRow) ...[
          const MobSheetLabel(MobV3Copy.openNow, padding: EdgeInsets.only(top: MmSpace.s4, bottom: MmSpace.s4)),
          for (var i = 0; i < open.length; i++) _GameRow(game: open[i], member: v3.member(open[i].host?.memberId ?? ''), now: now, primary: i == firstPlayable),
          if (paperRow) _PaperRow(mob: mob, satAt: v3.paperSatAt, primary: paperPrimary, sitting: _sitting, onSit: () => _sit(mob)),
        ],
        const MobSheetLabel(MobV3Copy.startAGame),
        ..._startBlock(context, starts, mobName, v3.live, open),
        const SizedBox(height: MmSpace.s8),
      ],
    );
  }

  List<Widget> _startBlock(BuildContext context, StartRight starts, String mobName, LiveSwitch live, List<MobGameSummary> open) {
    final billing = starts.billingOn;
    final used = billing && !starts.can;
    final pro = billing && starts.via == StartVia.pro;
    final mic = billing && starts.can && starts.via == StartVia.mic;
    // A Free member with a start left and a mic held sees both lines (the start is used first).
    final micAlso = billing && starts.can && starts.via == StartVia.freeWeekly && starts.mics > 0;
    final sentences = <String>[
      if (!billing) MobV3Copy.anyoneCanStart,
      if (billing && !used && !mic && !pro) MobV3Copy.startsLeft(mobName, starts.freeLeft ?? 1),
      if (mic || micAlso) MobV3Copy.micPassed(starts.micFrom ?? MobV3Copy.aFriend),
    ];
    return [
      if (sentences.isNotEmpty) ...[
        for (final line in sentences) ...[MobLine(line), const SizedBox(height: MmSpace.s4)],
        const SizedBox(height: MmSpace.s8),
      ],
      if (used) ...[
        const MobLine(MobV3Copy.startUsed),
        const SizedBox(height: MmSpace.s4),
        const MobLine(MobV3Copy.anyoneWithPro),
        const SizedBox(height: MmSpace.s12),
      ],
      // D169: every format starts in the one Start a game sheet; this row names them all (K9).
      MobRow(
        key: const ValueKey('picker-start-row'),
        leading: const PaperChip(icon: LucideIcons.plus),
        title: MobV3Copy.chooseAGame,
        line: MobV3Copy.startRowLine,
        trailing: RowKey(label: MobV3Copy.startKey2, primary: open.isEmpty, onPressed: () => _start(GameFormat.sprint)),
      ),
      const SizedBox(height: MmSpace.s4),
      MobLine(live.enabled ? MobV3Copy.waysLiveLine : MobV3Copy.waysLine),
    ];
  }
}

class _GameRow extends StatelessWidget {
  const _GameRow({required this.game, required this.member, required this.now, required this.primary});

  final MobGameSummary game;
  final MobV3Member? member;
  final DateTime now;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final played = game.yourRun == YourRun.finished;
    final host = game.host;
    final m = member;
    final lead = m != null
        ? MemberHead.of(m)
        : (host != null ? MemberHead(name: host.name) : const PaperChip(icon: LucideIcons.send));
    return MobRow(
      leading: lead,
      title: MobV3Copy.gameTitle(game),
      line: MobV3Copy.openRow(game, now),
      trailing: played
          ? RowKey(label: MobV3Copy.podiumKey, onPressed: () => leaveSheetThen(context, (c) => MobV3Nav.podium(c, game.id)))
          : RowKey(label: game.live ? MobV3Copy.joinGame : MobV3Copy.play, primary: primary, onPressed: () => leaveSheetThen(context, (c) => MobV3Nav.run(c, game.id))),
    );
  }
}

class _PaperRow extends ConsumerWidget {
  const _PaperRow({required this.mob, required this.satAt, required this.primary, required this.sitting, required this.onSit});

  final Mob mob;
  final DateTime? satAt;
  final bool primary;
  final bool sitting;
  final VoidCallback onSit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final week = mob.week;
    final sat = week.youSat;
    final id = week.yourResultId;
    return MobRow(
      leading: const PaperChip(icon: LucideIcons.fileText),
      title: MobV3Copy.weeklyPaper,
      line: sat ? MobV3Copy.satLine(satAt) : MobV3Copy.paperClock,
      trailing: sat
          ? (id == null ? null : RowKey(label: MobV3Copy.answers, onPressed: () {
              ref.read(mobNavigatorProvider).openAnswers(context, id);
              dropSheet(context);
            }))
          : RowKey(label: MobV3Copy.sitIt, primary: primary, loading: sitting, onPressed: onSit),
    );
  }
}

/// Pinned under the picker: ask the Mob for a game, and (only when Pro nudges are on) what Pro adds.
class _PickerFooter extends ConsumerWidget {
  const _PickerFooter({required this.controller});

  final _PickerController controller;

  Future<void> _ask(WidgetRef ref) async {
    final c = controller;
    if (c.asking || c.asked) return;
    c.update(() {
      c.asking = true;
      c.note = null;
    });
    try {
      await ref.read(mobV3ActionsProvider).sticker(StickerKind.again);
      c.update(() {
        c.asking = false;
        c.asked = true;
      });
    } on Object catch (e) {
      c.update(() {
        c.asking = false;
        c.note = MobV3Copy.error(e);
      });
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final den = ref.watch(denViewProvider);
    final billing = den?.v3.starts.billingOn ?? false;
    final nudges = ref.watch(proNudgesOnProvider) && billing;
    final canAsk = (den?.v3.members.length ?? 0) > 1;
    if (!canAsk && !nudges) return const SizedBox.shrink();
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (canAsk) KeyButton.secondary(label: controller.asked ? MobV3Copy.stickerSent : MobV3Copy.askForGame, loading: controller.asking, onPressed: controller.asked ? null : () => _ask(ref)),
          if (controller.note != null) ...[
            const SizedBox(height: MmSpace.s8),
            MobLine(controller.note!, center: true),
          ],
          if (nudges) LinkKey(label: MobV3Copy.whatProAdds, alignment: Alignment.center, onPressed: () => showFreeProSheet(context)),
        ],
      ),
    );
  }
}
