// P2 Start a game (spec 5.3, Arena S6). Pick Sprint (5 questions) or Your own round (10, 15 or 20), what it
// covers (the chapter of your Mob's last trap, a chapter you choose, or the whole subject), how your Mob plays
// it (Live now or Anytime in 24 hours, only when live is on) and start. On success the run opens at once
// (this sheet does that; the caller does not), and the opened game is returned.
//
// Errors are the server's sentences, inline under the key. LIVE_BUSY turns the sheet to anytime in 24 hours
// with its sentence. The key under which "Everyone in <Mob> plays it free" stands is the screen's one volt.
// Pass the mic shows only for Pro with billing on. No price anywhere.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../practice/widgets/chapter_picker.dart' show showChapterPicker;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../mob_v3_nav.dart';
import 'mic_sheet.dart';
import 'sheet_parts.dart';

/// Prefill for a rematch or a picked tile.
class StartGamePrefill {
  const StartGamePrefill({this.format = GameFormat.sprint, this.count = 5, this.chapter, this.rematchOf, this.mode = GameMode.async});
  final GameFormat format;
  final int count;
  final String? chapter;
  final String? rematchOf;
  final GameMode mode;
}

/// Opens P2; returns the opened game, or null when the sheet was closed.
Future<MobGame?> showStartGame(BuildContext context, {StartGamePrefill prefill = const StartGamePrefill()}) {
  final container = ProviderScope.containerOf(context, listen: false);
  final den = container.read(denViewProvider);
  final c = _StartController(prefill, den?.v3);
  return showMmSheet<MobGame>(
    context: context,
    title: MobV3Copy.startAGame,
    builder: (_) => _StartBody(controller: c, prefill: prefill),
    footer: (_) => _StartKeys(controller: c, prefill: prefill),
  );
}

enum _Covers { trap, chosen, whole }

class _StartController extends ChangeNotifier {
  _StartController(StartGamePrefill p, MobV3? v3) {
    // A rematch or a picked length: 5 is the sprint, anything else the round.
    tile = p.count == 5 && p.format != GameFormat.round ? GameFormat.sprint : GameFormat.round;
    count = tile == GameFormat.sprint ? 5 : (const [10, 15, 20].contains(p.count) ? p.count : 10);
    trapChapter = v3?.lastTrapChapter;
    if (p.chapter != null) {
      chapter = p.chapter;
      covers = _Covers.chosen;
    } else if (trapChapter != null) {
      chapter = trapChapter;
      covers = _Covers.trap;
    } else {
      covers = _Covers.whole;
    }
    final live = v3?.live;
    mode = p.mode == GameMode.live && live != null && live.enabled && live.hoursOk && (v3?.starts.liveAllowed ?? false) ? GameMode.live : GameMode.async;
  }

  late GameFormat tile;
  late int count;
  late _Covers covers;
  String? chapter;
  String? trapChapter;
  late GameMode mode;
  bool busy = false;
  String? error;
  String? modeNote;

  void update(void Function() f) {
    f();
    notifyListeners();
  }
}

class _StartBody extends ConsumerWidget {
  const _StartBody({required this.controller, required this.prefill});

  final _StartController controller;
  final StartGamePrefill prefill;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final den = ref.watch(denViewProvider);
    if (den == null) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    final v3 = den.v3;
    final starts = v3.starts;
    final mobName = v3.name.text.isEmpty ? MobV3Copy.title : v3.name.text;
    final subject = den.subjectName;
    final canLive = v3.live.enabled;
    final liveOk = v3.live.hoursOk && starts.liveAllowed && starts.can;

    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final c = controller;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(MobV3Copy.startSub(mobName, subject), style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: MobTile(
                      icon: LucideIcons.send,
                      title: MobV3Copy.sprint,
                      line: MobV3Copy.sprintSub,
                      selected: c.tile == GameFormat.sprint,
                      onTap: () => c.update(() {
                        c.tile = GameFormat.sprint;
                        c.count = 5;
                        c.error = null;
                      }),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: MobTile(
                      icon: LucideIcons.slidersHorizontal,
                      title: MobV3Copy.ownRound,
                      line: MobV3Copy.ownRoundSubStart,
                      selected: c.tile == GameFormat.round,
                      onTap: () => c.update(() {
                        c.tile = GameFormat.round;
                        if (c.count == 5) c.count = 10;
                        c.error = null;
                      }),
                    ),
                  ),
                ],
              ),
            ),
            if (c.tile == GameFormat.round) ...[
              const SizedBox(height: MmSpace.s12),
              _Stepper(count: c.count, onChanged: (n) => c.update(() => c.count = n)),
            ],
            MobSheetLabel(MobV3Copy.whatItCovers, padding: const EdgeInsets.only(top: MmSpace.s24, bottom: MmSpace.s4)),
            _CoversRow(controller: c, subject: subject, subjectId: den.mob?.subject ?? ''),
            MobSheetLabel(MobV3Copy.howMobPlays, padding: const EdgeInsets.only(top: MmSpace.s24, bottom: MmSpace.s8)),
            if (canLive) ...[
              MmSegmented<GameMode>(
                semanticsLabel: MobV3Copy.howMobPlays,
                showBubbles: false,
                lockedHint: MobV3Copy.lockedWord,
                segments: [MmSegment(GameMode.live, MobV3Copy.liveNow, locked: !liveOk), const MmSegment(GameMode.async, MobV3Copy.anytime24)],
                value: c.mode,
                onChanged: (m) => c.update(() {
                  c.mode = m;
                  c.modeNote = null;
                }),
                onLockedTap: (_) => c.update(() => c.modeNote = !v3.live.hoursOk ? MobV3Copy.liveHours : MobV3Copy.errors['START_FORMAT']),
              ),
              const SizedBox(height: MmSpace.s8),
            ],
            MobLine(c.mode == GameMode.live ? MobV3Copy.liveLineStart : MobV3Copy.asyncLineStart),
            if (c.modeNote != null) ...[
              const SizedBox(height: MmSpace.s4),
              MobLine(c.modeNote!),
            ],
            if (starts.billingOn && starts.via == StartVia.pro && starts.micsToGive != null) ...[
              const SizedBox(height: MmSpace.s16),
              Divider(height: 1, thickness: 1, color: colors.line),
              _MicRow(left: starts.micsToGive!),
            ],
            const SizedBox(height: MmSpace.s8),
          ],
        );
      },
    );
  }
}

/// The "What it covers" row: the chapter the Mob's last trap was in, a chapter chosen, or the whole subject.
class _CoversRow extends ConsumerWidget {
  const _CoversRow({required this.controller, required this.subject, required this.subjectId});

  final _StartController controller;
  final String subject;
  final String subjectId;

  Future<void> _change(BuildContext context) async {
    List<String>? picked;
    try {
      picked = await showChapterPicker(context, subjectId: subjectId, selected: [if (controller.chapter != null) controller.chapter!]);
    } on Object {
      picked = null;
    }
    if (picked == null || picked.isEmpty) return;
    controller.update(() {
      controller.chapter = picked!.first;
      controller.covers = _Covers.chosen;
      controller.error = null;
    });
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = controller;
    final text = switch (c.covers) {
      _Covers.trap => MobV3Copy.coversTrap(c.chapter ?? ''),
      _Covers.chosen => c.chapter ?? '',
      _Covers.whole => MobV3Copy.coversWhole(subject),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MobRow(
          leading: const PaperChip(icon: LucideIcons.bookOpen),
          title: text,
          compactTitle: true,
          trailing: subjectId.isEmpty ? null : RowKey(label: MobV3Copy.change, onPressed: () => _change(context)),
        ),
        if (c.covers != _Covers.whole)
          LinkKey(
            label: MobV3Copy.useWholeSubject,
            onPressed: () => c.update(() {
              c.covers = _Covers.whole;
              c.chapter = null;
            }),
          ),
      ],
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.count, required this.onChanged});

  final int count;
  final ValueChanged<int> onChanged;

  static const List<int> lengths = [10, 15, 20];

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final i = lengths.indexOf(count);
    Widget step(IconData icon, String label, VoidCallback? onTap) => MmPressable(
          onTap: onTap,
          semanticsLabel: label,
          haptic: MmPressHaptic.selection,
          builder: (context, pressed, _) => Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(shape: BoxShape.circle, color: pressed ? colors.raised2 : colors.raised, border: Border.all(color: onTap == null ? colors.line : colors.lineStrong)),
            child: Icon(icon, size: 20, color: onTap == null ? colors.ink4 : colors.ink),
          ),
        );
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        step(LucideIcons.minus, MobV3Copy.fewerQuestions, i > 0 ? () => onChanged(lengths[i - 1]) : null),
        const SizedBox(width: MmSpace.s20),
        SizedBox(
          width: 140,
          child: Semantics(liveRegion: true, child: Text(MobV3Copy.lengthLabel(count), textAlign: TextAlign.center, style: type.cardTitle)),
        ),
        const SizedBox(width: MmSpace.s20),
        step(LucideIcons.plus, MobV3Copy.moreQuestions, i >= 0 && i < lengths.length - 1 ? () => onChanged(lengths[i + 1]) : null),
      ],
    );
  }
}

class _MicRow extends StatelessWidget {
  const _MicRow({required this.left});

  final int left;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      onTap: () => showMicSheet(context),
      haptic: MmPressHaptic.selection,
      semanticsLabel: '${MobV3Copy.passMic}. ${MobV3Copy.passMicRow(left)}',
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => MobRow(
        leading: const PaperChip(icon: LucideIcons.mic),
        title: MobV3Copy.passMic,
        line: MobV3Copy.passMicRow(left),
        trailing: Icon(LucideIcons.chevronRight, size: 20, color: pressed ? colors.ink3 : colors.ink2),
      ),
    );
  }
}

class _StartKeys extends ConsumerWidget {
  const _StartKeys({required this.controller, required this.prefill});

  final _StartController controller;
  final StartGamePrefill prefill;

  Future<void> _start(BuildContext context, WidgetRef ref) async {
    final c = controller;
    if (c.busy) return;
    c.update(() {
      c.busy = true;
      c.error = null;
    });
    final actions = ref.read(mobV3ActionsProvider);
    try {
      final format = prefill.rematchOf != null ? GameFormat.rematch : c.tile;
      final game = await actions.openGame(format: format, mode: c.mode, count: c.count, chapter: c.chapter, rematchOf: prefill.rematchOf);
      c.update(() => c.busy = false);
      if (!context.mounted) return;
      // Open the run at once: this sheet leaves, the run rises over the den.
      final nav = Navigator.of(context, rootNavigator: true);
      nav.pop(game);
      // The root navigator's own context outlives this sheet. A live game opens its lobby with the
      // go-live wash; an anytime one opens the run.
      if (game.mode == GameMode.live && game.room != null) {
        // ignore: use_build_context_synchronously
        MobV3Nav.room(nav.context, game.id, opened: true);
      } else {
        // ignore: use_build_context_synchronously
        MobV3Nav.run(nav.context, game.id);
      }
    } on Object catch (e) {
      final sentence = MobV3Copy.error(e);
      final code = MobV3Copy.codeOf(e);
      if (code == 'LIVE_BUSY') {
        // Live is busy: the same game goes ahead as anytime in 24 hours.
        c.update(() {
          c.busy = false;
          c.mode = GameMode.async;
          c.modeNote = sentence;
        });
      } else {
        c.update(() {
          c.busy = false;
          c.error = sentence;
        });
        // The right to start may have changed under us (used, a Mob already at three games): read the den again.
        if (const {'START_USED', 'START_PRO', 'START_FORMAT', 'GAMES_OPEN_LIMIT'}.contains(code)) {
          try {
            await actions.refresh();
          } on Object {
            // The sentence is already on screen.
          }
        }
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final den = ref.watch(denViewProvider);
    final colors = context.mmColors;
    final type = context.mmType;
    final v3 = den?.v3;
    final mobName = v3 == null || v3.name.text.isEmpty ? MobV3Copy.title : v3.name.text;
    final can = v3?.starts.can ?? true;
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final c = controller;
        final label = c.mode == GameMode.live ? MobV3Copy.openRoom : (c.tile == GameFormat.sprint ? MobV3Copy.startTheSprint : MobV3Copy.startTheRound);
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (c.error != null) ...[
              Text(c.error!, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink)),
              const SizedBox(height: MmSpace.s8),
            ],
            KeyButton(label: label, loading: c.busy, onPressed: can ? () => _start(context, ref) : null, disabledReason: can ? null : MobV3Copy.errors['START_USED']),
            const SizedBox(height: MmSpace.s8),
            Text(MobV3Copy.startUnder(mobName), textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
          ],
        );
      },
    );
  }
}
