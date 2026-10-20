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
//
// The event acts (MOB-MINIMAL 4.2, logic/den_acts.dart): a friend who joined since this phone last saw the den hops
// in from the edge, and a friend's new sticker makes the Mob cheer. Each plays once, one at a time with a quiet beat
// between, after Enter the den and never under the results run or a sheet. A first open of a Mob plays none.

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
import '../../data/mob_models.dart';
import '../../data/mob_repository.dart';
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/den_acts.dart';
import '../logic/den_copy_state.dart';
import '../logic/moment_queue.dart';
import '../widgets/den_cards.dart';
import '../widgets/den_stage.dart';
import '../widgets/fold_acts.dart' show DenActKind, DenActPlayer;
import '../widgets/fold_manifest.dart';
import '../widgets/mob_fx.dart';
import '../widgets/this_week_panel.dart';
import '../widgets/v4_sheet_hooks.dart';
import '../widgets/your_mobs_sheet.dart';
import '../widgets/sticker_row.dart';
import 'den_start_screen.dart';
import 'results_run.dart';

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

  /// Who stands on the desk, kept for one exit pass after `studying_now` empties (4.2), and the Mob it is in.
  (StudyingNow?, MobV3Member?)? _desk;
  bool _deskLeaving = false;
  String? _deskMob;
  Timer? _noticeTimer;
  final List<StickerSend> _flights = [];
  StickerBus? _bus;
  int _flightIds = 100000;

  // The event acts (4.2): the clock of the act playing, the queue, and this phone's memory of the Mob on screen.
  late final AnimationController _actClock = AnimationController(vsync: this);
  DenActCue? _cue;
  DenEvent? _cueEvent;
  final List<DenEvent> _acts = [];
  Timer? _actTimer;
  int _actIds = 0;
  String? _actMob;

  /// The den as this visit first drew it: the memory of a Mob this phone has never opened (no flood).
  DenActMemory? _firstSeen;

  /// This phone's memory of the Mob, once read.
  DenActMemory? _actMemory;
  MobV3? _actSeenV3;

  bool get _reduced => MobFx.reduced(context);
  DenSessionMemory get _memory => ref.read(denSessionMemoryProvider);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    DenScreen.debugReplay.addListener(_replay);
    ResultsRun.onScreen.addListener(_pumpActs);
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
    ResultsRun.onScreen.removeListener(_pumpActs);
    _bus?.removeListener(_onBus);
    _noticeTimer?.cancel();
    _actTimer?.cancel();
    _actClock.dispose();
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
    _enter.stop();
    _enter.value = 0;
    final run = ++_enterRun;
    // M1 plays its full 1100 ms only once the room is on screen: started before the art had decoded,
    // the first half ran over an empty room (a blank cream frame in Day) and the walk saw 0.5 s (M3).
    // Held at its first frame (the dim room) for at most [EnterDen.waitForArt].
    unawaited(_roomReady().then((_) {
      if (!mounted || run != _enterRun) return;
      _enter.forward(from: 0);
    }));
    if (!inBuild) setState(() {});
  }

  int _enterRun = 0;

  /// The room art and the Folds are decoded (or [EnterDen.waitForArt] passed).
  Future<void> _roomReady() async {
    final night = context.mmColors.isNight;
    final view = ref.read(denViewProvider);
    final folds = [for (final m in view?.v3.members ?? const <MobV3Member>[]) m.fold];
    final ready = Future.wait<void>([
      precacheImage(AssetImage(denRoomArt(night)), context).catchError((Object _) {}),
      precacheFolds(context, folds).catchError((Object _) {}),
    ]);
    await Future.any<void>([ready, Future<void>.delayed(EnterDen.waitForArt)]);
  }

  bool _visible() {
    if (!mounted) return false;
    if (!TickerMode.valuesOf(context).enabled) return false;
    return ModalRoute.of(context)?.isCurrent ?? true;
  }

  /// After Enter the den: fly recent stickers from friends, then the moment queue, then the event acts and K5.
  Future<void> _afterEnter() async {
    if (!mounted) return;
    _entered = true;
    _flyRecentReactions();
    await _runMoments();
    _pumpActs();
    if (mounted) await _maybeNotice();
  }

  // ---- The event acts (4.2) -------------------------------------------------------------------------------------

  /// Keeps the act memory on the Mob on screen. Runs in build: a Mob seen for the first time in this visit is
  /// remembered as first drawn, and its phone memory is read.
  void _syncActs(String mobId, MobV3 v3) {
    if (mobId != _actMob) {
      _actTimer?.cancel();
      _actTimer = null;
      _acts.clear();
      _actClock.stop();
      _cue = null;
      _cueEvent = null;
      _actMob = mobId;
      _firstSeen = DenActs.baseline(v3);
      _actMemory = null;
      _actSeenV3 = null;
      final book = ref.read(denActBookProvider);
      unawaited(book.load(mobId).then((stored) => _onActMemory(mobId, stored)));
    }
    if (!identical(v3, _actSeenV3) && _actMemory != null) {
      _actSeenV3 = v3;
      WidgetsBinding.instance.addPostFrameCallback((_) => _detectActs());
    }
  }

  void _onActMemory(String mobId, DenActMemory? stored) {
    if (!mounted || mobId != _actMob) return;
    final memory = stored ?? _firstSeen!;
    // A first open: everyone the den first drew is already there, and every sticker in it already seen.
    if (stored == null) unawaited(ref.read(denActBookProvider).save(mobId, memory));
    setState(() => _actMemory = memory);
  }

  /// Newcomers whose join act has not played: they keep their seat until it does.
  Set<String> _waitingFor(MobV3 v3) {
    final memory = _actMemory ?? _firstSeen;
    if (memory == null) return const {};
    final out = DenActs.newcomers(v3, memory);
    if (_cueEvent?.kind == DenEventKind.join) out.remove(_cueEvent!.memberId);
    return out;
  }

  /// Reads the events in the den since this phone last saw it and queues their acts.
  void _detectActs() {
    final mobId = _actMob;
    final view = ref.read(denViewProvider);
    var memory = _actMemory;
    if (!mounted || mobId == null || memory == null || view == null || view.mobId != mobId) return;
    final v3 = view.v3;
    final now = ref.read(denClockProvider)();
    final before = memory.encode();
    memory = DenActs.tidy(memory, v3, now: now);
    final found = DenActs.eventsSince(v3, memory, now: now);
    for (final e in found.skipped) {
      memory = DenActs.played(memory!, e);
    }
    final playing = _cueEvent?.key;
    var changed = false;
    for (final e in found.events) {
      if (e.key == playing || _acts.contains(e)) continue;
      if (e.kind == DenEventKind.reaction) {
        // One cheer waits at a time: the newest sticker leads it.
        _acts.removeWhere((x) => x.kind == DenEventKind.reaction);
      } else if (_cueEvent?.kind == DenEventKind.join && _cueEvent!.memberId == e.memberId) {
        continue;
      }
      _acts.add(e);
      changed = true;
      // The stills the act will show, decoded in the beat before it, so no pose swap ever draws an empty frame.
      final folds = e.kind == DenEventKind.join ? [v3.member(e.memberId)?.fold] : [for (final m in v3.members) m.fold];
      for (final pose in e.kind == DenEventKind.join ? const [FoldPose.idle, FoldPose.wave] : const [FoldPose.cheer]) {
        unawaited(precacheFolds(context, folds, pose: pose).catchError((Object _) {}));
      }
    }
    // Joins first (in join order), then the cheer; never more than the cap waiting.
    final ordered = [for (final e in _acts) if (e.kind == DenEventKind.join) e, for (final e in _acts) if (e.kind == DenEventKind.reaction) e];
    _acts
      ..clear()
      ..addAll(ordered);
    while (_acts.length > DenActs.maxQueue) {
      final dropped = _acts.removeAt(0);
      memory = DenActs.played(memory!, dropped);
      changed = true;
    }
    if (memory!.encode() != before) {
      _actMemory = memory;
      unawaited(ref.read(denActBookProvider).save(mobId, memory));
      changed = true;
    }
    if (changed) setState(() {});
    _pumpActs();
  }

  /// Acts wait for Enter the den, the moment queue, any results run, a sheet or another screen on top, and a hidden
  /// tab. While they wait the den checks again every 600 ms.
  bool get _actsHeld => !_entered || _queueRunning || ResultsRun.onScreen.value > 0 || !_visible();

  void _pumpActs() {
    if (!mounted || _cue != null || _actTimer != null || _acts.isEmpty) return;
    if (_actsHeld) {
      // A hidden tab does not poll: the den's return (didChangeDependencies, then _afterEnter) picks the queue up.
      if (!TickerMode.valuesOf(context).enabled) return;
      _actTimer = Timer(const Duration(milliseconds: 600), () {
        _actTimer = null;
        _pumpActs();
      });
      return;
    }
    // A quiet beat before every act.
    _actTimer = Timer(DenActs.gap, _startAct);
  }

  void _startAct() {
    _actTimer = null;
    if (!mounted || _cue != null || _acts.isEmpty) return;
    if (_actsHeld) return _pumpActs();
    final view = ref.read(denViewProvider);
    final mobId = _actMob;
    final memory = _actMemory;
    if (view == null || mobId == null || memory == null || view.mobId != mobId) return;
    final e = _acts.removeAt(0);
    // The friend left before their act: nothing to play.
    if (view.v3.member(e.memberId) == null) return _pumpActs();
    // Remembered as played when it starts: each event plays once.
    _actMemory = DenActs.played(memory, e);
    unawaited(ref.read(denActBookProvider).save(mobId, _actMemory!));
    final reduced = _reduced;
    final kind = e.kind == DenEventKind.join ? DenActKind.join : DenActKind.reaction;
    final (_, studier) = _desk ?? DenStage.studierOf(view.v3);
    final waiting = _waitingFor(view.v3);
    final cheering = [for (final m in view.v3.members) if (!waiting.contains(m.memberId) && m.memberId != studier?.memberId) m].length;
    final length = DenActPlayer.lengthFor(kind, reduced: reduced, members: cheering);
    _actClock.duration = Duration(milliseconds: length.round());
    setState(() {
      _cueEvent = e;
      _cue = DenActCue(kind: kind, memberId: e.memberId, id: ++_actIds, clock: _actClock, members: math.max(1, cheering));
      // The sticker behind a cheer flies from its sender's Fold as the cheer starts (once a session, as every flight).
      if (e.kind == DenEventKind.reaction && e.sticker != null && e.at != null) {
        if (_memory.flownReactions.add(_flightKey(e.memberId, e.sticker!, e.at!))) {
          _flights.add(StickerSend(memberId: e.memberId, kind: e.sticker!, id: ++_flightIds));
          _trimFlights();
        }
      }
    });
    _actClock.forward(from: 0).whenCompleteOrCancel(() {
      if (!mounted) return;
      setState(() {
        _cue = null;
        _cueEvent = null;
      });
      _pumpActs();
    });
  }

  static String _flightKey(String memberId, StickerKind kind, DateTime at) => '$memberId:${kind.wire}:${at.toIso8601String()}';

  /// Achievements earned outside a game (quest done, week stitched, a Fold earned, a streak milestone) play as the
  /// results run's own celebration screens (spec 3.4: the same screens everywhere), only while the den is in view.
  Future<void> _runMoments() async {
    if (_queueRunning || !_visible()) return;
    if (ref.read(denViewProvider) == null) return;
    _queueRunning = true;
    try {
      final shown = await ResultsRun.showPending(context);
      if (shown.isNotEmpty && mounted) {
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
    // A sticker waiting to lead a cheer flies with the cheer instead.
    final held = {
      for (final e in [?_cueEvent, ..._acts])
        if (e.kind == DenEventKind.reaction && e.sticker != null && e.at != null) _flightKey(e.memberId, e.sticker!, e.at!),
    };
    final fresh = <Reaction>[];
    for (final r in view.v3.reactions) {
      if (r.memberId == you) continue;
      final at = r.at;
      if (at == null || now.difference(at) > const Duration(hours: 12)) continue;
      final key = _flightKey(r.memberId, r.kind, at);
      if (held.contains(key)) continue;
      if (!_memory.flownReactions.add(key)) continue;
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

  /// A11: the chevron by the Mob name always opens Your Mobs; switching fades through (M13).
  Future<void> _openYourMobs() => showYourMobsSheet(context, onSwitch: _switchTo);

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
        final mob = view?.mob;
        final v3 = view?.v3;
        // The stage keeps its 280 dp for the Folds; the tag band under their boots only keeps the room
        // its names need (two lines at large text, a second caption line in a Mob of one). The rest
        // goes to the card, so its key is on screen on first view at 360 dp (H5).
        final tagNeed = MediaQuery.textScalerOf(context).scale(18) * ((v3?.members.length ?? 2) <= 1 ? 2 : 1) + 14;
        final spare = (DenSizes.tagBand - tagNeed).clamp(0.0, DenSizes.tagBand);
        final roomH = stageTop + DenSizes.stageHeight(w) - spare;
        final loading = view == null && state.value == null && state.error == null;
        final failed = view == null && !loading;
        final now = ref.watch(denClockProvider)();

        // The desk's memory: a studier stays on the desk for one exit pass after the server stops listing them.
        if (v3 == null || mob?.id != _deskMob) {
          _desk = null;
          _deskLeaving = false;
        }
        _deskMob = mob?.id;
        final studyingNow = DenStage.studierOf(v3);
        if (studyingNow.$1 != null) {
          _desk = studyingNow;
          _deskLeaving = false;
        } else if (_desk != null) {
          final id = _desk!.$2?.memberId;
          final still = v3 != null && v3.members.length > 1 && v3.members.any((m) => m.memberId == id);
          if (still) {
            _deskLeaving = true;
          } else {
            _desk = null;
            _deskLeaving = false;
          }
        }
        final deskBusy = _desk != null;
        if (mob != null && v3 != null) _syncActs(mob.id, v3);
        final waiting = v3 == null ? const <String>{} : _waitingFor(v3);

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
              onPennant: () => V4Sheets.thisWeek(context),
              onShelf: () => V4Sheets.shelf(context),
              onOpenSeat: () => V4Sheets.invite(context),
              now: now,
              desk: _desk ?? (null, null),
              deskLeaving: _deskLeaving,
              onDeskLeft: () {
                if (mounted) {
                  setState(() {
                    _desk = null;
                    _deskLeaving = false;
                  });
                }
              },
              act: _cue,
              waiting: waiting,
            ),
            if (mob != null && v3 != null)
              AnimatedPositioned(
                duration: _reduced ? Duration.zero : DenStage.reflow,
                curve: MotionCurves.glide,
                left: MmSpace.gutter,
                top: stageTop + MmSpace.s2,
                // At least 12 dp between the title block and the pennant.
                width: math.max(150, DenStage.pennantLeft(w, studying: deskBusy) - MmSpace.gutter - MmSpace.s12),
                child: _TitleBlock(
                  name: v3.name.text.isEmpty ? mob.subjectName : v3.name.text,
                  // A newcomer waiting for their act is not counted until they hop in.
                  subtitle: MobV4DenCopy.subtitle(mob.subjectName, v3.members.length - waiting.length),
                  onSwitch: _openYourMobs,
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
          // Mobi rises out of the empty-den card: the card starts lower so his antenna stays clear of the name
          // tags (also at 1.3x text, where the tags grow).
          if (card.kind == DenCardKind.quiet) below.add(const SizedBox(height: MmSpace.s24));
          below.add(
            _Rise(
              ms: _ms,
              at: EnterDen.cardAt,
              child: DenCardView(key: ValueKey('${mob.id}:${card.kind.name}:${card.game?.id}'), card: card, v3: v3, mob: mob, now: now),
            ),
          );
          below
            ..add(const SizedBox(height: MmSpace.s12))
            ..add(_Rise(ms: _ms, at: EnterDen.questAt, child: DenRows(card: card, v3: v3, mob: mob, now: now)));
          below
            ..add(const SizedBox(height: MmSpace.s20))
            ..add(
              _Rise(
                ms: _ms,
                at: EnterDen.questAt,
                child: ThisWeekPanel(v3: v3, onTap: () => V4Sheets.thisWeek(context)),
              ),
            );
          // Your shelf (3.1 item 6, D170): the den's entry to the Shelf, last in the list.
          below
            ..add(const SizedBox(height: MmSpace.s12))
            ..add(_Rise(ms: _ms, at: EnterDen.questAt, child: const DenShelfRow()));
          // K5's pass notice goes last, out of the way of the rows: Start a game never moves (3.1 item 4), and
          // nothing sits below it to jump when it leaves. It fades and folds away (240 ms; reduced: at once).
          final notice = _noticeText == null
              ? const SizedBox(key: ValueKey('den-pass-notice-none'), width: double.infinity)
              : Padding(
                  key: ValueKey('den-pass-notice-$_noticeText'),
                  padding: const EdgeInsets.only(top: MmSpace.s16),
                  child: _PassNotice(key: const ValueKey('den-pass-notice'), text: _noticeText!),
                );
          below.add(
            _reduced
                ? notice
                : AnimatedSize(
                    key: const ValueKey('den-pass-notice-slot'),
                    duration: MotionDurations.card,
                    curve: MotionCurves.glide,
                    alignment: Alignment.topCenter,
                    child: AnimatedSwitcher(duration: MotionDurations.card, child: notice),
                  ),
          );
        }

        final content = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            room,
            Padding(
              padding: EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s48 + bottom),
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
        // Both streaks (D173 item 6): your daily chain here, the Mob's weekly pennant on the stage. Ask Mobi is
        // not in the den (V4 2.2); it stays on Today and inside Fix it together.
        // The chip takes the room between the keys, right-aligned; when the row is tight (large text) its label
        // fades first, the days never do.
        Expanded(
          child: Align(
            alignment: Alignment.centerRight,
            child: c != null && !c.hidden ? ChainChipKey(key: const ValueKey('den-chain-chip'), days: c.days, onTap: () => YourChainSheet.show(context)) : const SizedBox.shrink(),
          ),
        ),
        if (c != null && !c.hidden) const SizedBox(width: MmSpace.s4),
        _RoundKey(key: const ValueKey('den-settings'), icon: LucideIcons.settings, label: MobV3Copy.settingsSemantics, onTap: () => V4Sheets.mobSettings(context)),
      ],
    );
  }
}

class _RoundKey extends StatelessWidget {
  const _RoundKey({super.key, required this.icon, required this.label, required this.onTap});

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
                // Whose streak this is, in words (MOB-V4-BUILD override 3): the Mob's is the pennant.
                Flexible(child: Text(MobV4DenCopy.yourChainLabel, key: const ValueKey('den-chain-label'), maxLines: 1, softWrap: false, overflow: TextOverflow.fade, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600))),
                const SizedBox(width: MmSpace.s8),
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
    // The name scales down to 0.8; past that it takes a second line (the Mob's own name is never cut to
    // "Accountan..." in its own den) and the subtitle moves down. The chevron follows the text.
    final title = _FitLine(
      text: name,
      wrap: true,
      style: type.screenTitle.copyWith(color: colors.ink, shadows: halo),
      trailing: onSwitch == null ? null : Padding(padding: const EdgeInsets.only(left: MmSpace.s4), child: Icon(LucideIcons.chevronDown, size: 22, color: colors.ink)),
      trailingWidth: onSwitch == null ? 0 : 26,
    );
    final block = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(header: true, child: title),
        const SizedBox(height: MmSpace.s2),
        _FitLine(
          text: subtitle,
          // Label size, not caption: readable over the lit room at 360 dp (M1 owner note).
          style: type.label.copyWith(color: colors.isNight ? colors.ink2 : colors.ink, fontWeight: FontWeight.w600, shadows: [...halo, ...halo]),
        ),
      ],
    );
    if (onSwitch == null) return block;
    return MmPressable(
      onTap: onSwitch,
      key: const ValueKey('den-your-mobs'),
      semanticsLabel: MobV4DenCopy.titleSemantics(name, subtitle),
      pressedScale: 0.98,
      haptic: MmPressHaptic.selection,
      focusRadius: BorderRadius.circular(MmRadius.small),
      builder: (context, pressed, _) => block,
    );
  }
}

/// One line of text that scales down to [floor] of its size before it ends in an ellipsis; [trailing] follows it.
class _FitLine extends StatelessWidget {
  const _FitLine({required this.text, required this.style, this.trailing, this.trailingWidth = 0, this.wrap = false});

  /// Past the floor, take a second line instead of an ellipsis.
  final bool wrap;

  final String text;
  final TextStyle style;
  final Widget? trailing;
  final double trailingWidth;

  static const double floor = 0.8;

  /// Two-line titles only: how far one very long word may shrink so it is never split mid-word.
  static const double wordFloor = 0.7;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final avail = box.maxWidth - trailingWidth;
        final tp = TextPainter(text: TextSpan(text: text, style: style), textDirection: Directionality.of(context), textScaler: MediaQuery.textScalerOf(context), maxLines: 1)..layout();
        final natural = tp.width;
        tp.dispose();
        final fits = natural <= avail || natural <= 0;
        final twoLines = wrap && !fits && avail / natural < floor;
        var k = fits ? 1.0 : math.max(floor, avail / natural);
        if (twoLines) {
          // Two lines break between words, with the chevron riding at the end of the last line (so each line has
          // the full width). The longest word, and the last word with the chevron, must fit a line: they set the
          // size, down to [wordFloor] for one very long word.
          final words = text.split(' ');
          var longest = 0.0;
          for (var i = 0; i < words.length; i++) {
            final wp = TextPainter(text: TextSpan(text: words[i], style: style), textDirection: Directionality.of(context), textScaler: MediaQuery.textScalerOf(context), maxLines: 1)..layout();
            longest = math.max(longest, wp.width + (i == words.length - 1 ? trailingWidth : 0));
            wp.dispose();
          }
          final full = box.maxWidth;
          k = longest <= full || longest <= 0 ? 1.0 : math.max(wordFloor, full / longest);
        }
        final sized = k == 1 ? style : style.copyWith(fontSize: (style.fontSize ?? 14) * k);
        if (twoLines && trailing != null) {
          return Text.rich(
            TextSpan(text: text, style: sized, children: [WidgetSpan(alignment: PlaceholderAlignment.middle, child: trailing!)]),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          );
        }
        final line = Text(
          text,
          maxLines: twoLines ? 2 : 1,
          softWrap: twoLines,
          overflow: TextOverflow.ellipsis,
          style: sized,
        );
        if (trailing == null) return line;
        return Row(mainAxisSize: MainAxisSize.min, children: [Flexible(child: line), trailing!]);
      },
    );
  }
}

/// K5: the inline pass notice ("Friday was covered by a rest pass. Your chain is still 12."), a paper
/// note with a moon glyph. It slides in on glide and leaves on its own.
class _PassNotice extends StatelessWidget {
  const _PassNotice({super.key, required this.text});

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
