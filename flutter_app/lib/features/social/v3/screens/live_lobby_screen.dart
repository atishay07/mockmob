// L1, the live lobby (MOB-BUILD-SPEC-V3 5.3 L1, 5.6 M2; Live 08 "Ready up"; the den v2 S7 "Kabir is here
// now"). Reached only from the den's "Join Riya's room" or the start sheet's "Open the room", and only
// when the server says live is on. There is no code (F12): the room is Mob-only.
//
// What a first-time student sees:
// - "Riya's room", "Live sprint, 5 questions", a lamp-coloured "Live" dot;
// - the lamp-lit room with the Folds of whoever is HERE (presence only), each tagged "Host", "Here" or
//   "Ready", and a dashed "Open seat" for each member who is not here (no names);
// - when a friend arrives: their Fold hops in and the line reads "Kabir is here now." for a few seconds;
// - "Same 5 questions, same start. You see where friends are, never what they picked.";
// - "Send a sticker": Good luck, Let's go, One sec, Ready (they fly over the sender's Fold);
// - a guest: "I'm ready", then the quiet "Waiting for Riya to start"; the host: "Start for everyone",
//   "Start when everyone here is ready.";
// - "Play it later instead" (the game stays open 24 hours).
// When the host starts, the run screen takes the room over and plays the countdown so Go lands on the
// server's `startsAt`.
//
// R2: "Tap ready; Riya starts it."

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../data/mob_room_channel.dart';
import '../data/mob_v3_api.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/live_room.dart';
import '../widgets/countdown_stopwatch.dart' show RunHeadDisc;
import '../widgets/lobby_stage.dart';
import '../widgets/mob_fx.dart';
import '../widgets/sticker_row.dart';
import 'game_run_screen.dart';

/// The go-live wash (M2): a volt circle from the key that covers at most 40% of the screen at 22%
/// (Night) or 30% (Day) and is gone by 900 ms.
abstract final class GoLiveWash {
  static const double total = 900;
  static const double growAt = 180;
  static const double growEnd = 540;

  /// The radius whose full circle is 40% of the screen: centred on the key, at most that much shows.
  static double maxRadius(Size screen) => math.sqrt(0.40 * screen.width * screen.height / math.pi);

  /// (radius share 0 to 1, opacity share 0 to 1) at [ms].
  static ({double r, double o}) frame(double ms) {
    if (ms < growAt) return (r: 0, o: 0);
    if (ms < growEnd) return (r: Motion.out.transform((ms - growAt) / (growEnd - growAt)), o: 1);
    if (ms < total) return (r: 1, o: 1 - Motion.leave.transform((ms - growEnd) / (total - growEnd)));
    return (r: 1, o: 0);
  }

  static double alpha(bool night) => night ? 0.22 : 0.30;
}

class LiveLobbyScreen extends ConsumerStatefulWidget {
  const LiveLobbyScreen({super.key, required this.gameId, this.opened = false});

  final String gameId;

  /// You just opened this room from the start sheet: the go-live wash plays.
  final bool opened;

  /// The lobby lets go of the channel this long after the last tap (spec 4.5).
  static const Duration idle = Duration(minutes: 10);

  @override
  ConsumerState<LiveLobbyScreen> createState() => _LiveLobbyScreenState();
}

class _LiveLobbyScreenState extends ConsumerState<LiveLobbyScreen> with TickerProviderStateMixin {
  late final LiveRoom _room;
  bool _handedOver = false;
  bool _starting = false;
  String? _note;
  Timer? _idle;
  Timer? _arrivalTimer;
  String? _arrival;
  int _arrivalsSeen = 0;
  late final AnimationController _wash;
  late final AnimationController _line;

  @override
  void initState() {
    super.initState();
    _wash = AnimationController(vsync: this, duration: Duration(milliseconds: GoLiveWash.total.round()));
    _line = AnimationController(vsync: this, duration: const Duration(milliseconds: 280), value: 1);
    final den = ref.read(denViewProvider);
    _room = LiveRoom(
      gameId: widget.gameId,
      api: ref.read(mobV3ApiProvider),
      channel: ref.read(mobRoomChannelFactoryProvider)(widget.gameId),
      members: den?.v3.members ?? const [],
      clock: ref.read(mobLiveClockProvider),
    )..addListener(_onRoom);
    _bumpIdle();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.opened && !MobFx.reduced(context)) _wash.forward(from: 0);
      _room.open();
    });
  }

  @override
  void dispose() {
    _idle?.cancel();
    _arrivalTimer?.cancel();
    _room.removeListener(_onRoom);
    if (!_handedOver) _room.dispose();
    _wash.dispose();
    _line.dispose();
    super.dispose();
  }

  void _bumpIdle() {
    _idle?.cancel();
    _idle = Timer(LiveLobbyScreen.idle, () {
      if (!mounted || _handedOver) return;
      _room.leave();
      Navigator.of(context).maybePop();
    });
  }

  void _onRoom() {
    if (!mounted) return;
    if (_room.phase == LivePhase.started && !_handedOver) {
      _handOver();
      return;
    }
    if (_room.arrivals != _arrivalsSeen) {
      _arrivalsSeen = _room.arrivals;
      final id = _room.arrivalId;
      if (id != null && _room.present.containsKey(id)) {
        _arrival = id;
        hapticsOf(context)?.selection();
        _line.forward(from: MobFx.reduced(context) ? 1 : 0);
        _arrivalTimer?.cancel();
        _arrivalTimer = Timer(const Duration(seconds: 4), () {
          if (!mounted) return;
          setState(() => _arrival = null);
          _line.forward(from: MobFx.reduced(context) ? 1 : 0);
        });
      }
    }
    setState(() {});
  }

  /// The host started: the run screen takes the room (and its channel) over.
  void _handOver() {
    _handedOver = true;
    _idle?.cancel();
    _room.removeListener(_onRoom);
    Navigator.of(context).pushReplacement(
      PageRouteBuilder<void>(
        settings: RouteSettings(name: '/mob/game/${widget.gameId}/run'),
        transitionDuration: const Duration(milliseconds: 200),
        pageBuilder: (_, _, _) => GameRunScreen(gameId: widget.gameId, live: _room),
        transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: a, child: child),
      ),
    );
  }

  Future<void> _ready() async {
    _bumpIdle();
    await _room.ready();
  }

  Future<void> _start() async {
    if (_starting) return;
    _bumpIdle();
    setState(() {
      _starting = true;
      _note = null;
    });
    try {
      await _room.start();
    } on Object catch (e) {
      if (!mounted) return;
      setState(() {
        _starting = false;
        _note = MobV3Copy.error(e);
      });
    }
  }

  Future<void> _playLater() async {
    await _room.leave();
    if (mounted) Navigator.of(context).maybePop();
  }

  /// Play the same game now, anytime-style (the room was closed, or live is busy).
  Future<void> _playNow() async {
    await _room.leave();
    if (!mounted) return;
    _handedOver = true;
    _room.dispose();
    Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => GameRunScreen(gameId: widget.gameId), settings: RouteSettings(name: '/mob/game/${widget.gameId}/run')));
  }

  Future<void> _close() async {
    _bumpIdle();
    final room = _room;
    if (!room.youHost || room.phase != LivePhase.lobby) {
      await _playLater();
      return;
    }
    final closes = room.game?.closesAt;
    final close = await showMmSheet<bool>(
      context: context,
      title: MobV3Copy.closeRoomTitle,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.sheetSide),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (closes != null) Text(MobV3Copy.closeRoomLine(closes, room.serverNow()), style: sheet.mmType.body.copyWith(color: sheet.mmColors.ink2)),
            const SizedBox(height: MmSpace.s20),
            KeyButton(label: MobV3Copy.keepRoomOpen, onPressed: () => Navigator.of(sheet).pop(false)),
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(label: MobV3Copy.closeRoom, onPressed: () => Navigator.of(sheet).pop(true)),
            const SizedBox(height: MmSpace.s16),
          ],
        ),
      ),
    );
    if (close != true || !mounted) return;
    try {
      await room.cancel();
      await ref.read(mobV3ActionsProvider).refresh();
    } on Object catch (e) {
      if (mounted) setState(() => _note = MobV3Copy.error(e));
      return;
    }
    if (mounted) Navigator.of(context).maybePop();
  }

  // ---- Build ---------------------------------------------------------------------------------------

  List<LobbySeat> _seats() {
    final room = _room;
    final hostId = room.hostId;
    final ids = room.present.keys.toList();
    final order = <String>[
      if (hostId != null && ids.contains(hostId) && hostId != room.youId) hostId,
      for (final m in room.members)
        if (ids.contains(m.memberId) && m.memberId != hostId && m.memberId != room.youId) m.memberId,
      if (ids.contains(room.youId)) room.youId,
    ];
    return [
      for (final id in order)
        if (room.member(id) case final m?)
          LobbySeat(memberId: id, name: m.name, fold: m.fold, colour: m.colour, status: room.present[id]!, host: id == hostId, you: id == room.youId),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final room = _room;
    return Listener(
      onPointerDown: (_) => _bumpIdle(),
      child: Scaffold(
        backgroundColor: colors.ground,
        body: Stack(
          children: [
            SafeArea(
              child: MobIdleScope(
                child: Column(
                  children: [
                    _header(context),
                    Expanded(child: room.phase == LivePhase.opening ? _opening(context) : _body(context)),
                  ],
                ),
              ),
            ),
            if (widget.opened) Positioned.fill(child: IgnorePointer(child: _washLayer(context))),
          ],
        ),
      ),
    );
  }

  Widget _washLayer(BuildContext context) {
    return AnimatedBuilder(
      animation: _wash,
      builder: (context, _) {
        final f = GoLiveWash.frame(_wash.value * GoLiveWash.total);
        if (f.o <= 0) return const SizedBox.shrink();
        return CustomPaint(painter: _WashPainter(share: f.r, opacity: f.o * GoLiveWash.alpha(context.mmColors.isNight), colour: context.mmColors.volt));
      },
    );
  }

  Widget _header(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final room = _room;
    final game = room.game;
    final title = game == null ? '' : MobV3Copy.roomTitle(room.hostName, you: room.youHost);
    final sub = game == null ? '' : MobV3Copy.roomSub(game.format, game.count);
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s8, MmSpace.gutter, MmSpace.s8),
      child: Row(
        children: [
          IconButton(
            key: const ValueKey('lobby-close'),
            tooltip: room.youHost ? MobV3Copy.closeRoom : MobV3Copy.leaveRoom,
            onPressed: _close,
            icon: Icon(LucideIcons.x, color: colors.ink, size: 24),
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          ),
          const SizedBox(width: MmSpace.s4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, key: const ValueKey('lobby-title'), style: type.title.copyWith(color: colors.ink, fontSize: 20, height: 24 / 20)),
                if (sub.isNotEmpty) Text(sub, style: type.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
          if (game != null) const _LiveDot(),
        ],
      ),
    );
  }

  Widget _opening(BuildContext context) {
    return SkeletonGroup(
      label: MobV3Copy.openingRoom,
      child: const Padding(
        padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton(height: LobbyStage.height, radius: MmRadius.panel),
            SizedBox(height: MmSpace.s24),
            Skeleton(height: 18, width: 220),
            SizedBox(height: MmSpace.s8),
            Skeleton(height: 18),
          ],
        ),
      ),
    );
  }

  Widget _body(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final room = _room;
    final game = room.game;
    final now = room.serverNow();
    final closes = game?.closesAt;

    // Ended states: one sentence and the way on.
    String? ended;
    if (room.phase == LivePhase.failed) ended = MobV3Copy.error(room.error ?? '');
    if (room.phase == LivePhase.cancelled && closes != null) ended = room.youHost ? MobV3Copy.roomClosedYou(closes, now) : MobV3Copy.roomClosed(room.hostName, closes, now);
    if (room.phase == LivePhase.done) ended = MobV3Copy.podiumAfterRoom;
    if (ended == null && room.busy && room.phase == LivePhase.lobby) ended = MobV3Copy.liveBusyRun;
    if (ended != null) {
      final closed = MobV3Copy.codeOf(room.error ?? '') == 'GAME_CLOSED';
      return Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s24, MmSpace.gutter, MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(),
            Text(ended, key: const ValueKey('lobby-ended'), textAlign: TextAlign.center, style: type.lead.copyWith(color: colors.ink)),
            const Spacer(),
            if (!closed && room.phase != LivePhase.done) ...[
              KeyButton(key: const ValueKey('lobby-play-now'), label: MobV3Copy.playItNow, onPressed: _playNow),
              const SizedBox(height: MmSpace.s8),
            ],
            KeyButton.secondary(label: MobV3Copy.backToDen, onPressed: () => Navigator.of(context).maybePop()),
          ],
        ),
      );
    }

    final seats = _seats();
    final open = math.max(0, room.members.length - seats.length);
    final n = game?.count ?? 5;

    // The line under the stage: an arrival first, then the host stepping away, then only you, then the rule.
    String? lineTitle;
    String line = MobV3Copy.lobbyLine(n);
    final arrival = _arrival;
    if (arrival != null && room.present.containsKey(arrival)) {
      final name = room.nameOf(arrival);
      lineTitle = MobV3Copy.isHereNow(name);
      line = MobV3Copy.isHereNowLine(name);
    } else if (room.hostAway && closes != null) {
      line = MobV3Copy.hostAway(room.hostName, null, closes, now);
    } else if (room.onlyYou) {
      line = MobV3Copy.onlyYouHere;
    }
    final arrivalMember = arrival == null ? null : room.member(arrival);

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LobbyStage(seats: seats, openSeats: open, stickers: List.of(room.stickers)),
                Padding(
                  padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
                  child: FadeTransition(
                    opacity: _line,
                    child: Semantics(
                      liveRegion: true,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (arrivalMember != null && lineTitle != null) ...[
                            RunHeadDisc(fold: arrivalMember.fold, colour: arrivalMember.colour, name: arrivalMember.name, size: 44),
                            const SizedBox(width: MmSpace.s12),
                          ],
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (lineTitle != null) Text(lineTitle, key: const ValueKey('lobby-arrival'), style: type.cardTitle.copyWith(color: colors.ink)),
                                Text(line, key: const ValueKey('lobby-line'), style: type.body.copyWith(color: colors.ink2)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: MmSpace.s20),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                  child: _LobbyStickers(gameId: widget.gameId, onSent: room.showOwnSticker),
                ),
              ],
            ),
          ),
        ),
        _keys(context),
      ],
    );
  }

  Widget _keys(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final room = _room;
    final List<Widget> keys;
    if (room.youHost) {
      keys = [
        KeyButton(key: const ValueKey('lobby-start'), label: MobV3Copy.startForEveryone, loading: _starting, onPressed: _start),
        const SizedBox(height: MmSpace.s8),
        Text(MobV3Copy.startWhenReady, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
      ];
    } else {
      keys = [
        if (room.youReady)
          KeyButton(key: const ValueKey('lobby-waiting'), label: MobV3Copy.waitingFor(room.hostName), onPressed: null)
        else
          KeyButton(key: const ValueKey('lobby-ready'), label: MobV3Copy.imReady, onPressed: _ready),
      ];
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_note != null) ...[
            Text(_note!, key: const ValueKey('lobby-note'), textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink)),
            const SizedBox(height: MmSpace.s8),
          ],
          ...keys,
          const SizedBox(height: MmSpace.s4),
          KeyButton.quiet(key: const ValueKey('lobby-later'), label: MobV3Copy.playLaterInstead, onPressed: _playLater),
        ],
      ),
    );
  }
}

/// The lobby's sticker row: the four lobby stickers; a send flies over your own Fold.
class _LobbyStickers extends ConsumerStatefulWidget {
  const _LobbyStickers({required this.gameId, required this.onSent});

  final String gameId;
  final ValueChanged<StickerKind> onSent;

  @override
  ConsumerState<_LobbyStickers> createState() => _LobbyStickersState();
}

class _LobbyStickersState extends ConsumerState<_LobbyStickers> {
  late final StickerBus _bus = ref.read(stickerBusProvider);
  int _lastId = 0;

  @override
  void initState() {
    super.initState();
    // Listening makes the row hand its flights to the stage (the sender's Fold) instead of the chip.
    _bus.addListener(_onBus);
    _lastId = _bus.recent.isEmpty ? 0 : _bus.recent.last.id;
  }

  @override
  void dispose() {
    _bus.removeListener(_onBus);
    super.dispose();
  }

  void _onBus() {
    for (final s in _bus.recent) {
      if (s.id > _lastId) {
        _lastId = s.id;
        widget.onSent(s.kind);
      }
    }
  }

  @override
  Widget build(BuildContext context) => StickerRow(kinds: StickerKind.lobby, gameId: widget.gameId, label: MobV3Copy.sendASticker);
}

/// "Live" with a lamp-coloured dot that breathes (still in reduced motion).
class _LiveDot extends StatefulWidget {
  const _LiveDot();

  @override
  State<_LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<_LiveDot> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MobFx.reduced(context)) {
      _c.stop();
      _c.value = 1;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Container(
      key: const ValueKey('lobby-live'),
      height: 30,
      padding: const EdgeInsets.fromLTRB(9, 0, 11, 0),
      decoration: ShapeDecoration(color: colors.raised, shape: StadiumBorder(side: BorderSide(color: colors.line))),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FadeTransition(
            opacity: Tween<double>(begin: 0.45, end: 1).animate(_c),
            child: Container(width: 8, height: 8, decoration: BoxDecoration(color: colors.lamp, shape: BoxShape.circle)),
          ),
          const SizedBox(width: 6),
          Text(MobV3Copy.liveDot, style: context.mmType.label.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _WashPainter extends CustomPainter {
  _WashPainter({required this.share, required this.opacity, required this.colour});

  final double share;
  final double opacity;
  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    if (share <= 0 || opacity <= 0) return;
    // From the key at the bottom centre.
    final centre = Offset(size.width / 2, size.height - 56);
    canvas.drawCircle(centre, GoLiveWash.maxRadius(size) * share, Paint()..color = colour.withValues(alpha: opacity));
  }

  @override
  bool shouldRepaint(_WashPainter old) => old.share != share || old.opacity != opacity || old.colour != colour;
}
