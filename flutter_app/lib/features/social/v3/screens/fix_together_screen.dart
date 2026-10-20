// R9 Fix it together (MOB-BUILD-SPEC-V3 5.3 R9, F1, F3). Only after the game closes: before that
// the server refuses (REVIEW_NOT_YET / FIX_NOT_YET) and the screen says so.
//
// The lamp-lit answer sheet shows question 4 with YOUR pick struck in pencil and the right one
// filled, then the bank's explanation, with Mobi thinking beside it. Nobody else's pick, ever. Then
// the path (now, and the Wednesday check), the shelf strip toward Crane, and "Try a fresh question":
// your own question, so the answer and the why show at once. The check shows "Your check opens on
// Wednesday 28 Oct." until it opens (no timer).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_providers.dart' show nowProvider;
import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/key_button.dart';
import '../../../../core/widgets/mobi.dart';
import '../../../../core/widgets/pressable.dart';
import '../copy_v3.dart';
import '../data/mob_v3_api.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../widgets/fold_puppet.dart';
import '../widgets/mob_fx.dart';
import '../widgets/results_parts.dart';
import 'moments_screen.dart' show ResultsRefused;

const List<String> _letters = ['A', 'B', 'C', 'D', 'E'];

class FixTogetherScreen extends ConsumerStatefulWidget {
  const FixTogetherScreen({super.key, required this.gameId, required this.q});
  final String gameId;

  /// 0-based trap question (the server's `q`); the copy shows the trap's 1-based `number`.
  final int q;

  @override
  ConsumerState<FixTogetherScreen> createState() => _FixTogetherScreenState();
}

class _FixTogetherScreenState extends ConsumerState<FixTogetherScreen> {
  late Future<({Review review, DateTime? serverNow})> _load = _fetch();

  Future<({Review review, DateTime? serverNow})> _fetch() async {
    final api = ref.read(mobV3ApiProvider);
    final review = await api.review(widget.gameId);
    DateTime? serverNow;
    try {
      serverNow = (await api.game(widget.gameId)).serverNow;
    } on Object {
      serverNow = null;
    }
    return (review: review, serverNow: serverNow);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return Scaffold(
      backgroundColor: c.ground,
      body: MobIdleScope(
        child: FutureBuilder<({Review review, DateTime? serverNow})>(
          future: _load,
          builder: (context, snap) {
            if (snap.hasError) {
              final e = snap.error!;
              final notYet = _code(e) == 'REVIEW_NOT_YET' || _code(e) == 'FIX_NOT_YET';
              return ResultsRefused(
                message: notYet ? MobV3Copy.errors['FIX_NOT_YET']! : MobV3Copy.error(e),
                onBack: () => Navigator.of(context).maybePop(),
                onRetry: notYet ? null : () => setState(() => _load = _fetch()),
              );
            }
            final d = snap.data;
            if (d == null) return const SizedBox.expand();
            return FixTogetherView(
              review: d.review,
              gameId: widget.gameId,
              q: widget.q,
              mobName: ref.watch(denViewProvider)?.v3.name.text ?? '',
              now: d.serverNow ?? ref.read(nowProvider)(),
            );
          },
        ),
      ),
    );
  }
}

String? _code(Object e) {
  try {
    final dynamic d = e;
    final c = d.code;
    return c is String ? c : null;
  } on Object {
    return null;
  }
}

/// The loaded screen (public for tests and goldens).
class FixTogetherView extends ConsumerStatefulWidget {
  const FixTogetherView({super.key, required this.review, required this.gameId, required this.q, required this.mobName, required this.now});

  final Review review;
  final String gameId;
  final int q;
  final String mobName;
  final DateTime now;

  @override
  ConsumerState<FixTogetherView> createState() => _FixTogetherViewState();
}

enum _Stage { sheet, loading, question, answered }

class _FixTogetherViewState extends ConsumerState<FixTogetherView> {
  _Stage _stage = _Stage.sheet;
  FixStart? _fresh;
  int? _pick;
  FixAnswer? _answer;
  String? _error;
  String _which = 'now';

  ReviewQuestion? get _question {
    for (final x in widget.review.questions) {
      if (x.q == widget.q) return x;
    }
    return null;
  }

  DateTime? get _checkOpens => widget.review.trap?.fix.check.opensAt;

  /// 1-based, for the copy ("Question 4").
  int get _number => widget.review.trap?.number ?? widget.q + 1;

  /// The server's check state (not_yet, open, closed, done); an older server sends only the dates.
  String get _checkState {
    final st = widget.review.trap?.fix.check.state;
    if (st != null) return st;
    final o = _checkOpens;
    return o != null && !widget.now.isBefore(o) ? 'open' : 'not_yet';
  }

  bool get _checkOpen => _checkState == 'open';
  bool get _checkNotYet => _checkState == 'not_yet';

  Future<void> _start() async {
    final which = _checkOpen ? 'check' : 'now';
    setState(() {
      _stage = _Stage.loading;
      _error = null;
      _which = which;
    });
    try {
      final f = await ref.read(mobV3ApiProvider).fixStart(game: widget.gameId, q: widget.q, stage: which);
      if (!mounted) return;
      setState(() {
        _fresh = f;
        _stage = _Stage.question;
      });
    } on Object catch (e) {
      if (!mounted) return;
      setState(() {
        _stage = _Stage.sheet;
        _error = MobV3Copy.error(e);
      });
    }
  }

  Future<void> _answerWith(int pick) async {
    if (_pick != null) return;
    setState(() => _pick = pick);
    hapticsOf(context)?.selection();
    try {
      final a = await ref.read(mobV3ApiProvider).fixAnswer(game: widget.gameId, q: widget.q, stage: _which, pick: pick);
      if (!mounted) return;
      setState(() {
        _answer = a;
        _stage = _Stage.answered;
      });
      // The server checked it: confirm (spec 5.0 haptics, after the ack).
      hapticsOf(context)?.confirm();
    } on Object catch (e) {
      if (!mounted) return;
      setState(() {
        _pick = null;
        _error = MobV3Copy.error(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final inQuestion = _stage == _Stage.question || _stage == _Stage.answered;
    final body = inQuestion ? _questionView(context) : _sheetView(context);

    final run = RunStep.maybeOf(context);
    final Widget key;
    if (_stage == _Stage.answered) {
      key = run != null
          ? KeyButton(key: const ValueKey('fix-continue'), label: run.last ? MobV4ResultsCopy.toTheDen : MobV4ResultsCopy.continueKey, onPressed: run.onNext)
          : KeyButton(label: MobV3Copy.backToDen, onPressed: () => Navigator.of(context, rootNavigator: true).popUntil((r) => r.isFirst));
    } else if (_stage == _Stage.question) {
      key = const SizedBox.shrink();
    } else {
      final start = KeyButton(
        key: const ValueKey('fix-start'),
        // In the run the one key names the job (3.4: one key per screen).
        label: _checkOpen ? MobV3Copy.takeCheck : (run != null ? MobV3Copy.fixTogether(_number) : MobV3Copy.tryFresh),
        loading: _stage == _Stage.loading,
        onPressed: _start,
      );
      // In the results run: "Later" moves on without fixing it (the den's Now card keeps it).
      key = run == null
          ? start
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                start,
                const SizedBox(height: MmSpace.s4),
                // A quiet 44 dp text link in ink2, never a second full key (the mock-up's "Later").
                Center(
                  child: MmPressable(
                    key: const ValueKey('fix-later'),
                    onTap: run.onNext,
                    semanticsLabel: MobV4ResultsCopy.later,
                    focusRadius: BorderRadius.circular(999),
                    builder: (context, pressed, _) => ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 44, minWidth: 88),
                      child: Center(
                        child: Text(MobV4ResultsCopy.later, style: type.body.copyWith(color: pressed ? c.ink3 : c.ink2)),
                      ),
                    ),
                  ),
                ),
              ],
            );
    }

    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, MmSpace.gutter, 4),
            child: Row(
              children: [
                MmPressable(
                  onTap: run?.onExit ?? () => Navigator.of(context).maybePop(),
                  semanticsLabel: run != null ? MobV3Copy.close : MobV3Copy.back,
                  focusRadius: BorderRadius.circular(999),
                  builder: (context, pressed, _) => SizedBox(width: 48, height: 48, child: Icon(LucideIcons.x, color: pressed ? c.ink2 : c.ink)),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: runHeaderMiddle(
                    context,
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(MobV3Copy.fixTogether(_number), style: type.subhead.copyWith(color: c.ink)),
                        Text(MobV3Copy.fixSub(widget.mobName.isEmpty ? 'Your Mob' : widget.mobName), style: type.caption.copyWith(color: c.ink3)),
                      ],
                    ),
                  ),
                ),
                // The X side is 4 + 48 + 4; with the 16 gutter a 40 slot centres the dots.
                if (run != null) const SizedBox(width: 40),
              ],
            ),
          ),
          Expanded(
            // The question rises in over the sheet (reduced motion: the switcher's own 120 ms fade).
            child: MmOverlapSwitcher.rise(
              duration: MotionDurations.enter,
              fit: StackFit.expand,
              child: KeyedSubtree(key: ValueKey(inQuestion), child: body),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s8),
              child: Text(_error!, style: type.caption.copyWith(color: c.ink2, fontSize: 14)),
            ),
          Padding(padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16), child: key),
        ],
      ),
    );
  }

  // ---- The answer sheet ------------------------------------------------------------------------------

  Widget _sheetView(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final q = _question;
    final fix = widget.review.trap?.fix;
    final opens = _checkOpens;
    const paper = Color(0xFFEDE6D6);
    const paperInk = Color(0xFF2A251F);
    const paperInk2 = Color(0xFF5C5446);

    // In the results run the sheet lies flat and full width (the mock-up): one job, read without a stage.
    final inRun = RunStep.maybeOf(context) != null;
    final sheet = Transform.rotate(
      angle: Motion.reduced(context) || inRun ? 0 : -0.026,
      child: Container(
        key: const ValueKey('fix-sheet'),
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
        decoration: BoxDecoration(
          color: paper,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: const Color(0xFF000000).withValues(alpha: c.isNight ? 0.45 : 0.14), blurRadius: 18, offset: const Offset(0, 8))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 16,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(MobV3Copy.question(_number), style: type.labelLarge.copyWith(color: paperInk2, fontWeight: FontWeight.w700)),
                Text(MobV3Copy.whyLooked, style: type.labelLarge.copyWith(color: paperInk2)),
              ],
            ),
            if (q != null && q.stem.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(q.stem, style: type.caption.copyWith(color: paperInk2, fontSize: 14, height: 1.4)),
            ],
            if (q != null) ...[
              const SizedBox(height: 12),
              _Bubbles(count: q.options.length, yourPick: q.yourPick, correct: q.correctIndex),
              const SizedBox(height: 12),
              Text(q.explanation, key: const ValueKey('fix-why'), style: type.body.copyWith(color: paperInk, height: 1.45)),
            ],
          ],
        ),
      ),
    );

    // In the results run the header holds the step dots, so the screen names itself here.
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (inRun) ...[
            Text(MobV3Copy.fixTitle, key: const ValueKey('fix-run-title'), style: type.display.copyWith(color: c.ink)),
            const SizedBox(height: MmSpace.s8),
            Text(MobV4ResultsCopy.fixRunSub, style: type.body.copyWith(color: c.ink2)),
            const SizedBox(height: MmSpace.s16),
          ],
          if (inRun)
            sheet
          else
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(
              children: [
                Positioned.fill(child: ColoredBox(color: c.isNight ? Color.alphaBlend(const Color(0x22000000), c.ground) : c.raised2.withValues(alpha: 0.5))),
                const Positioned.fill(child: LampGlow()),
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 28, 14, 20),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(child: sheet),
                      const SizedBox(width: 4),
                      // Mobi thinks beside the sheet, once (its act plays on appear, then holds).
                      const Mobi(pose: MobiPose.think, size: 84),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _PathStep(icon: LucideIcons.send, text: MobV3Copy.pathNow, lit: true)),
              if (opens != null) ...[
                const SizedBox(width: MmSpace.s12),
                Expanded(child: _PathStep(icon: LucideIcons.calendar, text: MobV3Copy.pathCheck(opens), lit: false)),
              ],
            ],
          ),
          if (opens != null && _checkNotYet) ...[
            const SizedBox(height: MmSpace.s12),
            Text(MobV3Copy.checkOpens(opens), key: const ValueKey('fix-check-opens'), style: type.caption.copyWith(color: c.ink3, fontSize: 14)),
          ],
          if (fix != null) ...[
            const SizedBox(height: MmSpace.s16),
            PaperCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            SegmentProgress(have: fix.fixedCount, of: fix.fixedOf, width: 84),
                            const SizedBox(width: 10),
                            Text(MobV3Copy.ofThree(fix.fixedCount, fix.fixedOf), key: const ValueKey('fix-of'), style: type.labelLarge.copyWith(color: c.ink, fontWeight: FontWeight.w700)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(MobV3Copy.fixShelf, style: type.caption.copyWith(color: c.ink2, fontSize: 14, height: 1.4)),
                      ],
                    ),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  FoldPuppet(fold: FoldKey.crane, size: 64, locked: true, blink: false, shadow: false, semanticLabel: MobV3Copy.foldName(FoldKey.crane)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ---- The fresh question -------------------------------------------------------------------------------

  Widget _questionView(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final f = _fresh!;
    final a = _answer;
    final opens = _checkOpens;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(_which == 'check' ? MobV3Copy.checkTitle : MobV3Copy.freshTitle, style: type.title.copyWith(color: c.ink)),
          const SizedBox(height: MmSpace.s12),
          if (f.question.passage != null && f.question.passage!.isNotEmpty) ...[
            Text(f.question.passage!, style: type.body.copyWith(color: c.ink2)),
            const SizedBox(height: MmSpace.s12),
          ],
          PaperCard(child: Text(f.question.stem, key: const ValueKey('fix-fresh-stem'), style: type.question.copyWith(color: c.ink))),
          const SizedBox(height: MmSpace.s16),
          for (var i = 0; i < f.question.options.length; i++) ...[
            if (i > 0) const SizedBox(height: MmSpace.s8),
            _OptionRow(
              key: ValueKey('fix-option-$i'),
              letter: _letters[i.clamp(0, 4)],
              text: f.question.options[i],
              state: a == null
                  ? (_pick == i ? _OptState.picked : _OptState.idle)
                  : (i == a.correctIndex ? _OptState.right : (i == _pick ? _OptState.wrong : _OptState.idle)),
              onTap: a == null && _pick == null ? () => _answerWith(i) : null,
            ),
          ],
          if (a != null) ...[
            const SizedBox(height: MmSpace.s16),
            Text(a.correct ? MobV3Copy.fixRight : MobV3Copy.fixWrong, key: const ValueKey('fix-verdict'), style: type.cardTitle.copyWith(color: c.ink)),
            if (a.explanation.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(a.explanation, style: type.body.copyWith(color: c.ink2)),
            ],
            if (a.fixedTogether) ...[
              const SizedBox(height: MmSpace.s12),
              Text(MobV3Copy.fixTogetherDone, style: type.body.copyWith(color: c.ink)),
            ],
            if (opens != null && _checkNotYet) ...[
              const SizedBox(height: MmSpace.s16),
              Text(MobV3Copy.checkOpens(opens), style: type.caption.copyWith(color: c.ink3, fontSize: 14)),
            ],
          ],
        ],
      ),
    );
  }
}

/// The OMR bubbles: your pick struck through in pencil, the right one filled. Nobody else's pick.
class _Bubbles extends StatelessWidget {
  const _Bubbles({required this.count, required this.yourPick, required this.correct});

  final int count;
  final int? yourPick;
  final int correct;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 8,
      children: [
        for (var i = 0; i < count; i++)
          Semantics(
            label: MobV3Copy.bubbleLabel(_letters[i.clamp(0, 4)], i == yourPick, i == correct),
            excludeSemantics: true,
            child: SizedBox(
              key: ValueKey('fix-bubble-$i${i == yourPick && i != correct ? '-struck' : ''}${i == correct ? '-right' : ''}'),
              width: 38,
              height: 38,
              child: CustomPaint(
                painter: _BubblePainter(filled: i == correct, struck: i == yourPick && i != correct),
                child: Center(
                  child: Text(
                    _letters[i.clamp(0, 4)],
                    style: context.mmType.label.copyWith(
                      color: i == correct ? const Color(0xFFEDE6D6) : const Color(0xFF5C5446),
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _BubblePainter extends CustomPainter {
  _BubblePainter({required this.filled, required this.struck});

  final bool filled;
  final bool struck;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 1.5;
    if (filled) {
      canvas.drawCircle(c, r, Paint()..color = const Color(0xFF1B1915));
    } else {
      canvas.drawCircle(c, r, Paint()
        ..color = const Color(0xFF8C8270)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6);
    }
    if (struck) {
      // A pencil stroke: graphite grey, slightly uneven.
      final p = Paint()
        ..color = const Color(0xCC4A453D)
        ..strokeWidth = 2.2
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(Offset(size.width * 0.16, size.height * 0.84), Offset(size.width * 0.86, size.height * 0.14), p);
      canvas.drawLine(Offset(size.width * 0.2, size.height * 0.86), Offset(size.width * 0.84, size.height * 0.2), p..color = const Color(0x554A453D));
    }
  }

  @override
  bool shouldRepaint(_BubblePainter old) => old.filled != filled || old.struck != struck;
}

class _PathStep extends StatelessWidget {
  const _PathStep({required this.icon, required this.text, required this.lit});

  final IconData icon;
  final String text;
  final bool lit;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final i = text.indexOf('. ');
    final lead = i < 0 ? text : text.substring(0, i + 1);
    final rest = i < 0 ? '' : text.substring(i + 2);
    return Semantics(
      label: text,
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: lit ? c.ink : Colors.transparent,
              border: lit ? null : Border.all(color: c.lineStrong, width: 1.2),
            ),
            child: Icon(icon, size: 16, color: lit ? c.ground : c.ink3),
          ),
          const SizedBox(height: 8),
          Text.rich(TextSpan(children: [
            TextSpan(text: '$lead ', style: type.labelLarge.copyWith(color: c.ink, fontWeight: FontWeight.w700, height: 1.35)),
            TextSpan(text: rest, style: type.labelLarge.copyWith(color: c.ink2, fontWeight: FontWeight.w400, height: 1.35)),
          ])),
        ],
      ),
    );
  }
}

enum _OptState { idle, picked, right, wrong }

class _OptionRow extends StatelessWidget {
  const _OptionRow({super.key, required this.letter, required this.text, required this.state, this.onTap});

  final String letter;
  final String text;
  final _OptState state;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final (Color bg, Color border) = switch (state) {
      _OptState.idle => (c.raised, c.line),
      _OptState.picked => (c.selectedSurface, c.ink3),
      _OptState.right => (Color.alphaBlend(c.goodText.withValues(alpha: 0.16), c.raised), c.goodText),
      _OptState.wrong => (c.wrongSurface, c.wrongBorder),
    };
    return MmPressable(
      onTap: onTap,
      semanticsLabel: '$letter. $text',
      focusRadius: BorderRadius.circular(14),
      builder: (context, pressed, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: Border.all(color: border, width: state == _OptState.idle ? 1 : 1.6)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: state == _OptState.right ? c.goodText : c.ink3, width: 1.4)),
              child: state == _OptState.right
                  ? Icon(LucideIcons.check, size: 16, color: c.goodText)
                  : Text(letter, style: type.label.copyWith(color: c.ink2, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: 12),
            Expanded(child: Padding(padding: const EdgeInsets.only(top: 3), child: Text(text, style: type.body.copyWith(color: c.ink)))),
          ],
        ),
      ),
    );
  }
}
