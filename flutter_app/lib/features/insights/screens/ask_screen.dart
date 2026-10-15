import 'dart:async';

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
import '../data/ask_wallet.dart';
import '../data/evidence.dart';
import '../data/insights_models.dart';
import '../data/insights_repository.dart';
import '../insights_paths.dart';
import '../widgets/ask_marks.dart';
import '../widgets/ask_messages.dart';
import '../widgets/answer_text.dart';
import '../widgets/ask_prompts.dart';
import '../widgets/ask_wallet.dart';
import '../widgets/insights_bits.dart';
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
  // A seed longer than the field accepts is cut to what Send takes, so it can never be sent as
  // something that comes back "too long" with the question gone.
  late final TextEditingController _text = TextEditingController(
    text: widget.seed != null && widget.seed!.length > askMaxChars ? widget.seed!.substring(0, askMaxChars) : widget.seed,
  );
  final ScrollController _scroll = ScrollController();
  /// Mobi at the head of the thread: on the stage before the first message, then smaller above
  /// the conversation, where it thinks while a reply is on its way and talks when one lands.
  final MobiController _stageMobi = MobiController();

  /// The lead prompt tile and the follow-up rail, so Mobi can glance at what is new.
  final GlobalKey _leadTileKey = GlobalKey();
  final GlobalKey _railKey = GlobalKey();
  Timer? _glanceTimer;
  bool _stageGlanced = false;
  bool _railShown = false;

  /// Mobi waves hello the first time Ask opens each day (late at night he is sleepy or asleep) and
  /// says his opening line once per app run; after that he is simply there. Asked once, here.
  late final MobiAct _entrance = MobiRation.greeting('ask');
  late final bool _greets = MobiRation.speakOnce('ask');

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
      // A question that was on its way when the app closed comes back with Send again.
      ref.read(askControllerProvider.notifier).restoreInterrupted();
    });
  }

  @override
  void dispose() {
    _text.dispose();
    _scroll.dispose();
    _glanceTimer?.cancel();
    _stageMobi.dispose();
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
    final failure = await sending;
    _toEnd();
    // Too long to send: the words go back into the field to be cut, never lost.
    if (failure == AskFailure.tooLong && mounted && text == null && _text.text.isEmpty) {
      _text.value = TextEditingValue(text: message, selection: TextSelection.collapsed(offset: message.length));
    }
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

  /// The credit details, and a fresh read of the wallet behind them.
  void _openWallet() {
    ref.read(creditsRepositoryProvider.notifier).refresh();
    showAskWalletSheet(context);
  }

  /// The line under the field: what the question typed there will cost, before it is sent. A
  /// question Mobi answers from the record is free; anything else uses 1 credit, said against the
  /// balance the server last reported. Nothing here is a charge: that line comes with the reply.
  String _noteFor(String typed, AskWallet? wallet, String renew) {
    if (wallet?.paused ?? false) return InsightsCopy.askPausedLine;
    final text = typed.trim();
    final balance = wallet?.total;
    if (text.isEmpty) return wallet?.empty ?? false ? InsightsCopy.askNoteEmpty(renew) : InsightsCopy.askNoteIdle(balance);
    if (ref.read(askControllerProvider.notifier).answersOnPhone(text)) return InsightsCopy.askNoteFree;
    return wallet?.empty ?? false ? InsightsCopy.askNoteEmpty(renew) : InsightsCopy.askNoteCost(balance);
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
    // Mobi answers only what really happened: a nod once the server has it, a shrug when it did
    // not reach us. A report waiting on this phone gets no reaction (nothing has happened yet).
    switch (outcome) {
      case ReplyReportOutcome.sent:
        _stageMobi.react(MobiMoments.act(MobiEvent.saveConfirmed), key: 'ask:report');
      case ReplyReportOutcome.failed:
        _stageMobi.react(MobiMoments.act(MobiEvent.saveFailed), key: 'ask:report');
      case ReplyReportOutcome.waiting:
        break;
    }
    final line = switch (outcome) {
      ReplyReportOutcome.sent => InsightsCopy.reportSent,
      ReplyReportOutcome.waiting => InsightsCopy.reportWaiting,
      ReplyReportOutcome.failed => InsightsCopy.reportFailed,
    };
    ScaffoldMessenger.maybeOf(context)
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(line), behavior: SnackBarBehavior.floating));
  }

  /// Mobi looks at something that has just arrived (a prompt, the follow-ups), once the
  /// arriving content has settled into place.
  void _glanceAt(MobiController who, GlobalKey key, {Duration after = const Duration(milliseconds: 700)}) {
    _glanceTimer?.cancel();
    _glanceTimer = Timer(after, () {
      if (mounted) who.glanceAtWidget(key);
    });
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
      _stageMobi.react(MobiMoments.act(MobiEvent.waiting));
      return;
    }
    // The pending bubble became a reply or a failure.
    for (var i = 0; i < before.length && i < now.length; i++) {
      if (before[i].sending && !now[i].sending) {
        final m = now[i];
        if (m.failure != null) {
          // One shrug a run: a retry that fails again leaves him standing, the line says it.
          if (MobiRation.oopsRun('ask')) {
            _stageMobi.react(MobiMoments.act(MobiEvent.setback));
          } else {
            _stageMobi.play(MobiAct.idle);
          }
        } else {
          _stageMobi.play(MobiAct.idle);
          _stageMobi.say(speechLine(m.text));
          if (m.isModel) ref.read(hapticsProvider).light();
        }
        return;
      }
    }
    // A record answer lands with no wait.
    if (now.length > before.length && !now.last.fromStudent && !now.last.sending && now.last.failure == null) {
      _stageMobi.play(MobiAct.idle);
      _stageMobi.say(speechLine(now.last.text));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final state = ref.watch(askControllerProvider);
    ref.listen<AskState>(askControllerProvider, (prev, next) => _react(prev, next));
    final wallet = ref.watch(askWalletProvider);
    final renew = renewDay(wallet, ref.watch(nowProvider)());
    final inputs = ref.watch(insightsInputsProvider);
    final record = inputs.insights.value;
    final pro = inputs.pro;
    final name = _firstName(ref.watch(authSnapshotProvider.select((s) => s.name)));
    final pad = MediaQuery.paddingOf(context);
    final conversation = state.messages.isNotEmpty;
    final canReport = ref.watch(aiReplyReportAvailableProvider);

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
    // The follow-ups rise once the reply has been read in (the word reveal runs 300 to 900 ms and
    // the footer takes 240 more), one chip after another 60 ms apart.
    final lastIsNew = conversation && state.messages.length - 1 >= settled;
    final revealMs = lastIsNew && !state.messages.last.fromStudent ? (state.messages.last.text.split(RegExp(r'\s+')).length * 18).clamp(300, 900) : 0;
    final followUps = !conversation || state.busy || last == null || last.failure != null
        ? const <AskPrompt>[]
        : [
            for (final p in [...recordPrompts(record, pro: pro), ...moreRecordPrompts(), ...openPrompts(record)])
              if (!asked.contains(p.text)) p,
          ].take(3).toList();

    void sendPrompt(AskPrompt p) => _send(p.text);

    // Mobi glances at the first prompt tile as the prompts arrive, and at the follow-ups when a
    // reply brings new ones. Once each; the glance is a look, not a loop.
    if (!conversation && !_stageGlanced) {
      _stageGlanced = true;
      _glanceAt(_stageMobi, _leadTileKey, after: const Duration(milliseconds: 1400));
    }
    if (followUps.isNotEmpty && !_railShown) {
      _railShown = true;
      _glanceAt(_stageMobi, _railKey, after: const Duration(milliseconds: 800));
    } else if (followUps.isEmpty) {
      _railShown = false;
    }

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
                InsightsHeader(
                  title: InsightsCopy.askTitle,
                  caption: record != null && record.isReady ? InsightsCopy.askCaption(record.sessions) : null,
                  fallback: AppRoutes.review,
                  trailing: AskCreditPill(onTap: _openWallet),
                ),
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
                          // Short threads keep Mobi at the top and the last reply on the composer:
                          // the space between is the thread's, never a dead band above it.
                          mainAxisAlignment: conversation ? MainAxisAlignment.spaceBetween : MainAxisAlignment.start,
                          children: [
                            if (!conversation)
                              ..._stage(record, pro, name, sendPrompt)
                            else ...[
                              _head(record, name, size: 104),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  const SizedBox(height: MmSpace.s16),
                                  for (final (i, m) in state.messages.indexed) ...[
                                    if (i > 0) SizedBox(height: m.fromStudent ? MmSpace.s20 : MmSpace.s16),
                                    AskMessageView(
                                      message: m,
                                      animate: i >= settled,
                                      citation: citationFor(m, record, evidence),
                                      onReport: m.isModel && canReport ? () => _report(m) : null,
                                      onOpenRecord: m.isModel ? () => context.push(InsightsPaths.insights) : null,
                                      onCredits: _openWallet,
                                      renew: renew,
                                      onRetry: () {
                                        ref.read(askControllerProvider.notifier).retry(i);
                                        _toEnd();
                                      },
                                    ),
                                  ],
                                ],
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
                    child: FollowUpRail(key: _railKey, prompts: followUps, onTap: sendPrompt, delay: Duration(milliseconds: revealMs == 0 ? 0 : revealMs + 240)),
                  ),
                if (wallet?.empty ?? false) AskOutOfCredits(onDetails: _openWallet),
                _Composer(
                  controller: _text,
                  busy: state.busy,
                  onSend: _send,
                  note: (text) => _noteFor(text, wallet, renew),
                  bottomInset: MediaQuery.viewInsetsOf(context).bottom > 0 ? 0 : pad.bottom,
                  // Mobi leans in to listen while the student types, and stands at ease after.
                  onFocusChange: (focused) {
                    if (!mounted || ref.read(askControllerProvider).busy) return;
                    _stageMobi.play(focused ? MobiAct.listen : MobiAct.idle);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Mobi and the line it says about the record it has read. The same widget before and after the
  /// first message (only its size changes), so Mobi never restarts when the conversation begins.
  Widget _head(PrepInsights? record, String? name, {double size = 132}) {
    final ready = record != null && record.isReady;
    return Center(
      child: MobiStage(
        controller: _stageMobi,
        size: size,
        entrance: _entrance,
        say: _greets ? InsightsCopy.askGreeting(name, ready ? record.sessions : null) : null,
        semanticLabel: 'Mobi',
        bubbleWidth: 300,
        interactive: true,
      ),
    );
  }

  /// The stage before the first message: Mobi and its line, then the prompts by intent. The first
  /// prompt is the largest and the only lit one; the rest follow in a grid.
  List<Widget> _stage(PrepInsights? record, bool pro, String? name, void Function(AskPrompt) send) {
    final tiles = recordPrompts(record, pro: pro);
    final open = openPrompts(record);
    Duration d(int ms) => Duration(milliseconds: ms);
    return [
      _head(record, name),
      const SizedBox(height: MmSpace.s24),
      RiseIn(delay: d(300), dy: MmSpace.s12, child: const AskEyebrow(InsightsCopy.askGroupRecord, note: InsightsCopy.askGroupRecordNote)),
      RiseIn(
        key: _leadTileKey,
        delay: d(380),
        dy: MmSpace.s12,
        child: PromptTile(prompt: tiles[0], lead: true, onTap: () => send(tiles[0])),
      ),
      const SizedBox(height: MmSpace.s12),
      IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: RiseIn(delay: d(425), dy: MmSpace.s12, child: PromptTile(prompt: tiles[1], onTap: () => send(tiles[1])))),
            const SizedBox(width: MmSpace.s12),
            Expanded(child: RiseIn(delay: d(470), dy: MmSpace.s12, child: PromptTile(prompt: tiles[2], onTap: () => send(tiles[2])))),
          ],
        ),
      ),
      const SizedBox(height: MmSpace.s12),
      RiseIn(delay: d(515), dy: MmSpace.s12, child: PromptTile(prompt: tiles[3], wide: true, onTap: () => send(tiles[3]))),
      const SizedBox(height: MmSpace.s24),
      RiseIn(delay: d(560), dy: MmSpace.s12, child: const AskEyebrow(InsightsCopy.askGroupOpen, note: InsightsCopy.askGroupOpenNote)),
      for (final (i, p) in open.indexed) ...[
        if (i > 0) const SizedBox(height: MmSpace.s8),
        RiseIn(delay: d(605 + i * 45), dy: MmSpace.s12, child: PromptRow(prompt: p, onTap: () => send(p))),
      ],
    ];
  }

  static String? _firstName(String? full) {
    final t = full?.trim() ?? '';
    if (t.isEmpty) return null;
    return t.split(RegExp(r'\s+')).first;
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

  /// The cost line for what is in the field, said again as the student types.
  final String Function(String text) note;
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
                padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s4, MmSpace.s4, MmSpace.s4),
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
            child: ValueListenableBuilder(
              valueListenable: widget.controller,
              builder: (context, value, _) {
                final note = widget.note(value.text);
                // The line changes in place as the question changes (free, or 1 credit).
                return Semantics(
                  liveRegion: true,
                  child: AnimatedSwitcher(
                    duration: Motion.of(context, Motion.crossFade),
                    child: Text(note, key: ValueKey(note), style: type.caption.copyWith(color: colors.ink3), textAlign: TextAlign.center),
                  ),
                );
              },
            ),
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
                  ? const InkDots(size: 6, settleAfter: Duration(seconds: 12))
                  : Icon(LucideIcons.arrowUp, size: 22, color: enabled ? colors.voltInk : colors.ink3),
            ),
          ),
        ),
      ),
    );
  }
}
