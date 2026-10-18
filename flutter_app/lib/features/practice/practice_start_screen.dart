import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api.dart';
import '../../core/art/hybrid/hybrid.dart';
import '../../core/connectivity/connectivity.dart';
import '../../core/motion/motion.dart';
import '../../core/models/practice_quote.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'copy.dart';
import 'data/launch_flow.dart';
import 'data/practice_catalog.dart';
import 'data/practice_quote.dart';
import 'data/practice_starter.dart' show StartFailure;
import 'model/cost_line.dart';
import 'model/practice_link.dart';
import 'model/practice_selection.dart';
import 'widgets/composer_parts.dart' show modeTitle;
import 'widgets/composer_ticket.dart';
import 'widgets/failure_copy.dart';

/// The three real stages of a start, in order. Each is set by the code that is actually doing it,
/// never by a timer: the cost is being checked, the questions are being drawn (the start request
/// is out), the paper is opening (the server said yes). [done] is the instant before the runner.
enum StartStage {
  checking,
  drawing,
  opening,
  done;

  /// The words for the three stages that show as rows.
  static const List<String> labels = [PracticeCopy.stageChecking, PracticeCopy.stageDrawing, PracticeCopy.stageOpening];
}

/// `/practice/start`: starts Quick or chapter practice straight from a link or from Today, with
/// no setup screen, using the same quote check and launch as the setup screen. A link that names
/// no subject starts in the student's picked (or default) subject. Mocks always go through
/// setup, because they need the pre-start sheet, and so does a link asking for a length the mode
/// does not offer, so the change is said before Start. Anything the student must look at (a
/// blocked quote, a failure) ends in a designed state with a way out, never a blank screen; an
/// offline stop starts again by itself when the network returns. Mobi reads the sheet while the
/// questions are drawn and points the student in once they are ready.
class PracticeStartScreen extends ConsumerStatefulWidget {
  const PracticeStartScreen({super.key, this.mode, this.link = const PracticeLink()});

  final PracticeMode? mode;
  final PracticeLink link;

  /// After this long still working, the note says so (MOTION.md P1-7: words on every wait).
  static const Duration slowAfter = Duration(seconds: 12);

  /// After this long in one stage Mobi goes from reading to waiting (the loading act).
  static const Duration waitingAfter = Duration(seconds: 3);

  /// The most the screen holds before the runner opens, so Mobi's nod is seen (none under
  /// reduced motion).
  static const Duration nodHold = Duration(milliseconds: 350);

  @override
  ConsumerState<PracticeStartScreen> createState() => _PracticeStartScreenState();
}

class _PracticeStartScreenState extends ConsumerState<PracticeStartScreen> {
  String? _message;
  StateViewKind _kind = StateViewKind.error;
  bool _working = true;
  PracticeSelection? _selection;
  final MobiController _mobi = MobiController();

  /// Which of the three stages the work is in; tells the rows and Mobi.
  StartStage _stage = StartStage.checking;
  Timer? _waiting;

  /// The session is being created on the server (the start request is out). Back is held until
  /// it answers: leaving now would create a session the student never sees (ROBUSTNESS
  /// practice-08). Before this point back cancels cleanly: nothing has been asked of the server.
  bool _committed = false;

  /// The wait has run past [PracticeStartScreen.slowAfter].
  bool _slow = false;
  Timer? _slowTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_run()));
    _armSlow();
  }

  void _armSlow() {
    _slowTimer?.cancel();
    _slow = false;
    _slowTimer = Timer(PracticeStartScreen.slowAfter, () {
      if (mounted && _working) setState(() => _slow = true);
    });
  }

  /// Moves to [next]: the rows tick, and Mobi goes back to reading (he waits again if this stage
  /// runs long).
  void _setStage(StartStage next, {bool read = true}) {
    if (!mounted || _stage == next) return;
    setState(() => _stage = next);
    _waiting?.cancel();
    if (read && next != StartStage.done) _mobi.play(MobiAct.read);
    _waiting = Timer(PracticeStartScreen.waitingAfter, () {
      if (mounted && _working && _stage != StartStage.done) _mobi.play(MobiAct.loading);
    });
  }

  @override
  void dispose() {
    _waiting?.cancel();
    _slowTimer?.cancel();
    _mobi.dispose();
    super.dispose();
  }

  /// Runs [launch] with back held, and lets go once it has answered.
  Future<LaunchResult> _commit(Future<LaunchResult> Function() launch) async {
    setState(() => _committed = true);
    try {
      return await launch();
    } finally {
      if (mounted) setState(() => _committed = false);
    }
  }

  String get _setupLocation {
    final mode = widget.mode ?? PracticeMode.quick;
    final query = widget.link.query;
    final path = AppRoutes.practiceSetup(mode.name);
    return query.isEmpty ? path : Uri(path: path, queryParameters: query).toString();
  }

  /// The subject for a link that names none: the student's pick, read back from the phone, or
  /// their default once the catalogue has answered. Never waits more than a few seconds.
  Future<String> _fallbackSubject() async {
    try {
      await ref.read(practiceSubjectsProvider.future).timeout(const Duration(seconds: 3));
    } on Object {
      // The default without the catalogue is still one of the student's own subjects.
    }
    try {
      await ref.read(pickedPracticeSubjectProvider.notifier).restored.timeout(const Duration(seconds: 1));
    } on Object {
      // No stored pick: the default applies.
    }
    return ref.read(practiceSubjectProvider);
  }

  /// The link asked for a length this mode does not offer (Smart 5 opens at 10).
  bool _lengthChanged(PracticeMode mode, PracticeSelection selection) {
    final asked = widget.link.count;
    return asked != null && mode.usesCount && asked != selection.count;
  }

  /// Any failure outside the launch's own answers (a revoked session, a storage error) still
  /// ends in a designed stop with a way out, never a spinner that does not end.
  Future<void> _run() async {
    try {
      await _start();
    } on Object {
      if (mounted) _stop(PracticeCopy.startFailed, StateViewKind.error);
    }
  }

  Future<void> _start() async {
    final mode = widget.mode;
    final fallback = mode == null || widget.link.subject != null ? null : await _fallbackSubject();
    if (!mounted) return;
    final selection = mode == null ? null : widget.link.selectionFor(mode, fallbackSubject: fallback);
    // Nothing to start in: the setup page lets the student choose, never a silent drop on the
    // tab. Mocks need the pre-start sheet, chapter practice needs a chapter, and a changed length
    // is said on the confirm step before Start.
    if (mode == null || selection == null || mode.isMock || !selection.isComplete || _lengthChanged(mode, selection)) {
      context.pushReplacement(_setupLocation);
      return;
    }
    // Known now: the paper's ticket rises in under Mobi.
    setState(() {
      _selection = selection;
      _stage = StartStage.checking;
    });
    _waiting?.cancel();
    _waiting = Timer(PracticeStartScreen.waitingAfter, () {
      if (mounted && _working && _stage == StartStage.checking) _mobi.play(MobiAct.loading);
    });
    if (ref.read(networkStatusProvider) == NetworkStatus.offline) {
      _stop(PracticeCopy.offlineAutoStart, StateViewKind.offline);
      return;
    }
    final LaunchResult result;
    if (selection.isFreshCheck) {
      // A fresh check has no cost to check: it goes straight to drawing the questions.
      _setStage(StartStage.drawing);
      result = await _commit(() => launchFreshCheck(ref, selection));
    } else {
      final PracticeQuote quote;
      try {
        quote = await ref.read(practiceQuoteProvider(selection.quoteQuery).future);
      } on ApiError catch (e) {
        if (mounted) {
          _stop(
            e.isOffline ? PracticeCopy.offlineAutoStart : PracticeCopy.quoteFailed,
            e.isOffline ? StateViewKind.offline : StateViewKind.error,
          );
        }
        return;
      }
      if (!mounted) return;
      // Credits are only ever spent on a confirmed cost. A quote that is not free (and not Pro
      // access) goes to setup, where the confirm step states the cost before Start.
      if (quote.launchable && quoteSpendsCredits(quote)) {
        context.pushReplacement(_setupLocation);
        return;
      }
      // The cost is known: the questions are drawn next. Mobi looks up from the sheet and
      // points the way in (the point is held; the stage's own wait timer may turn it to loading).
      _setStage(StartStage.drawing);
      if (quote.launchable) _mobi.play(MobiAct.point);
      result = await _commit(() => launchPractice(ref, selection, quote));
    }
    if (!mounted) return;
    switch (result) {
      case LaunchStarted(:final sessionId):
        await _open(sessionId);
      case LaunchNeedsLook(:final quote):
        _stop(costLineFor(quote).text ?? PracticeCopy.unavailableFallback, StateViewKind.error);
      case LaunchFailed(:final failure, :final message):
        final offline = failure == StartFailure.offline;
        _stop(
          offline ? PracticeCopy.offlineAutoStart : StartFailureView(failure, message: message).text,
          offline ? StateViewKind.offline : StateViewKind.error,
        );
      case LaunchOpenPaper(:final paper):
        // Only a start that spends credits waits for an open paper, and this screen starts only free
        // ones; the case is here so the screen can never start past one.
        _stop(PracticeCopy.openFirst(apiMode: paper.apiMode), StateViewKind.error);
    }
  }

  /// The server said yes: the paper opens. Mobi nods, the last row ticks, and the runner opens
  /// after at most [PracticeStartScreen.nodHold] (straight away under reduced motion).
  Future<void> _open(String sessionId) async {
    final reduced = Motion.reduced(context);
    _setStage(StartStage.opening, read: false);
    _waiting?.cancel();
    // The server said yes: his nod lands after it (rate-limited, a still pose under reduced motion).
    _mobi.react(MobiMoments.act(MobiEvent.saveConfirmed), key: 'practice-start:opening');
    if (!reduced) {
      await Future<void>.delayed(const Duration(milliseconds: 190));
      if (!mounted) return;
    }
    _setStage(StartStage.done, read: false);
    if (!reduced) {
      await Future<void>.delayed(PracticeStartScreen.nodHold - const Duration(milliseconds: 190));
      if (!mounted) return;
    }
    context.go(AppRoutes.run(sessionId));
  }

  /// The start ended in a stop. The working view (and this Mobi) leaves, and the state view that
  /// takes its place has its own Mobi: he shrugs once at a failure (`oops`, the first of a run)
  /// and rests at an offline stop, so a second Mobi is never drawn here.
  void _stop(String message, StateViewKind kind) {
    _waiting?.cancel();
    _slowTimer?.cancel();
    setState(() {
      _working = false;
      _slow = false;
      _message = message;
      _kind = kind;
    });
  }

  /// Back online after an offline stop: start again without waiting for a tap.
  void _onlineAgain() {
    if (!mounted || _working || _kind != StateViewKind.offline || _selection == null) return;
    _retry();
  }

  void _retry() {
    setState(() {
      _working = true;
      _message = null;
    });
    _armSlow();
    unawaited(_run());
  }

  Widget _stopped() {
    final primary = _selection == null ? null : StateAction(PracticeCopy.retry, _retry);
    final chooseAnother = StateAction(PracticeCopy.chooseAnother, () => context.pushReplacement(_setupLocation));
    return StateView(
      kind: _kind,
      title: _message ?? PracticeCopy.startFailed,
      primary: primary ?? chooseAnother,
      secondary: primary == null ? null : chooseAnother,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    ref.listen(networkRestoredProvider, (_, next) {
      if (next.hasValue) _onlineAgain();
    });
    ref.listen(networkStatusProvider, (previous, next) {
      if (previous == NetworkStatus.offline && next == NetworkStatus.online) _onlineAgain();
    });
    return PopScope(
      canPop: !_committed,
      child: Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned.fill(child: IgnorePointer(child: LightField.lamp(context, strength: 0.7))),
          SafeArea(
            child: _working
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(MmSpace.s24),
                      child: Semantics(
                        liveRegion: true,
                        container: true,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Mobi arrives reading the sheet at once (his first beat is well
                            // under a second); under reduced motion he holds the reading pose.
                            MobiCharacter(controller: _mobi, size: 120, entrance: MobiAct.read, seed: 23),
                            const SizedBox(height: MmSpace.s20),
                            Text(PracticeCopy.gettingReady, style: type.title, textAlign: TextAlign.center),
                            const SizedBox(height: MmSpace.s8),
                            // The note changes, in place, when the wait runs long.
                            AnimatedSwitcher(
                              duration: Motion.of(context, Motion.ui),
                              child: Text(
                                _slow ? PracticeCopy.gettingReadySlow : PracticeCopy.gettingReadyNote,
                                key: ValueKey(_slow),
                                style: type.small.copyWith(color: colors.ink2),
                                textAlign: TextAlign.center,
                              ),
                            ),
                            const SizedBox(height: MmSpace.s20),
                            // The three stages the work really goes through, each ticked as it is done,
                            // and the stopwatch beside them: its long hand steps on as each stage
                            // really begins, and both hands snap to 12 when the paper opens.
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                HybridStopwatch(
                                  height: 64,
                                  stage: math.min(_stage.index, StartStage.labels.length - 1),
                                  stageCount: StartStage.labels.length,
                                  mode: _stage == StartStage.done ? StopwatchMode.done : StopwatchMode.stages,
                                ),
                                const SizedBox(width: MmSpace.s16),
                                Flexible(child: _StageRows(stage: _stage)),
                              ],
                            ),
                            const SizedBox(height: MmSpace.s24),
                            // The paper being drawn, so the subject and length chosen are seen
                            // while the questions come: its ticket rises in once it is known.
                            _PaperTicket(selection: _selection),
                          ],
                        ),
                      ),
                    ),
                  )
                : _stopped(),
          ),
        ],
      ),
      ),
    );
  }
}

/// The three stages as rows: an inked bubble with a check once done, a ring on the one in
/// progress, an empty ring for what is still to come. The words carry the state; the bubble is
/// the second signal. Announced to TalkBack as the stage changes.
class _StageRows extends StatelessWidget {
  const _StageRows({required this.stage});

  final StartStage stage;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 280),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < StartStage.labels.length; i++)
            _StageRow(
              key: ValueKey('stage-$i'),
              label: StartStage.labels[i],
              state: stage.index > i ? _RowState.done : (stage.index == i ? _RowState.current : _RowState.waiting),
            ),
        ],
      ),
    );
  }
}

enum _RowState { waiting, current, done }

class _StageRow extends StatelessWidget {
  const _StageRow({super.key, required this.label, required this.state});

  final String label;
  final _RowState state;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final done = state == _RowState.done;
    final current = state == _RowState.current;
    final ink = Motion.of(context, Motion.ink);
    return Semantics(
      label: done ? '$label, done' : label,
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s4),
        child: Row(
          children: [
            // The bubble inks from the middle (260 ms) and its check arrives with it.
            TweenAnimationBuilder<double>(
              tween: Tween(end: done ? 1 : 0),
              duration: ink,
              curve: Motion.emphasized,
              builder: (context, t, _) => SizedBox.square(
                dimension: 20,
                child: CustomPaint(
                  painter: _StageBubblePainter(
                    t: t,
                    current: current,
                    ring: current ? colors.ink : colors.lineStrong,
                    fill: colors.volt,
                    check: colors.voltInk,
                  ),
                ),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: AnimatedDefaultTextStyle(
                duration: Motion.of(context, Motion.ui),
                style: type.small.copyWith(color: state == _RowState.waiting ? colors.ink3 : colors.ink, fontWeight: current ? FontWeight.w600 : FontWeight.w500),
                child: Text(label),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StageBubblePainter extends CustomPainter {
  const _StageBubblePainter({required this.t, required this.current, required this.ring, required this.fill, required this.check});

  final double t;
  final bool current;
  final Color ring;
  final Color fill;
  final Color check;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2 - 1;
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = current ? 2 : 1.4
        ..color = ring,
    );
    if (t <= 0) return;
    canvas.drawCircle(c, r * t.clamp(0.0, 1.0), Paint()..color = fill);
    if (t < 0.5) return;
    final k = ((t - 0.5) * 2).clamp(0.0, 1.0);
    final p = Path()
      ..moveTo(c.dx - r * 0.42, c.dy + r * 0.02)
      ..lineTo(c.dx - r * 0.1, c.dy + r * 0.36)
      ..lineTo(c.dx + r * 0.46, c.dy - r * 0.32);
    for (final m in p.computeMetrics()) {
      canvas.drawPath(
        m.extractPath(0, m.length * k),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = check,
      );
    }
  }

  @override
  bool shouldRepaint(_StageBubblePainter old) => old.t != t || old.current != current || old.ring != ring || old.fill != fill;
}

/// The paper on its way: the same ticket the confirm step shows (the subject's object, the mode,
/// the subject and the length on its stub). It rises in once the selection is known and
/// keeps its height before then, so nothing jumps.
class _PaperTicket extends ConsumerWidget {
  const _PaperTicket({required this.selection});

  final PracticeSelection? selection;

  static const double height = 124;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = selection;
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final Widget child;
    if (s == null) {
      child = const SizedBox(key: ValueKey('none'), height: height);
    } else {
      final mode = modeTitle(s.mode);
      final subject = subjectNameFor(s.subjectId, catalog);
      child = ComposerTicket(
        key: ValueKey('${s.subjectId}-${s.count}'),
        subjectId: s.subjectId,
        eyebrow: mode,
        subject: subject,
        count: s.mode.usesCount ? s.count : mockQuestionCount,
        semanticsLabel: PracticeCopy.confirmTitle(mode, subject),
        heroTag: ComposerTicket.pageHeroTag,
      );
    }
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 360, minHeight: height),
      child: AnimatedSwitcher(
        duration: Motion.of(context, Motion.glideDuration),
        switchInCurve: Motion.glide,
        transitionBuilder: (child, a) => FadeTransition(
          opacity: a,
          child: SlideTransition(
            position: Tween(begin: const Offset(0, 0.12), end: Offset.zero).animate(a),
            child: child,
          ),
        ),
        child: child,
      ),
    );
  }
}
