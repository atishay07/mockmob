// P2 Start a game: the one sheet where every Mob game starts (D167, D169; pass-1020 MOB-MINIMAL 3.2, A8).
//
// Top to bottom, as the minimal Mob mock-ups draw it (`tmp/design-1020/mob-minimal/sheet-*.png`):
// - "Start a game" and "Chai Circle · Accountancy";
// - Anytime · 24 hours | Live · together now (only while the server's live switch is on), with its one line;
//   a Free student's Live keeps its lock note, and outside 6 AM to 11 PM it says so;
// - four rows, a radio and one line each: Sprint, Race (5 or 10 minute chips when chosen), Your own round
//   (10, 15 or 20 chips when chosen) and Full mock together (the whole paper in 24 hours; dimmed with
//   "Anytime only" in Live, and drawn locked with Pro when the server says so);
// - what it covers: "The whole of Accountancy" or the chapter of the Mob's last trap, with Change (a full mock
//   is always the whole paper);
// - one key that names the action ("Start the sprint", "Open the room for a 10-minute race");
// - the start allowance under it; Pass the mic for Pro with billing on; and the weekly Mob paper as the last row.
//
// On success the run opens at once (this sheet does that; the caller does not): an anytime game opens its run,
// a live one its room (the game's ready phase), a full mock the app's mock runner. The opened game is returned.
// Errors are the server's sentences, inline over the key; LIVE_BUSY turns the sheet to Anytime with its
// sentence. No price anywhere.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api.dart' show nowProvider;
import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../practice/widgets/chapter_picker.dart' show showChapterPicker;
import '../../copy.dart' show MobCopy;
import '../../data/mob_models.dart';
import '../../data/mob_navigator.dart';
import '../copy_v3.dart';
import '../data/mob_mock.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../mob_v3_nav.dart';
import 'format_tiles.dart' show FormatLook, mobStartFormats;
import 'mic_sheet.dart';
import 'sheet_parts.dart';

/// Prefill for a rematch or a picked format.
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
    mode = p.mode == GameMode.live && tile != GameFormat.mock && live != null && live.enabled && live.hoursOk && (v3?.starts.liveAllowed ?? false) ? GameMode.live : GameMode.async;
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

  void pick(GameFormat f) => update(() {
        tile = f;
        count = switch (f) { GameFormat.round => count == 5 || count == 50 ? 10 : count, GameFormat.mock => 50, _ => 5 };
        error = null;
      });
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
        final live = c.mode == GameMode.live;
        final mock = c.tile == GameFormat.mock;
        final shown = [for (final f in mobStartFormats) if (starts.shows(f)) f];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(MobV3Copy.startSub(mobName, subject), style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            if (canLive)
              _ModeSwitch(
                value: c.mode,
                liveLocked: !liveOk,
                onChanged: (m) => c.update(() {
                  c.mode = m;
                  c.modeNote = null;
                  // A full mock is anytime only: Live moves the choice to the race.
                  if (m == GameMode.live && c.tile == GameFormat.mock) {
                    c.tile = GameFormat.sprint;
                    c.count = 5;
                  }
                }),
                onLockedTap: () => c.update(() => c.modeNote = !v3.live.hoursOk ? MobV3Copy.liveHours : MobV3Copy.errors['START_FORMAT']),
              ),
            Padding(
              padding: EdgeInsets.only(top: canLive ? MmSpace.s8 : 0),
              child: Text(
                c.modeNote ?? (live ? MobV3Copy.liveModeLine : MobV3Copy.anytimeModeLine),
                key: const ValueKey('start-mode-line'),
                style: type.small.copyWith(color: colors.ink2),
              ),
            ),
            const SizedBox(height: MmSpace.s8),
            for (final f in shown)
              _FormatRow(
                key: ValueKey('format-${f.name}'),
                format: f,
                selected: c.tile == f,
                // In Live a full mock stays drawn, dimmed, with "Anytime only"; Pro-only stays drawn, locked.
                anytimeOnly: live && f == GameFormat.mock,
                locked: !starts.allows(f) && starts.can,
                proTag: starts.billingOn,
                minutes: c.minutes,
                count: c.count,
                mockDetail: MobV3Copy.mockDetail,
                onTap: () {
                  if (live && f == GameFormat.mock) return;
                  if (!starts.allows(f) && starts.can) {
                    c.update(() => c.error = f == GameFormat.mock ? MobV3Copy.mockPro : MobV3Copy.errors['START_PRO']);
                    return;
                  }
                  c.pick(f);
                },
                onMinutes: (m) => c.update(() => c.minutes = m),
                onCount: (n) => c.update(() => c.count = n),
              ),
            Divider(height: MmSpace.s16, thickness: 1, color: colors.line),
            if (mock)
              MobRow(leading: const PaperChip(icon: LucideIcons.bookOpen, size: 44), title: MobV3Copy.coversWhole(subject), compactTitle: true)
            else
              _CoversRow(controller: c, subject: subject, subjectId: den.mob?.subject ?? ''),
            if (starts.billingOn && starts.via == StartVia.pro && starts.micsToGive != null) ...[
              Divider(height: MmSpace.s16, thickness: 1, color: colors.line),
              _MicRow(left: starts.micsToGive!),
            ],
            const SizedBox(height: MmSpace.s4),
          ],
        );
      },
    );
  }
}

/// Anytime · 24 hours | Live · together now: a sunken track, the chosen half raised with an ink edge (the
/// minimal Mob's segmented control). The thumb slides 220 ms on the app's ease-out; reduced motion jumps.
class _ModeSwitch extends StatelessWidget {
  const _ModeSwitch({required this.value, required this.onChanged, this.liveLocked = false, this.onLockedTap});

  final GameMode value;
  final ValueChanged<GameMode> onChanged;
  final bool liveLocked;
  final VoidCallback? onLockedTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final reduced = MediaQuery.disableAnimationsOf(context);
    Widget half(GameMode m, String word, String detail, {bool locked = false}) {
      final on = value == m;
      final ink = locked ? colors.ink3 : colors.ink;
      return Expanded(
        child: MmPressable(
          key: ValueKey('start-mode-${m.name}'),
          onTap: locked ? onLockedTap : () => onChanged(m),
          haptic: MmPressHaptic.selection,
          semanticsLabel: '$word, $detail${locked ? '. ${MobV3Copy.lockedWord}' : ''}',
          builder: (context, pressed, _) => AnimatedContainer(
            duration: reduced ? Duration.zero : const Duration(milliseconds: 220),
            curve: Motion.out,
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
            alignment: Alignment.centerLeft,
            decoration: BoxDecoration(
              color: on ? colors.selectedSurface : Colors.transparent,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: on ? colors.ink : Colors.transparent, width: 1.5),
            ),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text.rich(
                    TextSpan(children: [
                      TextSpan(text: word, style: context.mmType.labelLarge.copyWith(color: ink, fontWeight: FontWeight.w700)),
                      TextSpan(text: ' · $detail', style: context.mmType.caption.copyWith(color: colors.ink3)),
                    ]),
                    maxLines: 1,
                  ),
                  if (locked) ...[const SizedBox(width: MmSpace.s4), Icon(LucideIcons.lock, size: 12, color: colors.ink3)],
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.isNight ? colors.sunken : colors.raised2,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.line),
      ),
      child: Semantics(
        container: true,
        label: MobV3Copy.howMobPlays,
        child: Row(
          children: [
            half(GameMode.async, MobV3Copy.modeAnytime, MobV3Copy.modeAnytimeDetail),
            half(GameMode.live, MobV3Copy.modeLive, MobV3Copy.modeLiveDetail, locked: liveLocked),
          ],
        ),
      ),
    );
  }
}

/// One way to play: its paper chip, title and line, and a radio; the chosen row lifts onto a raised surface and
/// opens its chips (a race's minutes, a round's length) or, for a full mock, what the paper is.
class _FormatRow extends StatelessWidget {
  const _FormatRow({
    super.key,
    required this.format,
    required this.selected,
    required this.onTap,
    required this.minutes,
    required this.count,
    required this.onMinutes,
    required this.onCount,
    required this.mockDetail,
    this.anytimeOnly = false,
    this.locked = false,
    this.proTag = false,
  });

  final GameFormat format;
  final bool selected;
  final VoidCallback onTap;
  final int minutes;
  final int count;
  final ValueChanged<int> onMinutes;
  final ValueChanged<int> onCount;
  final String mockDetail;
  final bool anytimeOnly;
  final bool locked;
  final bool proTag;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = MediaQuery.disableAnimationsOf(context);
    final dim = anytimeOnly || locked;
    final on = selected && !dim;
    Widget? chips;
    if (on && format == GameFormat.race) {
      chips = _Chips<int>(
        key: const ValueKey('start-minutes'),
        values: const [5, 10],
        label: MobV3Copy.minutesLabel,
        value: minutes,
        onChanged: onMinutes,
      );
    } else if (on && format == GameFormat.round) {
      chips = _Chips<int>(
        key: const ValueKey('start-count'),
        values: const [10, 15, 20],
        label: (n) => '$n',
        semantics: MobV3Copy.lengthLabel,
        value: count,
        onChanged: onCount,
      );
    } else if (on && format == GameFormat.mock) {
      chips = Text(mockDetail, key: const ValueKey('start-mock-line'), style: type.small.copyWith(color: colors.ink2));
    }
    final String? tag = anytimeOnly ? MobV3Copy.anytimeOnly : (locked && proTag ? MobV3Copy.proTag : null);
    final row = AnimatedContainer(
      duration: reduced ? Duration.zero : Motion.card,
      curve: Motion.out,
      padding: const EdgeInsets.fromLTRB(MmSpace.s12, 6, MmSpace.s12, 6),
      constraints: const BoxConstraints(minHeight: 56),
      decoration: BoxDecoration(color: on ? colors.raised2 : Colors.transparent, borderRadius: BorderRadius.circular(16)),
      child: Opacity(
        opacity: dim ? 0.45 : 1,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            PaperChip(icon: FormatLook.icon(format), size: 36, locked: locked),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(FormatLook.title(format), style: type.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
                  Text(MobV3Copy.formatRowLine(format), style: type.caption.copyWith(color: colors.ink3)),
                  if (chips != null) ...[const SizedBox(height: MmSpace.s8), chips],
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            if (tag != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: colors.lineStrong)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(tag, style: type.label.copyWith(color: colors.ink2)),
                  if (locked) ...[const SizedBox(width: 3), Icon(LucideIcons.lock, size: 11, color: colors.ink3)],
                ]),
              )
            else if (!locked)
              _Radio(on: on),
          ],
        ),
      ),
    );
    return Semantics(
      container: true,
      button: true,
      inMutuallyExclusiveGroup: true,
      selected: on,
      enabled: !dim,
      label: '${FormatLook.title(format)}. ${MobV3Copy.formatRowLine(format)}${tag != null ? '. $tag' : ''}',
      child: MmPressable(
        onTap: onTap,
        haptic: MmPressHaptic.selection,
        focusRadius: BorderRadius.circular(16),
        builder: (context, pressed, _) => row,
      ),
    );
  }
}

/// The radio: a ring, or the volt dot with a voltInk centre when chosen (the one volt mark in the rows).
class _Radio extends StatelessWidget {
  const _Radio({required this.on});

  final bool on;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return AnimatedContainer(
      duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : Motion.press,
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: on ? colors.volt : Colors.transparent,
        border: on ? null : Border.all(color: colors.ink4, width: 1.8),
      ),
      alignment: Alignment.center,
      child: on ? Container(width: 10, height: 10, decoration: BoxDecoration(shape: BoxShape.circle, color: colors.voltInk)) : null,
    );
  }
}

/// Small pill chips inside a chosen row (5 minutes, 10 minutes; 10, 15, 20).
class _Chips<T> extends StatelessWidget {
  const _Chips({super.key, required this.values, required this.label, required this.value, required this.onChanged, this.semantics});

  final List<T> values;
  final String Function(T) label;
  final String Function(T)? semantics;
  final T value;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Wrap(
      spacing: MmSpace.s8,
      runSpacing: MmSpace.s8,
      children: [
        for (final v in values)
          MmPressable(
            key: ValueKey('start-chip-$v'),
            onTap: () => onChanged(v),
            haptic: MmPressHaptic.selection,
            semanticsLabel: (semantics ?? label)(v),
            builder: (context, pressed, _) {
              final on = v == value;
              return Container(
                height: 36,
                constraints: const BoxConstraints(minWidth: 48),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: on ? colors.ink : Colors.transparent,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: on ? colors.ink : colors.lineStrong, width: 1.5),
                ),
                child: Center(widthFactor: 1, child: Text(label(v), style: type.label.copyWith(color: on ? colors.ground : colors.ink2, fontWeight: FontWeight.w600))),
              );
            },
          ),
      ],
    );
  }
}

/// A quiet text key at the end of a row ("Change", "Sit it"), in the accent ink, 48 dp tall.
class _AccentKey extends StatelessWidget {
  const _AccentKey({super.key, required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      onTap: onPressed,
      haptic: MmPressHaptic.selection,
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.only(left: MmSpace.s12),
          child: Center(
            widthFactor: 1,
            child: Text(label, style: context.mmType.labelLarge.copyWith(color: pressed || onPressed == null ? colors.ink2 : colors.accentText, fontWeight: FontWeight.w700)),
          ),
        ),
      ),
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
          leading: const PaperChip(icon: LucideIcons.bookOpen, size: 44),
          title: text,
          compactTitle: true,
          trailing: subjectId.isEmpty ? null : _AccentKey(key: const ValueKey('start-change'), label: MobV3Copy.change, onPressed: () => _change(context)),
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
        leading: const PaperChip(icon: LucideIcons.mic, size: 44),
        title: MobV3Copy.passMic,
        line: MobV3Copy.passMicRow(left),
        trailing: Icon(LucideIcons.chevronRight, size: 20, color: pressed ? colors.ink3 : colors.ink2),
      ),
    );
  }
}

class _StartKeys extends ConsumerStatefulWidget {
  const _StartKeys({required this.controller, required this.prefill});

  final _StartController controller;
  final StartGamePrefill prefill;

  @override
  ConsumerState<_StartKeys> createState() => _StartKeysState();
}

class _StartKeysState extends ConsumerState<_StartKeys> {
  bool _sitting = false;
  String? _paperNote;

  _StartController get controller => widget.controller;

  Future<void> _start(BuildContext context) async {
    final c = controller;
    if (c.busy) return;
    c.update(() {
      c.busy = true;
      c.error = null;
    });
    final actions = ref.read(mobV3ActionsProvider);
    final prefill = widget.prefill;
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
      // The root navigator's own context outlives this sheet. A live game opens its room (the game's ready
      // phase) with the go-live wash; an anytime one opens the run.
      if (game.mode == GameMode.live && game.room != null) {
        // ignore: use_build_context_synchronously
        unawaited(MobV3Nav.room(nav.context, game.id, opened: true));
      } else {
        // ignore: use_build_context_synchronously
        unawaited(MobV3Nav.run(nav.context, game.id));
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

  Future<void> _sit(Mob mob) async {
    if (_sitting) return;
    setState(() {
      _sitting = true;
      _paperNote = null;
    });
    final route = ModalRoute.of(context);
    final failure = await ref.read(mobNavigatorProvider).sitPaper(context, ref, mob);
    if (!mounted) return;
    setState(() => _sitting = false);
    if (failure != null) {
      setState(() => _paperNote = MobCopy.failure(failure, sell: false));
    } else if (route != null && route.isActive) {
      Navigator.of(context, rootNavigator: true).removeRoute(route);
    }
  }

  @override
  Widget build(BuildContext context) {
    final den = ref.watch(denViewProvider);
    final colors = context.mmColors;
    final type = context.mmType;
    final v3 = den?.v3;
    final mob = den?.mob;
    final mobName = v3 == null || v3.name.text.isEmpty ? MobV3Copy.title : v3.name.text;
    final starts = v3?.starts;
    final now = ref.watch(nowProvider)();
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final c = controller;
        final can = starts == null || starts.allows(c.tile);
        final live = c.mode == GameMode.live && c.tile != GameFormat.mock;
        final label = live
            ? MobV3Copy.openRoomFor(c.tile, minutes: c.minutes, count: c.count)
            : switch (c.tile) {
                GameFormat.race => MobV3Copy.startTheRace,
                GameFormat.mock => MobV3Copy.startTheMock,
                GameFormat.sprint => MobV3Copy.startTheSprint,
                _ => MobV3Copy.startTheRound,
              };
        final allowance = starts == null ? MobV3Copy.startUnder(mobName) : MobV3Copy.allowance(starts, mobName, live: live);
        final paperOpen = mob != null && !mob.week.youSat && !mob.week.closedAt(now);
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (c.error != null) ...[
              Text(c.error!, key: const ValueKey('start-error'), textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink)),
              const SizedBox(height: MmSpace.s8),
            ],
            KeyButton(
              key: const ValueKey('start-key'),
              label: label,
              loading: c.busy,
              onPressed: can ? () => _start(context) : null,
              disabledReason: can ? null : (starts.can ? MobV3Copy.mockPro : MobV3Copy.errors['START_USED']),
            ),
            const SizedBox(height: MmSpace.s8),
            Text(allowance, key: const ValueKey('start-allowance'), textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
            if (paperOpen) ...[
              Divider(height: MmSpace.s20, thickness: 1, color: colors.line),
              MobRow(
                leading: const PaperChip(icon: LucideIcons.calendarDays, size: 44),
                title: MobV3Copy.weeklyPaper,
                line: MobV3Copy.paperRowLine,
                trailing: _AccentKey(key: const ValueKey('start-sit-paper'), label: _sitting ? MobV3Copy.opening : MobV3Copy.sitIt, onPressed: _sitting ? null : () => _sit(mob)),
              ),
              if (_paperNote != null) MobLine(_paperNote!, center: true),
            ],
          ],
        );
      },
    );
  }
}
