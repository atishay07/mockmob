// The den: the Mob tab's lamp-lit room (spec 5.3 D1 to D6, 5.4, 5.5, 5.6 M1, M12, M13, K5).
//
// Top to bottom: the room (art, lamp pool, the Folds in join order with their names, the pennant and
// the shelf) under the header, then one card (D1 to D5, chosen by logic/den_copy_state.dart) and the
// quest strip. Enter the den (M1) plays when the den opens and when the tab comes back after a while;
// only the den content comes in, the shell and the bar never fade. After it, the moment queue plays
// what the server says is due, one at a time, and K5 shows a pass notice at most once a day.
//
// Reduced motion: a 120 ms fade of the den content and still Folds. Idle loops stop 10 s after the last
// touch (MobIdleScope) and when the tab is hidden (TickerMode).

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/repositories/remote_state.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/account/account_avatar.dart' show PushedBackKey, TabRootLeading;
import '../../../../core/widgets/widgets.dart';
import '../../../insights/ask_mobi.dart' show AskKeyLabel, AskMobiButton;
import '../../data/mob_models.dart';
import '../../data/mob_repository.dart';
import '../../widgets/mob_plan_widgets.dart' show MobSwitcher;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/den_copy_state.dart';
import '../logic/moment_queue.dart';
import '../mob_v3_nav.dart';
import '../widgets/den_cards.dart';
import '../widgets/den_stage.dart';
import '../widgets/fold_manifest.dart';
import '../widgets/invite_card.dart';
import '../widgets/mob_fx.dart';
import '../widgets/quest_bar.dart';
import '../widgets/sticker_row.dart';
import 'den_start_screen.dart';

/// The den's clock (tests pin it). Defaults to the phone's clock.
final denClockProvider = Provider<DateTime Function()>((ref) => DateTime.now);

class DenScreen extends ConsumerWidget {
  const DenScreen({super.key, this.asTab = false});

  /// The Mob tab's root: the account key leads the header and there is no back key.
  final bool asTab;

  /// The header's first row (the account key and the trailing keys).
  static const double headerRow = 56;

  /// Bumped by tests to replay Enter the den once the room's images are in (frame goldens).
  @visibleForTesting
  static final ValueNotifier<int> debugReplay = ValueNotifier<int>(0);

  /// The den replays Enter the den when the tab comes back after this long hidden.
  static const Duration replayAfter = Duration(seconds: 30);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // No Mob yet (D0): the start screen, whether or not the read carried v3.
    final read = ref.watch(mobRepositoryProvider.select((s) => s.value));
    if (read != null && read.mob == null) return const DenStartScreen();
    return _DenRoom(asTab: asTab);
  }
}

class _DenRoom extends ConsumerStatefulWidget {
  const _DenRoom({required this.asTab});

  final bool asTab;

  @override
  ConsumerState<_DenRoom> createState() => _DenScreenState();
}

class _DenScreenState extends ConsumerState<_DenRoom> with TickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _enter = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));
  late final AnimationController _fade = AnimationController(vsync: this, duration: MotionDurations.reducedFade, value: 1);

  /// M13: the den content's opacity while switching Mobs.
  late final AnimationController _switch = AnimationController(vsync: this, duration: MotionDurations.fadeThroughIn, value: 1);
  final ValueNotifier<double> _ms = ValueNotifier<double>(0);
  bool _idle = false;
  bool _entered = false;
  bool _queueRunning = false;
  bool? _tickersOn;
  DateTime? _hiddenAt;
  ChainNotice? _notice;
  String? _noticeText;
  Timer? _noticeTimer;
  final List<StickerSend> _flights = [];
  StickerBus? _bus;
  int _flightIds = 100000;

  bool get _reduced => MobFx.reduced(context);
  DenSessionMemory get _memory => ref.read(denSessionMemoryProvider);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    DenScreen.debugReplay.addListener(_replay);
    _enter.addListener(_onEnterTick);
    _enter.addStatusListener((s) {
      if (s == AnimationStatus.completed) _afterEnter();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _refresh(force: true);
      final view = ref.read(denViewProvider);
      unawaited(precacheFolds(context, [for (final m in view?.v3.members ?? const <MobV3Member>[]) m.fold]).catchError((Object _) {}));
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final bus = ref.read(stickerBusProvider);
    if (!identical(bus, _bus)) {
      _bus?.removeListener(_onBus);
      _bus = bus..addListener(_onBus);
    }
    final on = TickerMode.valuesOf(context).enabled;
    if (_tickersOn == null) {
      _tickersOn = on;
      _playEnter(inBuild: true);
    } else if (on != _tickersOn) {
      _tickersOn = on;
      if (!on) {
        _hiddenAt = DateTime.now();
      } else {
        // The tab came back: read the Mob again, and come in again after a while away.
        _refresh();
        final away = _hiddenAt == null ? Duration.zero : DateTime.now().difference(_hiddenAt!);
        if (away >= DenScreen.replayAfter) {
          _playEnter();
        } else if (_entered) {
          _afterEnter();
        }
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    DenScreen.debugReplay.removeListener(_replay);
    _bus?.removeListener(_onBus);
    _noticeTimer?.cancel();
    _enter.dispose();
    _fade.dispose();
    _switch.dispose();
    _ms.dispose();
    super.dispose();
  }

  Future<void> _refresh({bool force = false}) async {
    try {
      await ref.read(mobRepositoryProvider.notifier).refresh(force: force);
    } on Object {
      // The repository keeps what it had and says so (the offline strip).
    }
  }

  void _replay() => _playEnter();

  void _onEnterTick() {
    final ms = _enter.value * EnterDen.total;
    _ms.value = ms;
    if (!_idle && ms >= EnterDen.idleAt) setState(() => _idle = true);
  }

  /// M1. Reduced motion: the content fades in over 120 ms, the end state at once, Folds still.
  void _playEnter({bool inBuild = false}) {
    if (!mounted) return;
    final switched = _memory.switchedAt;
    final fromSwitch = switched != null && DateTime.now().difference(switched) < const Duration(seconds: 5);
    _memory.switchedAt = null;
    if (_reduced || fromSwitch) {
      _enter.stop();
      _ms.value = EnterDen.total;
      _idle = true;
      if (fromSwitch && !_reduced) {
        // M13: the new Mob fades in over 210 ms.
        _switch
          ..duration = MotionDurations.fadeThroughIn
          ..value = 0
          ..animateTo(1, curve: MotionCurves.glide);
      } else {
        _fade.forward(from: 0);
      }
      _entered = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _afterEnter());
      if (!inBuild) setState(() {});
      return;
    }
    _idle = false;
    _entered = false;
    _fade.value = 1;
    _ms.value = 0;
    _enter.forward(from: 0);
    if (!inBuild) setState(() {});
  }

  bool _visible() {
    if (!mounted) return false;
    if (!TickerMode.valuesOf(context).enabled) return false;
    return ModalRoute.of(context)?.isCurrent ?? true;
  }

  /// After Enter the den: fly recent stickers from friends, then the moment queue, then K5.
  Future<void> _afterEnter() async {
    if (!mounted) return;
    _entered = true;
    _flyRecentReactions();
    await _runMoments();
    if (mounted) await _maybeNotice();
  }

  Future<void> _runMoments() async {
    if (_queueRunning) return;
    final view = ref.read(denViewProvider);
    if (view == null) return;
    _queueRunning = true;
    try {
      List<String> due = const [];
      try {
        due = (await ref.read(chainProvider.future)).due;
      } on Object {
        // No chain read: the Mob's own moments still play.
      }
      if (!mounted) return;
      final keys = momentOrder(view.v3.moments, due);
      if (keys.isEmpty) return;
      final player = ref.read(momentPlayerProvider);
      final actions = ref.read(mobV3ActionsProvider);
      final played = await runMomentQueue(keys: keys, canPlay: _visible, play: (k) => player(context, k), seen: actions.seen, played: _memory.playedMoments);
      if (played.isNotEmpty && mounted) {
        ref.invalidate(chainProvider);
        unawaited(_refresh(force: true));
      }
    } finally {
      _queueRunning = false;
    }
  }

  /// K5: at most one pass notice a day, as an inline toast; marked seen once shown.
  Future<void> _maybeNotice() async {
    if (!_visible() || _notice != null) return;
    ChainState chain;
    try {
      chain = await ref.read(chainProvider.future);
    } on Object {
      return;
    }
    if (!mounted) return;
    final today = istDayKey(ref.read(denClockProvider)());
    final n = passNoticeFor(chain, today: today, shownOn: _memory.noticeShownOn);
    if (n == null) return;
    _memory.noticeShownOn = today;
    setState(() {
      _notice = n;
      _noticeText = passNoticeText(n, chain);
    });
    unawaited(ref.read(mobV3ActionsProvider).seen([n.key]));
    _noticeTimer?.cancel();
    _noticeTimer = Timer(const Duration(seconds: 6), () {
      if (mounted) setState(() => _noticeText = null);
    });
  }

  void _flyRecentReactions() {
    final view = ref.read(denViewProvider);
    if (view == null) return;
    final you = view.v3.you?.memberId;
    final now = ref.read(denClockProvider)();
    final fresh = <Reaction>[];
    for (final r in view.v3.reactions) {
      if (r.memberId == you) continue;
      final at = r.at;
      if (at == null || now.difference(at) > const Duration(hours: 12)) continue;
      if (!_memory.flownReactions.add('${r.memberId}:${r.kind.wire}:${at.toIso8601String()}')) continue;
      fresh.add(r);
    }
    if (fresh.isEmpty) return;
    setState(() {
      for (final r in fresh.take(3)) {
        _flights.add(StickerSend(memberId: r.memberId, kind: r.kind, id: ++_flightIds));
      }
      _trimFlights();
    });
  }

  void _onBus() {
    final bus = _bus;
    if (bus == null || bus.recent.isEmpty || !mounted) return;
    final last = bus.recent.last;
    if (_flights.any((f) => f.id == last.id)) return;
    setState(() {
      _flights.add(last);
      _trimFlights();
    });
  }

  void _trimFlights() {
    while (_flights.length > 3) {
      _flights.removeAt(0);
    }
  }

  /// M13: fade through to another Mob (90 out, then 210 in when it has loaded).
  Future<void> _switchTo(String id) async {
    ref.read(hapticsProvider).selection();
    if (!_reduced) {
      _switch.duration = MotionDurations.fadeThroughOut;
      await _switch.animateTo(0, curve: MotionCurves.exit);
    }
    _memory.switchedAt = DateTime.now();
    await ref.read(mobRepositoryProvider.notifier).select(id);
    if (!mounted) return;
    _memory.switchedAt = null;
    // Reduced motion: no fade out, and the new Mob comes in on one 120 ms fade.
    if (_reduced) _switch.value = 0;
    _switch.duration = _reduced ? MotionDurations.reducedFade : MotionDurations.fadeThroughIn;
    await _switch.animateTo(1, curve: MotionCurves.glide);
  }

  Future<void> _openSwitcher(Mob mob, MobV3 v3) async {
    final labels = MobSwitcher.labelsFor(mob.mobs);
    final picked = await showMmSheet<String>(
      context: context,
      title: MobV3Copy.switcherTitle,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.sheetSide, 0, MmSpace.sheetSide, MmSpace.s16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < mob.mobs.length; i++) ...[
              KeyButton.option(label: mob.mobs[i].active ? '${v3.name.text}, ${labels[i]}' : labels[i], selected: mob.mobs[i].active, onPressed: () => Navigator.of(sheet).pop(mob.mobs[i].id)),
              const SizedBox(height: MmSpace.s8),
            ],
          ],
        ),
      ),
    );
    if (picked == null || !mounted) return;
    if (picked == mob.id) return;
    await _switchTo(picked);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(mobRepositoryProvider);
    final view = ref.watch(denViewProvider);
    final colors = context.mmColors;
    return Scaffold(
      backgroundColor: colors.ground,
      body: MobIdleScope(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
            child: MmPullRefresh(
              onRefresh: () => ref.read(mobRepositoryProvider.notifier).refresh(force: true),
              child: CustomScrollView(slivers: [SliverToBoxAdapter(child: _body(context, state, view))]),
            ),
          ),
        ),
      ),
    );
  }

  Widget _body(BuildContext context, RemoteState<MobRead> state, DenView? view) {
    final top = MediaQuery.paddingOf(context).top;
    final bottom = MediaQuery.viewPaddingOf(context).bottom;
    return LayoutBuilder(
      builder: (context, box) {
        final w = box.maxWidth;
        final stageTop = top + DenScreen.headerRow;
        final roomH = stageTop + DenSizes.stageHeight(w);
        final mob = view?.mob;
        final v3 = view?.v3;
        final loading = view == null && state.value == null && state.error == null;
        final failed = view == null && !loading;
        final now = ref.watch(denClockProvider)();

        final room = Stack(
          children: [
            DenStage(
              v3: v3,
              roomHeight: roomH,
              stageTop: stageTop,
              ms: _ms,
              idle: _idle && !_reduced,
              skeleton: v3 == null,
              flights: List.of(_flights),
              onFlightDone: (id) {
                if (mounted) setState(() => _flights.removeWhere((f) => f.id == id));
              },
              onPennant: () => MobV3Nav.chains(context, mobTab: true),
              onShelf: () => MobV3Nav.shelf(context),
              onOpenSeat: () => shareInviteCard(context),
            ),
            if (mob != null && v3 != null)
              Positioned(
                left: MmSpace.gutter,
                top: stageTop + MmSpace.s2,
                width: math.max(160, w - MmSpace.gutter - 104),
                child: _TitleBlock(
                  name: v3.name.text.isEmpty ? mob.subjectName : v3.name.text,
                  subtitle: MobV3Copy.denSubtitle(mob.subjectName, v3.members.length),
                  onSwitch: mob.mobs.length > 1 ? () => _openSwitcher(mob, v3) : null,
                ),
              )
            else
              Positioned(left: MmSpace.gutter, top: stageTop + MmSpace.s8, child: const Skeleton(width: 150, height: 26)),
          ],
        );

        final below = <Widget>[];
        if (state.isStale) {
          below
            ..add(const InlineBanner.offlineStrip())
            ..add(const SizedBox(height: MmSpace.s12));
        }
        if (_noticeText != null && view != null) {
          below
            ..add(_PassNotice(text: _noticeText!))
            ..add(const SizedBox(height: MmSpace.s12));
        }
        if (loading) {
          below.add(
            SkeletonGroup(
              label: MobV3Copy.loading,
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  PaperPulse(width: double.infinity, height: 196, radius: 24),
                  SizedBox(height: MmSpace.s24),
                  PaperPulse(width: double.infinity, height: 44, radius: 8),
                ],
              ),
            ),
          );
        } else if (failed) {
          below.add(DenFailedCard(onRetry: () => _refresh(force: true)));
        } else if (mob != null && v3 != null) {
          final card = denCardFor(v3, paperSat: mob.week.youSat);
          below.add(
            _Rise(
              ms: _ms,
              at: EnterDen.cardAt,
              child: DenCardView(key: ValueKey('${mob.id}:${card.kind.name}:${card.game?.id}'), card: card, v3: v3, mob: mob, now: now),
            ),
          );
          if (card.kind != DenCardKind.one) {
            below
              ..add(const SizedBox(height: MmSpace.s20))
              ..add(
                _Rise(
                  ms: _ms,
                  at: EnterDen.questAt,
                  child: QuestStrip(quest: v3.quest, mobName: v3.name.text, onTap: () => MobV3Nav.chains(context, mobTab: true)),
                ),
              );
          }
        }

        final content = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            room,
            Padding(
              padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s4, MmSpace.gutter, MmSpace.s48 + bottom),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: below),
            ),
          ],
        );
        // The header is chrome and never fades; only the den content comes in.
        return Stack(
          children: [
            FadeTransition(
              key: const ValueKey('den-switch-fade'),
              opacity: _switch,
              child: FadeTransition(opacity: _fade, child: content),
            ),
            Positioned(
              left: MmSpace.gutter,
              right: MmSpace.gutter,
              top: top,
              height: DenScreen.headerRow,
              child: _HeaderRow(asTab: widget.asTab, chip: v3?.chainChip),
            ),
          ],
        );
      },
    );
  }
}

/// A block that rises 14 dp on emphasized 360 at its M1 time.
class _Rise extends StatelessWidget {
  const _Rise({required this.ms, required this.at, required this.child});

  final ValueNotifier<double> ms;
  final double at;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: ms,
      child: child,
      builder: (context, t, child) {
        final (o, dy) = EnterDen.block(t, at);
        return Opacity(
          opacity: o,
          child: Transform.translate(offset: Offset(0, dy), child: child),
        );
      },
    );
  }
}

/// The header's first row: the account key (as a tab) or Back, then the chain chip, Ask Mobi and the
/// Mob's settings. The header is chrome: it never animates in.
class _HeaderRow extends StatelessWidget {
  const _HeaderRow({required this.asTab, required this.chip});

  final bool asTab;
  final ChainChip? chip;

  @override
  Widget build(BuildContext context) {
    final c = chip;
    return Row(
      children: [
        if (asTab) const TabRootLeading() else const PushedBackKey(),
        const Spacer(),
        if (c != null && !c.hidden) ...[ChainChipKey(days: c.days, onTap: () => MobV3Nav.chains(context)), const SizedBox(width: MmSpace.s4)],
        const AskMobiButton(label: AskKeyLabel.figureOnly),
        _RoundKey(icon: LucideIcons.settings, label: MobV3Copy.settingsSemantics, onTap: () => MobV3Nav.settings(context)),
      ],
    );
  }
}

class _RoundKey extends StatelessWidget {
  const _RoundKey({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      pressedScale: 0.94,
      haptic: MmPressHaptic.selection,
      focusRadius: MmRadius.pillAll,
      builder: (context, pressed, _) => SizedBox(
        width: MmTarget.min,
        height: MmTarget.min,
        child: Center(child: Icon(icon, size: 22, color: colors.ink)),
      ),
    );
  }
}

/// The chain chip: a paper capsule with a link glyph and "13 days". Opens your chain.
class ChainChipKey extends StatelessWidget {
  const ChainChipKey({super.key, required this.days, required this.onTap});

  final int days;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final words = MobV3Copy.chainChip(days);
    final figure = '$days';
    return MmPressable(
      onTap: onTap,
      semanticsLabel: MobV3Copy.chainChipSemantics(days),
      pressedScale: 0.96,
      haptic: MmPressHaptic.selection,
      focusRadius: MmRadius.pillAll,
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: Center(
          child: Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
            decoration: BoxDecoration(
              color: colors.raised.withValues(alpha: colors.isNight ? 0.82 : 0.9),
              borderRadius: MmRadius.pillAll,
              border: Border.all(color: colors.line),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CustomPaint(
                  size: const Size(18, 12),
                  painter: _LinkGlyph(colour: colors.ink),
                ),
                const SizedBox(width: MmSpace.s6),
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: figure,
                        style: type.figureCompact.copyWith(color: colors.ink, fontSize: 17, height: 1),
                      ),
                      TextSpan(
                        text: words.substring(figure.length),
                        style: type.label.copyWith(color: colors.ink, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  maxLines: 1,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A paper chain link: two interlocked rounded loops in one weight.
class _LinkGlyph extends CustomPainter {
  _LinkGlyph({required this.colour});

  final Color colour;

  @override
  void paint(Canvas canvas, Size s) {
    final p = Paint()
      ..color = colour
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8;
    final h = s.height;
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(1, 1, s.width * 0.58, h - 2), Radius.circular(h / 2)), p);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(s.width * 0.4, 1, s.width * 0.58, h - 2), Radius.circular(h / 2)), p);
  }

  @override
  bool shouldRepaint(_LinkGlyph old) => old.colour != colour;
}

/// The Mob's name (with the switcher chevron when there are several Mobs) and "Accountancy, 4 of you".
class _TitleBlock extends StatelessWidget {
  const _TitleBlock({required this.name, required this.subtitle, this.onSwitch});

  final String name;
  final String subtitle;
  final VoidCallback? onSwitch;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    // The title sits over the lit room: a soft halo in the ground colour keeps it readable.
    final halo = [Shadow(color: colors.ground.withValues(alpha: colors.isNight ? 0.85 : 0.9), blurRadius: 10)];
    final title = Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Flexible(
          child: Text(
            name,
            style: type.screenTitle.copyWith(color: colors.ink, shadows: halo),
          ),
        ),
        if (onSwitch != null) ...[const SizedBox(width: MmSpace.s4), Icon(LucideIcons.chevronDown, size: 20, color: colors.ink2)],
      ],
    );
    final block = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(header: true, child: title),
        const SizedBox(height: MmSpace.s2),
        Text(
          subtitle,
          style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600, shadows: [...halo, ...halo]),
        ),
      ],
    );
    if (onSwitch == null) return block;
    return MmPressable(
      onTap: onSwitch,
      semanticsLabel: '$name. $subtitle. ${MobV3Copy.switchMob}',
      pressedScale: 0.98,
      haptic: MmPressHaptic.selection,
      focusRadius: BorderRadius.circular(MmRadius.small),
      builder: (context, pressed, _) => block,
    );
  }
}

/// K5: the inline pass notice ("Friday was covered by a rest pass. Your chain is still 12."), a paper
/// note with a moon glyph. It slides in on glide and leaves on its own.
class _PassNotice extends StatelessWidget {
  const _PassNotice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final reduced = Motion.reduced(context);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: reduced ? MotionDurations.reducedFade : MotionDurations.glide,
      curve: MotionCurves.glide,
      builder: (context, v, child) => Opacity(
        opacity: v,
        child: Transform.translate(offset: Offset(0, reduced ? 0 : 8 * (1 - v)), child: child),
      ),
      child: Semantics(
        liveRegion: true,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
          decoration: BoxDecoration(
            color: colors.raised,
            borderRadius: MmRadius.keyAll,
            border: Border.all(color: colors.line),
          ),
          child: Row(
            children: [
              CustomPaint(
                size: const Size(18, 18),
                painter: _MoonGlyph(colour: colors.lamp),
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Text(text, style: type.body.copyWith(color: colors.ink)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MoonGlyph extends CustomPainter {
  _MoonGlyph({required this.colour});

  final Color colour;

  @override
  void paint(Canvas canvas, Size s) {
    final r = s.width * 0.42;
    final c = s.center(Offset.zero);
    final moon = Path.combine(
      PathOperation.difference,
      Path()..addOval(Rect.fromCircle(center: c, radius: r)),
      Path()..addOval(Rect.fromCircle(center: c.translate(r * 0.55, -r * 0.35), radius: r * 0.85)),
    );
    canvas.drawPath(moon, Paint()..color = colour);
  }

  @override
  bool shouldRepaint(_MoonGlyph old) => old.colour != colour;
}
