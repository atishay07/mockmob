import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api.dart';
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

  @override
  ConsumerState<PracticeStartScreen> createState() => _PracticeStartScreenState();
}

class _PracticeStartScreenState extends ConsumerState<PracticeStartScreen> {
  String? _message;
  StateViewKind _kind = StateViewKind.error;
  bool _working = true;
  PracticeSelection? _selection;
  final MobiController _mobi = MobiController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_run()));
  }

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
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
    setState(() => _selection = selection);
    if (ref.read(networkStatusProvider) == NetworkStatus.offline) {
      _stop(PracticeCopy.offlineAutoStart, StateViewKind.offline);
      return;
    }
    final LaunchResult result;
    if (selection.isFreshCheck) {
      result = await launchFreshCheck(ref, selection);
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
      // The questions are on their way: Mobi looks up from the sheet and points the way in.
      if (quote.launchable) _mobi.play(MobiAct.point);
      result = await launchPractice(ref, selection, quote);
    }
    if (!mounted) return;
    switch (result) {
      case LaunchStarted(:final sessionId):
        context.go(AppRoutes.run(sessionId));
      case LaunchNeedsLook(:final quote):
        _stop(costLineFor(quote).text ?? PracticeCopy.unavailableFallback, StateViewKind.error);
      case LaunchFailed(:final failure, :final message):
        final offline = failure == StartFailure.offline;
        _stop(
          offline ? PracticeCopy.offlineAutoStart : StartFailureView(failure, message: message).text,
          offline ? StateViewKind.offline : StateViewKind.error,
        );
    }
  }

  void _stop(String message, StateViewKind kind) => setState(() {
    _working = false;
    _message = message;
    _kind = kind;
  });

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
    return Scaffold(
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
                            Text(PracticeCopy.gettingReadyNote, style: type.small.copyWith(color: colors.ink2), textAlign: TextAlign.center),
                            const SizedBox(height: MmSpace.s32),
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
    );
  }
}

/// The paper on its way: the same ticket the confirm step shows (the subject's object, the mode,
/// the subject and the length), on a raised card. It rises in once the selection is known and
/// keeps its height before then, so nothing jumps.
class _PaperTicket extends ConsumerWidget {
  const _PaperTicket({required this.selection});

  final PracticeSelection? selection;

  static const double height = 102;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final s = selection;
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final Widget child;
    if (s == null) {
      child = const SizedBox(key: ValueKey('none'), height: height);
    } else {
      final mode = modeTitle(s.mode);
      final subject = subjectNameFor(s.subjectId, catalog);
      child = DecoratedBox(
        key: ValueKey('${s.subjectId}-${s.count}'),
        decoration: ShapeDecoration(
          color: colors.raised,
          shape: RoundedSuperellipseBorder(
            borderRadius: MmRadius.panelAll,
            side: BorderSide(color: colors.line),
          ),
          shadows: colors.cardShadow,
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: ComposerTicket(
            subjectId: s.subjectId,
            eyebrow: mode,
            subject: subject,
            count: s.mode.usesCount ? s.count : mockQuestionCount,
            semanticsLabel: PracticeCopy.confirmTitle(mode, subject),
          ),
        ),
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
