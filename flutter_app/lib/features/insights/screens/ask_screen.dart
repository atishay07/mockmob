import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/ai_reply_report.dart';
import '../data/ask_citation.dart';
import '../data/ask_controller.dart';
import '../data/evidence.dart';
import '../data/insights_models.dart';
import '../data/insights_repository.dart';
import '../insights_paths.dart';
import '../widgets/ask_marks.dart';
import '../widgets/ask_messages.dart';
import '../widgets/answer_text.dart';
import '../widgets/ask_prompts.dart';
import '../widgets/motion_bits.dart';
import 'insights_screen.dart';

/// `/ask` (website Mentor), Ask Mobi: a conversation with Mobi about the student's own record.
/// Record questions are answered on the phone for free and cite the sessions behind them;
/// anything else goes through the server's budget guard, and the reply says what it cost. A
/// reply shows only when the server has answered.
///
/// Before the first message the screen is a stage: Mobi on a pool of lamp light says one line
/// about the record it has read, and the questions it can answer are laid out as prompts grouped
/// by intent. Once the conversation starts Mobi moves into the header and acts (thinks while a
/// reply is on its way, talks when it lands).
class AskScreen extends ConsumerStatefulWidget {
  const AskScreen({super.key, this.seed});

  /// Text to start the composer with (from "Ask why" on a question). Never sent by itself.
  final String? seed;

  @override
  ConsumerState<AskScreen> createState() => _AskScreenState();
}

class _AskScreenState extends ConsumerState<AskScreen> {
  late final TextEditingController _text = TextEditingController(text: widget.seed);
  final ScrollController _scroll = ScrollController();
  final MobiController _mobi = MobiController();

  /// How many messages were already there when this screen opened or have since settled: those
  /// appear at once; later ones arrive with motion.
  late int _settled = ref.read(askControllerProvider).messages.length;

  @override
  void initState() {
    super.initState();
    // Local answers need the record; read it if nothing has yet.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (ref.read(insightsRepositoryProvider).value == null) ref.read(insightsRepositoryProvider.notifier).refresh();
    });
  }

  @override
  void dispose() {
    _text.dispose();
    _scroll.dispose();
    _mobi.dispose();
    super.dispose();
  }

  Future<void> _send([String? text]) async {
    final message = (text ?? _text.text).trim();
    // A reply is still on its way: keep the draft where it is, nothing is sent.
    if (message.isEmpty || ref.read(askControllerProvider).busy) return;
    if (!await _disclosed(message)) return;
    if (!mounted || ref.read(askControllerProvider).busy) return;
    ref.read(hapticsProvider).light();
    if (text == null) _text.clear();
    final sending = ref.read(askControllerProvider.notifier).send(message);
    _toEnd();
    await sending;
    _toEnd();
  }

  /// Before the first message that would leave the phone for an AI service, says so once and
  /// waits for the student. Record questions answered on the phone never ask.
  Future<bool> _disclosed(String message) async {
    if (ref.read(askControllerProvider.notifier).answersOnPhone(message)) return true;
    final store = ref.read(insightsPrefsStoreProvider);
    if (await aiServiceDisclosed(store)) return true;
    if (!mounted) return false;
    final go = await showMmSheet<bool>(
      context: context,
      title: InsightsCopy.disclosureTitle,
      builder: (sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(InsightsCopy.disclosureBody, style: sheet.mmType.body),
          const SizedBox(height: MmSpace.s20),
          KeyButton(label: InsightsCopy.disclosureSend, onPressed: () => Navigator.of(sheet).pop(true)),
          const SizedBox(height: MmSpace.s4),
          Center(child: KeyButton.quiet(label: InsightsCopy.disclosureNotNow, onPressed: () => Navigator.of(sheet).pop(false))),
        ],
      ),
    );
    if (go != true) return false;
    await markAiServiceDisclosed(store);
    return true;
  }

  /// Report this reply: the flag sheet, then the report through the outbox. The line after it
  /// says only what happened: reached us, waiting on this phone, or did not reach us.
  Future<void> _report(AskMessage m) async {
    final reason = await showMmSheet<String>(
      context: context,
      title: InsightsCopy.reportTitle,
      builder: (sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final r in InsightsCopy.reportReasons) ...[
            MmSelectRow(title: r, selected: false, onTap: () => Navigator.of(sheet).pop(r)),
            const SizedBox(height: MmSpace.s8),
          ],
        ],
      ),
    );
    if (reason == null || !mounted) return;
    ReplyReportOutcome outcome;
    try {
      outcome = await reportAiReply(
        ref.read(syncCoordinatorProvider),
        reason: reason,
        reply: m.text,
        sessionId: ref.read(askControllerProvider).sessionId,
        requestId: m.requestId,
      );
    } on Object {
      outcome = ReplyReportOutcome.failed;
    }
    if (!mounted) return;
    final line = switch (outcome) {
      ReplyReportOutcome.sent => InsightsCopy.reportSent,
      ReplyReportOutcome.waiting => InsightsCopy.reportWaiting,
      ReplyReportOutcome.failed => InsightsCopy.reportFailed,
    };
    ScaffoldMessenger.maybeOf(context)
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(line), behavior: SnackBarBehavior.floating));
  }

  void _toEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 240), curve: Curves.easeOutCubic);
    });
  }

  /// Mobi acts on what happens in the conversation: it thinks while a reply is on its way, talks
  /// when one lands, and shrugs (never sad) when one cannot come.
  void _react(AskState? prev, AskState next) {
    final before = prev?.messages ?? const <AskMessage>[];
    final now = next.messages;
    if (now.isEmpty) return;
    if (!(prev?.busy ?? false) && next.busy) {
      // The bulb pulses while the reply is on its way (it settles by itself after 12 s).
      _mobi.play(MobiAct.loading);
      return;
    }
    // The pending bubble became a reply or a failure.
    for (var i = 0; i < before.length && i < now.length; i++) {
      if (before[i].sending && !now[i].sending) {
        final m = now[i];
        if (m.failure != null) {
          _mobi.play(MobiAct.oops);
        } else {
          _mobi.play(MobiAct.idle);
          _mobi.say(speechLine(m.text));
          if (m.isModel) ref.read(hapticsProvider).light();
        }
        return;
      }
    }
    // A record answer lands with no wait.
    if (now.length > before.length && !now.last.fromStudent && !now.last.sending && now.last.failure == null) {
      _mobi.play(MobiAct.idle);
      _mobi.say(speechLine(now.last.text));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final state = ref.watch(askControllerProvider);
    ref.listen<AskState>(askControllerProvider, (prev, next) => _react(prev, next));
    final credits = ref.watch(creditsRepositoryProvider).value;
    final paused = credits?.isPaused ?? false;
    final inputs = ref.watch(insightsInputsProvider);
    final record = inputs.insights.value;
    final pro = inputs.pro;
    final name = _firstName(ref.watch(authSnapshotProvider.select((s) => s.name)));
    final pad = MediaQuery.paddingOf(context);
    final conversation = state.messages.isNotEmpty;

    final attempts = inputs.attempts;
    final evidence = attempts == null || record == null ? null : RecordEvidence(attempts, now: ref.watch(nowProvider)());

    // Messages before the first pending reply have settled; the pending one and later arrive
    // with motion. After this frame everything built so far counts as settled.
    final firstPending = state.messages.indexWhere((m) => m.sending);
    final settledNow = firstPending == -1 ? state.messages.length : firstPending;
    final settled = _settled;
    WidgetsBinding.instance.addPostFrameCallback((_) => _settled = settledNow < _settled ? _settled : settledNow);

    final asked = {for (final m in state.messages) if (m.fromStudent) m.text};
    final last = state.messages.isEmpty ? null : state.messages.last;
    final followUps = !conversation || state.busy || last == null || last.failure != null
        ? const <AskPrompt>[]
        : [
            for (final p in [...recordPrompts(record, pro: pro), ...moreRecordPrompts(), ...openPrompts(record)])
              if (!asked.contains(p.text)) p,
          ].take(3).toList();

    void sendPrompt(AskPrompt p) => _send(p.text);

    return Scaffold(
      backgroundColor: colors.ground,
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: 460,
            child: IgnorePointer(
              child: conversation
                  ? LightField.lamp(context, strength: 0.5)
                  : LightField(
                      pools: [
                        LightPool(color: colors.lamp.withValues(alpha: colors.isNight ? 0.26 : 0.18), center: const Alignment(-1, -1.1), radius: 1.05),
                        // The pool Mobi stands in: warm lamp and a breath of volt under it.
                        LightPool(color: colors.lamp.withValues(alpha: colors.isNight ? 0.42 : 0.3), center: const Alignment(0, -0.05), radius: 0.52),
                        LightPool(color: colors.voltGlow, center: const Alignment(0, 0.12), radius: 0.34, strength: 0.7),
                      ],
                    ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _AskHeader(mobi: conversation ? _mobi : null, sessions: record != null && record.isReady ? record.sessions : null),
                Expanded(
                  // A conversation sits on the composer: short threads fill upward from the
                  // bottom, never leaving a dead band under the last reply.
                  child: LayoutBuilder(
                    builder: (context, box) => SingleChildScrollView(
                      controller: _scroll,
                      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s24),
                      child: ConstrainedBox(
                        constraints: BoxConstraints(minHeight: box.maxHeight - MmSpace.s8 - MmSpace.s24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          mainAxisAlignment: conversation ? MainAxisAlignment.end : MainAxisAlignment.start,
                          children: [
                            if (!conversation) ..._stage(record, pro, name, sendPrompt),
                            for (final (i, m) in state.messages.indexed) ...[
                              if (i > 0) SizedBox(height: m.fromStudent ? MmSpace.s20 : MmSpace.s16),
                              AskMessageView(
                                message: m,
                                animate: i >= settled,
                                citation: citationFor(m, record, evidence),
                                onReport: m.isModel ? () => _report(m) : null,
                                onOpenRecord: m.isModel ? () => context.push(InsightsPaths.insights) : null,
                                onRetry: () {
                                  ref.read(askControllerProvider.notifier).retry(i);
                                  _toEnd();
                                },
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                if (followUps.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: MmSpace.s8),
                    child: RiseIn(delay: const Duration(milliseconds: 500), dy: 8, child: FollowUpRail(prompts: followUps, onTap: sendPrompt)),
                  ),
                _Composer(
                  controller: _text,
                  busy: state.busy,
                  onSend: _send,
                  note: paused ? InsightsCopy.askPausedLine : InsightsCopy.askCostLine(credits?.explanationBalance),
                  bottomInset: MediaQuery.viewInsetsOf(context).bottom > 0 ? 0 : pad.bottom,
                  // Mobi leans in to listen while the student types, and stands at ease after.
                  onFocusChange: (focused) {
                    if (!mounted || ref.read(askControllerProvider).busy) return;
                    _mobi.play(focused ? MobiAct.listen : MobiAct.idle);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// The stage before the first message: Mobi and its line, then the prompts by intent.
  List<Widget> _stage(PrepInsights? record, bool pro, String? name, void Function(AskPrompt) send) {
    final ready = record != null && record.isReady;
    final tiles = recordPrompts(record, pro: pro);
    final open = openPrompts(record);
    Duration d(int ms) => Duration(milliseconds: ms);
    Widget pair(AskPrompt a, AskPrompt b, int ms, {bool lead = false}) => IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: RiseIn(delay: d(ms), child: PromptTile(prompt: a, lead: lead, onTap: () => send(a)))),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: RiseIn(delay: d(ms + 70), child: PromptTile(prompt: b, onTap: () => send(b)))),
            ],
          ),
        );
    return [
      Center(
        child: MobiStage(
          size: 132,
          say: InsightsCopy.askGreeting(name, ready ? record.sessions : null),
          semanticLabel: 'Mobi',
          bubbleWidth: 300,
          interactive: true,
        ),
      ),
      const SizedBox(height: MmSpace.s24),
      RiseIn(delay: d(360), child: const AskEyebrow(InsightsCopy.askGroupRecord, note: InsightsCopy.askGroupRecordNote)),
      pair(tiles[0], tiles[1], 420, lead: true),
      const SizedBox(height: MmSpace.s12),
      pair(tiles[2], tiles[3], 540),
      const SizedBox(height: MmSpace.s24),
      RiseIn(delay: d(700), child: const AskEyebrow(InsightsCopy.askGroupOpen, note: InsightsCopy.askGroupOpenNote)),
      for (final (i, p) in open.indexed) ...[
        if (i > 0) const SizedBox(height: MmSpace.s8),
        RiseIn(delay: d(760 + i * 70), child: PromptRow(prompt: p, onTap: () => send(p))),
      ],
    ];
  }

  static String? _firstName(String? full) {
    final t = full?.trim() ?? '';
    if (t.isEmpty) return null;
    return t.split(RegExp(r'\s+')).first;
  }
}

/// The top row: back, Mobi when there is a conversation (it acts there), the title and one line
/// saying how much of the record Mobi has read.
class _AskHeader extends StatelessWidget {
  const _AskHeader({required this.mobi, required this.sessions});

  final MobiController? mobi;
  final int? sessions;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s8, MmSpace.gutter, MmSpace.s8),
      child: Row(
        children: [
          IconButton(
            onPressed: () => context.canPop() ? context.pop() : context.go(AppRoutes.review),
            tooltip: 'Back',
            icon: Icon(LucideIcons.arrowLeft, color: colors.ink),
          ),
          const SizedBox(width: MmSpace.s4),
          if (mobi != null) ...[
            RiseIn(
              dy: 6,
              child: SizedBox(width: 48, height: 52, child: Mobi(pose: MobiPose.idle, size: 48, controller: mobi, semanticLabel: 'Mobi')),
            ),
            const SizedBox(width: MmSpace.s8),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Semantics(header: true, child: Text(InsightsCopy.askTitle, style: type.screenTitle, maxLines: 1, overflow: TextOverflow.ellipsis)),
                if (sessions != null) Text(InsightsCopy.askCaption(sessions!), style: type.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The composer: a floating glass pill with the field and the send disc, and the cost line under
/// it. The disc is volt when there is something to send and goes quiet when there is not; while a
/// reply is on its way it shows the inking bubbles.
class _Composer extends StatefulWidget {
  const _Composer({
    required this.controller,
    required this.busy,
    required this.onSend,
    required this.note,
    required this.bottomInset,
    this.onFocusChange,
  });

  final TextEditingController controller;
  final ValueChanged<bool>? onFocusChange;
  final bool busy;
  final Future<void> Function([String?]) onSend;
  final String note;
  final double bottomInset;

  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      setState(() {});
      widget.onFocusChange?.call(_focus.hasFocus);
    });
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const radius = BorderRadius.all(Radius.circular(28));
    return Padding(
      padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s4, MmSpace.gutter, widget.bottomInset + MmSpace.s8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DecoratedBox(
            position: DecorationPosition.foreground,
            decoration: ShapeDecoration(
              shape: RoundedSuperellipseBorder(
                borderRadius: radius,
                side: _focus.hasFocus ? BorderSide(color: colors.focusRing, width: 1.5) : BorderSide.none,
              ),
            ),
            child: FakeGlass(
              borderRadius: radius,
              opacity: colors.isNight ? 0.86 : 0.94,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s20, 4, 6, 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: widget.controller,
                        focusNode: _focus,
                        minLines: 1,
                        maxLines: 4,
                        maxLength: askMaxChars,
                        textCapitalization: TextCapitalization.sentences,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => widget.busy ? null : widget.onSend(),
                        style: type.body,
                        cursorColor: colors.ink,
                        decoration: InputDecoration(
                          hintText: InsightsCopy.askHint,
                          counterText: '',
                          filled: false,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
                        ),
                      ),
                    ),
                    const SizedBox(width: MmSpace.s8),
                    ValueListenableBuilder(
                      valueListenable: widget.controller,
                      builder: (context, value, _) {
                        final enabled = !widget.busy && value.text.trim().isNotEmpty;
                        return _SendDisc(enabled: enabled, busy: widget.busy, onTap: () => widget.onSend());
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
            child: Text(widget.note, style: type.caption.copyWith(color: colors.ink3), textAlign: TextAlign.center),
          ),
        ],
      ),
    );
  }
}

class _SendDisc extends StatelessWidget {
  const _SendDisc({required this.enabled, required this.busy, required this.onTap});

  final bool enabled;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      semanticsLabel: busy ? InsightsCopy.askSending : InsightsCopy.askSend,
      onTap: enabled ? onTap : null,
      builder: (context, pressed, _) => SizedBox(
        width: MmTarget.min,
        height: MmTarget.min,
        child: Center(
          child: AnimatedContainer(
            duration: Motion.of(context, Motion.ui),
            curve: Motion.glide,
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: enabled ? colors.volt : colors.sunken,
              border: enabled ? null : Border.all(color: colors.line),
            ),
            child: Center(
              child: busy
                  ? const InkDots(size: 6)
                  : Icon(LucideIcons.arrowUp, size: 22, color: enabled ? colors.voltInk : colors.ink3),
            ),
          ),
        ),
      ),
    );
  }
}
