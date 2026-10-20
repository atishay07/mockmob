// R1 to R6, the 24-hour game run (MOB-BUILD-SPEC-V3 5.3; moments M3, M4, M5, M5b, M6, M6b in 5.6).
//
// What a first-time student sees, in order:
// - the shared 3, 2, 1 on the stopwatch against the runs they race (M3), with a visible Skip;
// - Live's paper ruler with full-body Folds: theirs, and their friends' recorded runs as ghosts
//   walking by their real arrival times (M6b), caption "Where everyone is. Never what they picked.";
// - "Question 3 of 5" and "+5 if right, -1 if wrong", the question at the runner's 17/26, options A
//   to D, and the keys "Skip" and "Lock in B" (disabled "Pick an answer" until a pick);
// - after the server answers: "Right." with a drawn tick and "+5", or "Not this one." on their own
//   option only (the right option is never marked before the game closes, F1), or "Skipped.";
// - a ghost reaching the flag: its pennant rises after a 70 ms hit-stop and a toast says so;
// - R6: "You played all 5." with the marks the server sent, and "See the podium".
//
// Truth: every mark on screen is the server's (AnswerResult.marks and .delta). The app computes only
// the ghost pace chip (logic/ghost_pace.dart, spec R4). Answers retry with the same question and pick
// (the server keeps the first), and "Saving your answer" shows only after 600 ms with no reply.
// It does not use features/runner: that runner shows answers (spec 5.8).

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api.dart';
import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../data/mob_repository.dart' show mobRepositoryProvider;
import '../copy_v3.dart';
import '../data/mob_v3_api.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/ghost_pace.dart';
import '../mob_v3_nav.dart';
import '../widgets/countdown_stopwatch.dart';
import '../widgets/fold_puppet.dart';
import '../widgets/mob_fx.dart';
import '../widgets/run_option.dart';
import '../widgets/run_paper.dart';
import '../widgets/ruler_race.dart';

enum _Phase { loading, failed, countdown, play, done }

class GameRunScreen extends ConsumerStatefulWidget {
  const GameRunScreen({super.key, required this.gameId});

  final String gameId;

  /// Feedback timeline length (M5: the stamp's glints end by about 1200 ms).
  static const Duration feedback = Duration(milliseconds: 1200);

  @override
  ConsumerState<GameRunScreen> createState() => _GameRunScreenState();
}

class _GameRunScreenState extends ConsumerState<GameRunScreen> with TickerProviderStateMixin {
  static const List<String> _letters = ['A', 'B', 'C', 'D', 'E'];

  _Phase _phase = _Phase.loading;
  Object? _error;
  MobGame? _game;
  RunStart? _rs;

  // The run.
  final Map<int, RunAnswer> _answers = {};
  int _q = 0;
  int? _pick;
  int? _sentPick;
  bool _sending = false;
  bool _slow = false;
  Timer? _slowTimer;
  Object? _sendError;
  AnswerResult? _result;
  int? _marks;
  bool _finished = false;
  bool _threeShown = false;
  bool _threeNow = false;
  String? _expired;
  bool _instant = true;

  // The clock: run time = the server's elapsed at the last sync + the local ticker since then.
  late final Ticker _ticker = createTicker(_onTick);
  Duration _tickNow = Duration.zero;
  Duration _syncAt = Duration.zero;
  int _syncMs = 0;
  int _shownSecond = -1;
  List<int> _ghostReached = const [];

  // Motion.
  late final AnimationController _cd = AnimationController(vsync: this, upperBound: CountdownTimeline.end);
  late final AnimationController _cdSkip = AnimationController(vsync: this, duration: MobBeat.skip);
  late final AnimationController _press = AnimationController(vsync: this, duration: Motion.press);
  late final AnimationController _lock = AnimationController(vsync: this, duration: const Duration(milliseconds: 160));
  late final AnimationController _fb = AnimationController(vsync: this, duration: GameRunScreen.feedback);
  late final AnimationController _qFade = AnimationController(vsync: this, value: 1);
  late final AnimationController _toastC = AnimationController(vsync: this, duration: Motion.glideDuration);
  late final AnimationController _chipPop = AnimationController(vsync: this, value: 1);

  /// The run's scroll, so the picked option is kept in view above the feedback panel (walk M2).
  final ScrollController _scroll = ScrollController();
  final List<GlobalKey> _optionKeys = List.generate(8, (i) => GlobalKey(debugLabel: 'run-option-$i'));
  int _cdBeat = -1;
  FoldAct _youAct = FoldAct.none;
  int _youActId = 0;
  bool _actFired = true;
  GhostPace? _pace;
  final List<String> _toastQueue = [];
  /// The name of the racer whose run just reached the flag, while its toast shows.
  String? _toast;
  Timer? _toastTimer;

  bool get _reduced => MobFx.reduced(context);
  int get _count => _rs?.questions.length ?? _game?.count ?? 5;
  int get _elapsedMs => _syncMs + (_tickNow - _syncAt).inMilliseconds;
  double get _fbMs => _fb.value * GameRunScreen.feedback.inMilliseconds;

  DateTime get _serverNow {
    final start = _rs?.run.startedAt;
    if (start != null) return start.add(Duration(milliseconds: _elapsedMs));
    return (_rs?.run.serverNow ?? DateTime.now()).add(_tickNow - _syncAt);
  }

  @override
  void initState() {
    super.initState();
    _cd
      ..addListener(_onCountdown)
      ..addStatusListener((s) {
        if (s == AnimationStatus.completed && _phase == _Phase.countdown) _endCountdown();
      });
    _fb.addListener(_onFeedback);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _slowTimer?.cancel();
    _toastTimer?.cancel();
    _ticker.dispose();
    _cd.dispose();
    _cdSkip.dispose();
    _press.dispose();
    _lock.dispose();
    _fb.dispose();
    _qFade.dispose();
    _scroll.dispose();
    _toastC.dispose();
    _chipPop.dispose();
    super.dispose();
  }

  // ---- Loading -------------------------------------------------------------------------------------

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _phase = _Phase.loading;
      _error = null;
    });
    final api = ref.read(mobV3ApiProvider);
    final gameF = api.game(widget.gameId).then<MobGame?>((g) => g, onError: (Object _) => null);
    RunStart rs;
    try {
      rs = await api.run(widget.gameId);
    } on Object catch (e) {
      await gameF;
      if (!mounted) return;
      if (_code(e) == 'RUN_DONE') {
        // Already played: straight to the podium.
        MobV3Nav.podiumAfterRun(context, widget.gameId);
        return;
      }
      setState(() {
        _phase = _Phase.failed;
        _error = e;
      });
      return;
    }
    final game = await gameF;
    if (!mounted) return;
    final n = rs.questions.length;
    _answers
      ..clear()
      ..addEntries([for (final a in rs.run.answers) if (a.q >= 0 && a.q < n) MapEntry(a.q, a)]);
    var q = 0;
    while (q < n && _answers.containsKey(q)) {
      q++;
    }
    final start = rs.run.startedAt;
    final now = rs.run.serverNow;
    setState(() {
      _rs = rs;
      _game = game;
      _q = math.min(q, math.max(0, n - 1));
      _syncMs = start != null && now != null ? math.max(0, now.difference(start).inMilliseconds) : 0;
      _syncAt = _tickNow;
      _ghostReached = [for (final g in rs.ghosts) g.reachedAt(_syncMs).clamp(0, n)];
      _threeShown = _hasThree();
      _pace = GhostPaceCalc.afterAnswers(_answers.values.toList(), rs.ghosts);
      _instant = true;
      if (q >= n && n > 0) {
        _finished = true;
        _phase = _Phase.done;
      } else if (_answers.isNotEmpty) {
        // A resumed run: the Fold reappears at its question with no animation, and no countdown.
        _phase = _Phase.play;
      } else {
        _phase = _Phase.countdown;
      }
    });
    if (!_ticker.isActive) _ticker.start();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _instant = false);
    });
    if (_phase == _Phase.countdown) _startCountdown();
  }

  static String? _code(Object e) => e is ApiError ? e.code : null;

  /// RUN_EXPIRED carries `{ run: { finished, marks, answered, count } }` (in the error's details,
  /// directly or under `detail`).
  static int? _expiredMarks(Object e) {
    if (e is! ApiError) return null;
    Object? run = e.details['run'];
    final detail = e.details['detail'];
    if (run is! Map && detail is Map) run = detail['run'];
    if (run is! Map) return null;
    final m = run['marks'];
    return m is num ? m.toInt() : null;
  }

  bool _hasThree() {
    var run = 0;
    for (var i = 0; i < _count; i++) {
      run = _answers[i]?.correct == true ? run + 1 : 0;
      if (run >= 3) return true;
    }
    return false;
  }

  // ---- The clock and the ghosts --------------------------------------------------------------------

  void _onTick(Duration now) {
    _tickNow = now;
    final rs = _rs;
    if (rs == null) return;
    final el = _elapsedMs;
    var changed = false;
    final sec = el ~/ 1000;
    if (sec != _shownSecond) {
      _shownSecond = sec;
      changed = true;
    }
    if (_ghostReached.length == rs.ghosts.length) {
      for (var i = 0; i < rs.ghosts.length; i++) {
        final r = rs.ghosts[i].reachedAt(el).clamp(0, _count);
        if (r != _ghostReached[i]) {
          _ghostReached = [..._ghostReached]..[i] = r;
          changed = true;
        }
      }
    }
    if (changed && mounted) setState(() {});
  }

  void _sync(AnswerResult r) {
    final start = _rs?.run.startedAt;
    final now = r.serverNow;
    _syncMs = start != null && now != null ? math.max(0, now.difference(start).inMilliseconds) : r.elapsedMs;
    _syncAt = _tickNow;
  }

  // ---- M3 the countdown ----------------------------------------------------------------------------

  void _startCountdown() {
    _cdBeat = -1;
    final end = CountdownTimeline.endFor(reduced: _reduced);
    _onCountdown();
    _cd.animateTo(end, duration: Duration(milliseconds: end.round()), curve: Curves.linear);
  }

  void _onCountdown() {
    final t = _cd.value;
    final beat = t >= CountdownTimeline.go ? 3 : (t / CountdownTimeline.beat).floor();
    if (beat > _cdBeat && _phase == _Phase.countdown && _cdSkip.value == 0) {
      _cdBeat = beat;
      final h = hapticsOf(context);
      if (beat < 3) {
        h?.selection();
      } else {
        h?.light();
      }
    }
  }

  void _skipCountdown() {
    if (_phase != _Phase.countdown || _cdSkip.isAnimating) return;
    _cdSkip.forward(from: 0).whenComplete(() {
      if (!mounted) return;
      _cd.stop();
      _endCountdown();
    });
  }

  void _endCountdown() {
    if (_phase != _Phase.countdown) return;
    setState(() => _phase = _Phase.play);
  }

  // ---- M4 pick and lock in -------------------------------------------------------------------------

  void _choose(int i) {
    if (_phase != _Phase.play || _sending || _result != null || _sendError != null) return;
    hapticsOf(context)?.selection();
    setState(() => _pick = i);
    if (!_reduced) _press.forward(from: 0).whenComplete(() => _press.reverse());
  }

  void _lockIn() {
    final pick = _pick;
    if (pick == null || _sending || _result != null) return;
    if (_reduced) {
      _lock.value = 1;
    } else {
      _lock.forward(from: 0);
      _youAct = FoldAct.nod;
      _youActId++;
    }
    _send(_q, pick);
  }

  void _skip() {
    if (_sending || _result != null) return;
    setState(() => _pick = null);
    _send(_q, -1);
  }

  Future<void> _send(int q, int pick) async {
    final api = ref.read(mobV3ApiProvider);
    setState(() {
      _sending = true;
      _slow = false;
      _sendError = null;
      _sentPick = pick;
    });
    _slowTimer?.cancel();
    _slowTimer = Timer(const Duration(milliseconds: 600), () {
      if (mounted && _sending) setState(() => _slow = true);
    });
    AnswerResult r;
    try {
      r = await api.answer(widget.gameId, q: q, pick: pick);
    } on Object catch (e) {
      _slowTimer?.cancel();
      if (!mounted) return;
      final code = _code(e);
      if (code == 'RUN_DONE') {
        _refreshDen();
        MobV3Nav.podiumAfterRun(context, widget.gameId);
        return;
      }
      setState(() {
        _sending = false;
        _slow = false;
        if (code == 'RUN_EXPIRED') {
          // The server sends the stored run with it: R6 shows those marks (no refetch).
          _expired = MobV3Copy.error(e);
          _marks = _expiredMarks(e) ?? _marks;
          _finished = true;
          _phase = _Phase.done;
        } else {
          _sendError = e;
        }
      });
      return;
    }
    _slowTimer?.cancel();
    if (!mounted) return;
    final ghosts = _rs?.ghosts ?? const <Ghost>[];
    final pace = GhostPaceCalc.of(youMs: r.elapsedMs, k: q, ghosts: ghosts);
    final popChip = pace != null && pace.text != _pace?.text && _pace != null;
    setState(() {
      _sending = false;
      _slow = false;
      _result = r;
      _marks = r.marks;
      _finished = r.finished;
      _answers[q] = RunAnswer(q: q, pick: pick, correct: r.correct, elapsedMs: r.elapsedMs);
      _sync(r);
      _threeNow = false;
      if (r.correct == true && !_threeShown && _streakAt(q) == 3) {
        _threeNow = true;
        _threeShown = true;
      }
      _pace = pace ?? _pace;
      _actFired = r.correct == null;
    });
    if (popChip && !_reduced) {
      _chipPop.animateWith(SpringSimulation(Springs.iconPop, 0, 1, 0));
    }
    if (r.correct == true && (_rs?.run.live ?? false)) hapticsOf(context)?.light();
    _fb.forward(from: 0);
    if (pick >= 0) WidgetsBinding.instance.addPostFrameCallback((_) => _keepPickInView(pick));
  }

  /// The panel takes the bottom of the screen; on a long question the picked option would sit under
  /// it with its tick and "+5" hidden (walk M2). Scroll it up so it stays in full view above the panel.
  void _keepPickInView(int pick) {
    if (!mounted || pick < 0 || pick >= _optionKeys.length) return;
    final ctx = _optionKeys[pick].currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      alignment: 1,
      alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
      duration: _reduced ? Duration.zero : const Duration(milliseconds: 300),
      curve: Motion.glide,
    );
  }

  int _streakAt(int q) {
    var n = 0;
    for (var i = q; i >= 0; i--) {
      if (_answers[i]?.correct != true) break;
      n++;
    }
    return n;
  }

  // ---- M5 / M5b feedback, then the next question ---------------------------------------------------

  void _onFeedback() {
    if (_actFired) return;
    final at = _reduced ? 0.0 : 240.0;
    if (_fbMs < at) return;
    _actFired = true;
    final r = _result;
    if (r == null || r.correct == null) return;
    setState(() {
      _youAct = r.correct! ? FoldAct.cheer : FoldAct.tilt;
      _youActId++;
    });
  }

  bool get _lastQuestion => _q >= _count - 1 || _finished;

  Future<void> _next() async {
    if (_result == null) return;
    final toDone = _lastQuestion;
    // The question change is fade out 140, then fade in 200; never both at once (judge: Live's double exposure).
    await _qFade.animateTo(0, duration: _reduced ? Motion.reducedFade : const Duration(milliseconds: 140), curve: Motion.leave);
    if (!mounted) return;
    setState(() {
      _result = null;
      _pick = null;
      _sentPick = null;
      _threeNow = false;
      _lock.value = 0;
      _press.value = 0;
      _fb.value = 0;
      // The next question starts at the top, ruler and stem in view.
      if (_scroll.hasClients) _scroll.jumpTo(0);
      if (toDone) {
        _phase = _Phase.done;
        // The den behind this screen still shows the game as unplayed and the quest short of these answers (walk
        // 20 Oct): read it again now, so Back lands on what is true.
        _refreshDen();
      } else {
        var q = _q + 1;
        while (q < _count - 1 && _answers.containsKey(q)) {
          q++;
        }
        _q = q;
      }
    });
    if (toDone && !_finished && _expired == null) {
      try {
        final m = await ref.read(mobV3ApiProvider).finish(widget.gameId);
        if (mounted) {
          setState(() {
            _marks = m;
            _finished = true;
          });
        }
      } on Object {
        // The podium still opens; the marks line waits for the server.
      }
    }
    if (!mounted) return;
    await _qFade.animateTo(1, duration: _reduced ? Motion.reducedFade : const Duration(milliseconds: 200), curve: Motion.glide);
  }

  /// Reads the Mob again in the background once this run is over. A failure keeps what the den had.
  void _refreshDen() {
    unawaited(ref.read(mobRepositoryProvider.notifier).refresh(force: true).catchError((Object _) {}));
  }

  // ---- M6 a ghost reaches the flag: the toast ------------------------------------------------------

  void _onGhostFinished(RulerRacer r) {
    _toastQueue.add(r.name);
    if (_toast == null) _showNextToast();
  }

  void _showNextToast() {
    if (!mounted || _toastQueue.isEmpty) return;
    final name = _toastQueue.removeAt(0);
    setState(() => _toast = name);
    if (_reduced) {
      _toastC.duration = Motion.reducedFade;
    } else {
      _toastC.duration = Motion.glideDuration;
    }
    _toastC.forward(from: 0);
    _toastTimer?.cancel();
    _toastTimer = Timer(const Duration(seconds: 4), () async {
      if (!mounted) return;
      await _toastC.reverse();
      if (!mounted) return;
      setState(() => _toast = null);
      _showNextToast();
    });
  }

  // ---- Leaving -------------------------------------------------------------------------------------

  Future<void> _confirmLeave() async {
    if (_phase == _Phase.failed || _phase == _Phase.loading || _phase == _Phase.done) {
      Navigator.of(context).maybePop();
      return;
    }
    final leave = await showMmSheet<bool>(
      context: context,
      title: MobV3Copy.leaveRun,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.sheetSide),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(MobV3Copy.leaveRunLine, style: sheet.mmType.body.copyWith(color: sheet.mmColors.ink2)),
            const SizedBox(height: MmSpace.s20),
            KeyButton(label: MobV3Copy.keepPlaying, onPressed: () => Navigator.of(sheet).pop(false)),
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(label: MobV3Copy.leave, onPressed: () => Navigator.of(sheet).pop(true)),
            const SizedBox(height: MmSpace.s16),
          ],
        ),
      ),
    );
    if (leave == true && mounted) Navigator.of(context).pop();
  }

  // ---- Build ---------------------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return PopScope(
      canPop: _phase != _Phase.play && _phase != _Phase.countdown,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        backgroundColor: colors.ground,
        body: SafeArea(
          child: MobIdleScope(
            child: Column(
              children: [
                _header(context),
                Expanded(child: _body(context)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final title = _game?.title ?? '';
    final sub = _rs == null ? null : MobV3Copy.runsToRace(_rs!.ghosts.length);
    final clock = MobTime.stopwatch(Duration(milliseconds: _rs == null ? 0 : _elapsedMs));
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s8, MmSpace.gutter, MmSpace.s8),
      child: Row(
        children: [
          IconButton(
            tooltip: MobV3Copy.closeRun,
            onPressed: _confirmLeave,
            icon: Icon(LucideIcons.x, color: colors.ink, size: 24),
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          ),
          const SizedBox(width: MmSpace.s4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, style: type.title.copyWith(color: colors.ink, fontSize: 20, height: 24 / 20)),
                if (sub != null) Text(sub, style: type.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
          if (_rs != null) ...[
            const SizedBox(width: MmSpace.s8),
            Semantics(
              label: MobV3Copy.runClock(clock),
              excludeSemantics: true,
              child: Container(
                height: 36,
                padding: const EdgeInsets.fromLTRB(8, 0, 12, 0),
                decoration: ShapeDecoration(color: colors.raised, shape: StadiumBorder(side: BorderSide(color: colors.line))),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Image.asset(stopwatchArt, height: 22, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: 18)),
                    const SizedBox(width: MmSpace.s6),
                    Text(clock, key: const ValueKey('run-clock'), style: type.labelLarge.copyWith(color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _body(BuildContext context) {
    switch (_phase) {
      case _Phase.loading:
        return _loading(context);
      case _Phase.failed:
        return _failed(context);
      case _Phase.countdown:
      case _Phase.play:
      case _Phase.done:
        break;
    }
    final run = _runBody(context);
    if (_phase != _Phase.countdown) return run;
    final reduced = _reduced;
    final you = ref.watch(denViewProvider)?.v3.you;
    final heads = <CountdownHead>[
      for (final g in _rs!.ghosts) CountdownHead(name: g.name, fold: g.fold, colour: g.colour, ghost: true),
      CountdownHead(name: you?.name ?? MobV3Copy.tabYou, fold: you?.fold ?? FoldKey.dart, colour: you?.colour ?? 0, you: true),
    ];
    return AnimatedBuilder(
      animation: Listenable.merge([_cd, _cdSkip]),
      builder: (context, _) {
        final t = _cd.value;
        final skip = _cdSkip.value;
        final body = math.max(CountdownTimeline.body(t, reduced: reduced), skip);
        final stage = (1 - skip) * CountdownTimeline.stage(t, reduced: reduced);
        return Stack(
          children: [
            IgnorePointer(
              child: Opacity(
                opacity: body.clamp(0.0, 1.0),
                child: Transform.translate(offset: Offset(0, reduced ? 0 : 14 * (1 - body)), child: run),
              ),
            ),
            if (stage > 0)
              Positioned.fill(
                child: Opacity(
                  opacity: stage.clamp(0.0, 1.0),
                  child: CountdownStage(
                    key: const ValueKey('run-countdown'),
                    ms: _cd,
                    count: _count,
                    heads: heads,
                    reduced: reduced,
                    onSkip: _skipCountdown,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _loading(BuildContext context) {
    return SkeletonGroup(
      label: MobV3Copy.runLoading,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: const [
            Skeleton(height: RulerRace.height, radius: MmRadius.panel),
            SizedBox(height: MmSpace.s24),
            Skeleton(height: 18, width: 120),
            SizedBox(height: MmSpace.s12),
            Skeleton(height: 52),
            SizedBox(height: MmSpace.s16),
            Skeleton(height: 56, radius: MmRadius.key),
            SizedBox(height: RunOption.gap),
            Skeleton(height: 56, radius: MmRadius.key),
            SizedBox(height: RunOption.gap),
            Skeleton(height: 56, radius: MmRadius.key),
            SizedBox(height: RunOption.gap),
            Skeleton(height: 56, radius: MmRadius.key),
          ],
        ),
      ),
    );
  }

  Widget _failed(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final closed = _code(_error ?? '') == 'GAME_CLOSED';
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s24, MmSpace.gutter, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Spacer(),
          Text(MobV3Copy.error(_error ?? ''), textAlign: TextAlign.center, style: type.lead.copyWith(color: colors.ink)),
          const Spacer(),
          if (closed)
            KeyButton(label: MobV3Copy.back, onPressed: () => Navigator.of(context).maybePop())
          else ...[
            KeyButton(label: MobV3Copy.tryAgain, onPressed: _load),
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(label: MobV3Copy.back, onPressed: () => Navigator.of(context).maybePop()),
          ],
        ],
      ),
    );
  }

  List<RulerRacer> _racers() {
    final rs = _rs!;
    final n = _count;
    final you = ref.watch(denViewProvider)?.v3.you;
    final out = <RulerRacer>[];
    for (var i = 0; i < rs.ghosts.length; i++) {
      final g = rs.ghosts[i];
      final reached = i < _ghostReached.length ? _ghostReached[i] : 0;
      final done = reached >= n;
      final arrived = reached == 0 || g.arrivalsMs.isEmpty ? 0 : g.arrivalsMs[math.min(reached, g.arrivalsMs.length) - 1];
      out.add(RulerRacer(id: g.memberId, name: g.name, fold: g.fold, colour: g.colour, ghost: true, at: reached + 1, arrivedMs: arrived, finished: done));
    }
    var latest = 0;
    for (final a in _answers.values) {
      latest = math.max(latest, a.elapsedMs);
    }
    final answered = _answers.length;
    out.add(RulerRacer(
      id: 'you',
      name: you?.name ?? MobV3Copy.tabYou,
      fold: you?.fold ?? FoldKey.dart,
      colour: you?.colour ?? 0,
      you: true,
      at: answered + 1,
      arrivedMs: latest,
      finished: answered >= n,
    ));
    return out;
  }

  Widget _runBody(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rs = _rs!;
    final reduced = _reduced;
    final racers = _racers();

    final ruler = Semantics(
      label: MobV3Copy.rulerLabel,
      child: RulerRace(
        key: const ValueKey('run-ruler'),
        count: _count,
        racers: racers,
        answered: _answers.length,
        youAct: _youAct,
        youActId: _youActId,
        instant: _instant,
        onFinishToast: _onGhostFinished,
      ),
    );

    final captionRow = Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s8, 0, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: AnimatedBuilder(
              animation: _toastC,
              builder: (context, _) {
                final v = Motion.glide.transform(_toastC.value);
                // Worded as it draws: "Take your time" only while the student is still playing (walk 20 Oct: it stayed
                // on the finished screen).
                final name = _toast;
                final toast = name == null ? null : (_phase == _Phase.done ? MobV3Copy.ghostFinishedAfterYou(name) : MobV3Copy.ghostFinished(name));
                return Stack(
                  children: [
                    Opacity(
                      opacity: toast == null ? 1 : (1 - v).clamp(0.0, 1.0),
                      child: Text(MobV3Copy.rulerCaption, style: type.caption.copyWith(color: colors.ink3)),
                    ),
                    if (toast != null)
                      Positioned.fill(
                        child: Opacity(
                          opacity: v,
                          child: Transform.translate(
                            offset: Offset(reduced ? 0 : -16 * (1 - v), 0),
                            child: Text(toast, key: const ValueKey('run-toast'), style: type.caption.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
          if (_pace != null) ...[
            const SizedBox(width: MmSpace.s8),
            Flexible(
              child: AnimatedBuilder(
                animation: _chipPop,
                builder: (context, child) => Transform.scale(scale: 0.86 + 0.14 * _chipPop.value, child: child),
                child: _PaceChip(text: _pace!.text),
              ),
            ),
          ],
        ],
      ),
    );

    Widget middle;
    if (_phase == _Phase.done) {
      middle = _doneBlock(context);
    } else {
      final question = rs.questions[_q.clamp(0, rs.questions.length - 1)];
      middle = FadeTransition(
        opacity: _qFade,
        child: AnimatedBuilder(
          animation: Listenable.merge([_press, _lock, _fb]),
          builder: (context, _) => _question(context, question),
        ),
      );
    }

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            key: const ValueKey('run-scroll'),
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s4, MmSpace.gutter, MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ruler,
                captionRow,
                const SizedBox(height: MmSpace.s16),
                middle,
              ],
            ),
          ),
        ),
        _bottom(context),
      ],
    );
  }

  Widget _question(BuildContext context, GameQuestion question) {
    final colors = context.mmColors;
    final type = context.mmType;
    final r = _result;
    final picked = _sentPick ?? _pick;
    final locked = _sending || r != null || _sendError != null;
    final passage = question.passage;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text(MobV3Copy.questionOf(_q + 1, _count), style: type.label.copyWith(color: colors.ink3))),
            const SizedBox(width: MmSpace.s8),
            // Wraps at large text on a small phone instead of overflowing.
            Flexible(child: Text(MobV3Copy.marksRule, textAlign: TextAlign.end, style: type.label.copyWith(color: colors.ink3))),
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        if (passage != null && passage.trim().isNotEmpty) ...[
          Text(passage, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s12),
        ],
        Text(question.stem, style: type.question.copyWith(color: colors.ink)),
        const SizedBox(height: MmSpace.s16),
        for (var i = 0; i < question.options.length; i++) ...[
          if (i > 0) const SizedBox(height: RunOption.gap),
          KeyedSubtree(
            key: i < _optionKeys.length ? _optionKeys[i] : null,
            child: RunOption(
            key: ValueKey('run-option-$i'),
            letter: _letters[i.clamp(0, _letters.length - 1)],
            text: question.options[i],
            look: _lookFor(i, picked, r, locked),
            dimmed: locked && picked != null && picked >= 0 && i != picked,
            press: i == _pick && !locked ? Motion.out.transform(_press.value) : 0,
            lock: _lock.value,
            fbMs: _fbMs,
            delta: r?.delta,
            reduced: _reduced,
            onTap: locked ? null : () => _choose(i),
          ),
          ),
        ],
      ],
    );
  }

  RunOptionLook _lookFor(int i, int? picked, AnswerResult? r, bool locked) {
    if (picked == null || picked < 0 || i != picked) return RunOptionLook.idle;
    if (r != null && r.correct == true) return RunOptionLook.right;
    if (r != null && r.correct == false) return RunOptionLook.wrong;
    return locked ? RunOptionLook.locked : RunOptionLook.picked;
  }

  Widget _doneBlock(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final marks = _marks;
    return FadeTransition(
      opacity: _qFade,
      child: Padding(
        padding: const EdgeInsets.only(top: MmSpace.s24),
        child: Column(
          children: [
            Text(
              _expired ?? MobV3Copy.playedAll(_count),
              key: const ValueKey('run-done-title'),
              textAlign: TextAlign.center,
              style: (_expired == null ? type.title : type.lead).copyWith(color: colors.ink),
            ),
            if (marks != null) ...[
              const SizedBox(height: MmSpace.s12),
              Semantics(
                label: MobV3Copy.marks(marks),
                excludeSemantics: true,
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: '$marks', style: type.figure.copyWith(color: colors.ink)),
                    TextSpan(text: ' ${MobV3Copy.marksWord(marks)}', style: type.figure.copyWith(color: colors.ink2)),
                  ]),
                  key: const ValueKey('run-done-marks'),
                  textAlign: TextAlign.center,
                  textHeightBehavior: MmType.figureHeightBehavior,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _bottom(BuildContext context) {
    if (_phase == _Phase.countdown) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    const pad = EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16);

    if (_phase == _Phase.done) {
      return Padding(
        padding: pad,
        child: KeyButton(
          key: const ValueKey('run-key-podium'),
          label: MobV3Copy.seePodium,
          onPressed: () => MobV3Nav.podiumAfterRun(context, widget.gameId),
        ),
      );
    }

    final r = _result;
    if (r != null) {
      return AnimatedBuilder(
        animation: _fb,
        builder: (context, child) {
          final ms = _fbMs;
          final reduced = _reduced;
          final rise = reduced ? 1.0 : Motion.drawer.transform(((ms - 160) / 360).clamp(0.0, 1.0));
          final opacity = reduced ? (ms / 120).clamp(0.0, 1.0) : ((ms - 160) / 120).clamp(0.0, 1.0);
          return Transform.translate(
            offset: Offset(0, 28 * (1 - rise)),
            child: Opacity(opacity: opacity, child: child),
          );
        },
        child: _panel(context, r),
      );
    }

    final err = _sendError;
    if (err != null) {
      return Padding(
        padding: pad,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(MobV3Copy.error(err), key: const ValueKey('run-send-error'), style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            KeyButton(key: const ValueKey('run-key-retry'), label: MobV3Copy.tryAgain, onPressed: () => _send(_q, _sentPick ?? -1)),
          ],
        ),
      );
    }

    final pick = _pick;
    final String label;
    VoidCallback? onLock;
    if (_sending) {
      label = _slow ? MobV3Copy.saving : (_sentPick != null && _sentPick! >= 0 ? MobV3Copy.lockIn(_letters[_sentPick!]) : MobV3Copy.skip);
      onLock = _slow ? null : () {};
    } else if (pick == null) {
      label = MobV3Copy.pickAnAnswer;
      onLock = null;
    } else {
      label = MobV3Copy.lockIn(_letters[pick]);
      onLock = _lockIn;
    }
    return Padding(
      padding: pad,
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: KeyButton.secondary(key: const ValueKey('run-key-skip'), label: MobV3Copy.skip, onPressed: _sending ? null : _skip),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            flex: 3,
            child: KeyButton(key: const ValueKey('run-key-lock'), label: label, onPressed: onLock, hapticOnCommit: !_sending),
          ),
        ],
      ),
    );
  }

  Widget _panel(BuildContext context, AnswerResult r) {
    final colors = context.mmColors;
    final type = context.mmType;
    final String title;
    String? line;
    if (r.correct == true) {
      title = _threeNow ? MobV3Copy.rightThree : MobV3Copy.right;
      line = MobV3Copy.rightLine;
    } else if (r.correct == false) {
      title = MobV3Copy.notThisOne;
      final closes = _game?.closesAt;
      line = closes == null ? null : MobV3Copy.wrongLine(closes, _serverNow);
    } else {
      title = MobV3Copy.skippedLine;
    }
    return Container(
      key: const ValueKey('run-panel'),
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(MmRadius.panel)),
        border: Border(top: BorderSide(color: colors.line)),
      ),
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s20, MmSpace.gutter, MmSpace.s16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, key: const ValueKey('run-panel-title'), style: type.cardTitle.copyWith(color: colors.ink)),
                    if (line != null) ...[
                      const SizedBox(height: MmSpace.s4),
                      Text(line, key: const ValueKey('run-panel-line'), style: type.body.copyWith(color: colors.ink2)),
                    ],
                  ],
                ),
              ),
              if (_threeNow)
                Padding(
                  padding: const EdgeInsets.only(left: MmSpace.s12, top: MmSpace.s2),
                  child: AnimatedBuilder(
                    animation: _fb,
                    builder: (context, _) {
                      final t = _fbMs - (_reduced ? 0 : 400);
                      if (t <= 0) return const SizedBox(width: 80, height: 34);
                      return PaperStamp(key: const ValueKey('run-stamp'), label: MobV3Copy.threeInARow, t: t, reduced: _reduced);
                    },
                  ),
                ),
            ],
          ),
          const SizedBox(height: MmSpace.s16),
          KeyButton(key: const ValueKey('run-key-next'), label: _lastQuestion ? MobV3Copy.seeHowYouDid : MobV3Copy.nextQuestion, onPressed: _next),
        ],
      ),
    );
  }
}

class _PaceChip extends StatelessWidget {
  const _PaceChip({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final paper = RunPaper.of(context);
    return Container(
      key: const ValueKey('run-pace'),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: ShapeDecoration(
        color: paper.paper,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: BorderSide(color: paper.paperEdge)),
        shadows: const [BoxShadow(color: Color(0x33000000), blurRadius: 4, offset: Offset(0, 2))],
      ),
      child: Text(text, style: context.mmType.label.copyWith(color: paper.paperInk, fontWeight: FontWeight.w700)),
    );
  }
}
