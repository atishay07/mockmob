// P2 Start a game (spec 5.3, Arena S6; D167). Pick Sprint (5 questions), Race (5 or 10 minutes, as many as you
// can), Your own round (10, 15 or 20) or Full mock together (the subject's 50 questions in 60 minutes), what it
// covers (the chapter of your Mob's last trap, a chapter you choose, or the whole subject; a full mock is always
// the whole subject), how your Mob plays it (Live now or Anytime in 24 hours, only when live is on; a full mock
// is always 24 hours) and start. On success the run opens at once (this sheet does that; the caller does not):
// a live room opens in the den, a full mock in the app's mock runner. The opened game is returned.
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
import '../data/mob_mock.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../mob_v3_nav.dart';
import 'format_tiles.dart';
import 'mic_sheet.dart';
import 'sheet_parts.dart';

/// Prefill for a rematch or a picked tile.
class StartGamePrefill {
  const StartGamePrefill({this.format = GameFormat.sprint, this.count = 5, this.chapter, this.rematchOf, this.mode = GameMode.async, this.minutes});
  final GameFormat format;
  final int count;
  final String? chapter;
  final String? rematchOf;
  final GameMode mode;

  /// A race's length (5 or 10).
  final int? minutes;
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
    // A race or a mock keeps its format; otherwise a length of 5 is the sprint and anything else the round.
    tile = switch (p.format) {
      GameFormat.race || GameFormat.mock => p.format,
      _ => p.count == 5 && p.format != GameFormat.round ? GameFormat.sprint : GameFormat.round,
    };
    // A format this student cannot start opens on one they can (a rematch of a full mock by a Free member).
    final starts = v3?.starts;
    if (starts != null && !starts.allows(tile) && starts.allows(GameFormat.sprint)) tile = GameFormat.sprint;
    count = switch (tile) {
      GameFormat.round => const [10, 15, 20].contains(p.count) ? p.count : 10,
      GameFormat.mock => 50,
      _ => 5,
    };
    minutes = p.minutes == 10 ? 10 : 5;
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

  /// A race's length.
  late int minutes;
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
        final mock = c.tile == GameFormat.mock;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(MobV3Copy.startSub(mobName, subject), style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            FormatTiles(
              starts: starts,
              selected: c.tile,
              start: true,
              onTap: (f) => c.update(() {
                c.tile = f;
                c.count = switch (f) { GameFormat.round => c.count == 5 || c.count == 50 ? 10 : c.count, GameFormat.mock => 50, _ => 5 };
                // A full mock is always 24 hours.
                if (f == GameFormat.mock) c.mode = GameMode.async;
                c.error = null;
                c.modeNote = null;
              }),
              onLockedTap: (f) => c.update(() => c.error = f == GameFormat.mock ? MobV3Copy.mockPro : MobV3Copy.errors['START_PRO']),
            ),
            if (c.tile == GameFormat.round) ...[
              const SizedBox(height: MmSpace.s12),
              _Stepper(count: c.count, onChanged: (n) => c.update(() => c.count = n)),
            ],
            if (c.tile == GameFormat.race) ...[
              MobSheetLabel(MobV3Copy.howLong, padding: const EdgeInsets.only(top: MmSpace.s24, bottom: MmSpace.s8)),
              MmSegmented<int>(
                key: const ValueKey('start-minutes'),
                semanticsLabel: MobV3Copy.howLong,
                showBubbles: false,
                segments: [MmSegment(5, MobV3Copy.minutesLabel(5)), MmSegment(10, MobV3Copy.minutesLabel(10))],
                value: c.minutes,
                onChanged: (m) => c.update(() => c.minutes = m),
              ),
              const SizedBox(height: MmSpace.s8),
              const MobLine(MobV3Copy.raceLineStart),
            ],
            if (mock) ...[
              const SizedBox(height: MmSpace.s16),
              MobLine(MobV3Copy.mockLineStart(subject), key: const ValueKey('start-mock-line')),
            ] else ...[
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
      // A rematch of a sprint or round is a rematch; a race or a mock is opened again as itself.
      final format = prefill.rematchOf != null && (c.tile == GameFormat.sprint || c.tile == GameFormat.round) ? GameFormat.rematch : c.tile;
      final mock = c.tile == GameFormat.mock;
      final game = await actions.openGame(
        format: format,
        mode: mock ? GameMode.async : c.mode,
        count: c.count,
        chapter: mock ? null : c.chapter,
        rematchOf: format == GameFormat.rematch ? prefill.rematchOf : null,
        minutes: c.tile == GameFormat.race ? c.minutes : null,
      );
      c.update(() => c.busy = false);
      if (!context.mounted) return;
      // Open the run at once: this sheet leaves, the run rises over the den.
      final nav = Navigator.of(context, rootNavigator: true);
      nav.pop(game);
      if (game.format == GameFormat.mock) {
        // The full mock opens in the app's mock runner.
        // ignore: use_build_context_synchronously
        await sitMobMock(nav.context, game.id);
        return;
      }
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
    final starts = v3?.starts;
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final c = controller;
        final can = starts == null || starts.allows(c.tile);
        final label = c.mode == GameMode.live && c.tile != GameFormat.mock
            ? MobV3Copy.openRoom
            : switch (c.tile) {
                GameFormat.race => MobV3Copy.startTheRace,
                GameFormat.mock => MobV3Copy.startTheMock,
                GameFormat.sprint => MobV3Copy.startTheSprint,
                _ => MobV3Copy.startTheRound,
              };
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (c.error != null) ...[
              Text(c.error!, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink)),
              const SizedBox(height: MmSpace.s8),
            ],
            KeyButton(
              key: const ValueKey('start-key'),
              label: label,
              loading: c.busy,
              onPressed: can ? () => _start(context, ref) : null,
              disabledReason: can ? null : (starts.can ? MobV3Copy.mockPro : MobV3Copy.errors['START_USED']),
            ),
            const SizedBox(height: MmSpace.s8),
            Text(MobV3Copy.startUnder(mobName), textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
          ],
        );
      },
    );
  }
}
