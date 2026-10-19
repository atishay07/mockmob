import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/auth/display_name.dart';
import '../../../core/connectivity/connectivity_monitor.dart' show NetworkStatus;
import '../../../core/connectivity/connectivity_providers.dart' show networkStatusProvider;
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
import '../data/ask_doors.dart';
import '../data/ask_question.dart';
import '../data/ask_suggestions.dart' show AskSheetCopy;
import '../data/ask_wallet.dart';
import '../data/evidence.dart';
import '../data/insights_models.dart';
import '../data/insights_repository.dart';
import '../data/mobi_api.dart';
import '../data/mobi_models.dart' show StandingStatus;
import '../insights_paths.dart';
import '../widgets/ask_doors.dart';
import '../widgets/ask_marks.dart';
import '../widgets/ask_mobi_button.dart' show AskDoor;
import '../widgets/ask_messages.dart';
import '../widgets/answer_text.dart';
import '../widgets/ask_prompts.dart';
import '../widgets/ask_question_card.dart';
import '../widgets/ask_wallet.dart';
import '../widgets/doubt_thread.dart';
import '../widgets/motion_bits.dart';
import '../widgets/where_you_stand.dart';
import 'insights_screen.dart';

/// `/ask` (website Mentor), Ask Mobi's own screen (ASK-MOBI-1019 option B; the owner's D112 and
/// D114). Before the first message it is two big stacked doors under Mobi's greeting:
///
/// * **Ask now**: any CUET doubt, typed or tapped from a starter. A starter sends at once, with no
///   sheet in between (D53); its price ("1 credit") is on the row before the tap, and the line
///   under the field says what the typed question will cost.
/// * **Ask your record**: it leads with the student's biggest marks leak as a big figure, then the
///   asks the record answers, each with its price. A fresh account sees plainly what the record
///   needs and one key to start it. Pro asks stay visible with a quiet lock (D101).
///
/// The credit line at the foot is the wallet's own numbers. Record questions are answered on the
/// phone for free and cite the sessions behind them; anything else goes through the server's budget
/// guard, and the reply says what it cost. Replies are not streamed: while one is on its way the
/// screen says "Writing a reply" and the reply rises in whole when it lands.
class AskScreen extends ConsumerStatefulWidget {
  const AskScreen({super.key, this.seed, this.questionRef, this.door});

  /// Text to start the composer with (from "Ask why" on a question). Never sent by itself.
  final String? seed;

  /// The repaired mistake Ask was handed (`<attemptId>:<questionId>`, from "Ask Mobi about Q3"):
  /// shown in a card, and sent with every message while it is there. Null for an ordinary visit.
  final String? questionRef;

  /// The door the screen opens at (`?door=now|record`, from Practice's Ask Mobi card): Ask now with
  /// its field ready to type in, or scrolled to the record door. Null opens at the top.
  final AskDoor? door;

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

  /// The Ask now door's field (the stage); the composer at the foot has its own once a
  /// conversation starts. Both hold the same words.
  final FocusNode _doorField = FocusNode();

  /// Mobi at the head of the screen: beside his greeting before the first message, then above the
  /// conversation, where he thinks while a reply is on its way and talks when one lands.
  final MobiController _stageMobi = MobiController();

  /// The Ask now door, the record door and the follow-up rail, so Mobi can glance at what is new
  /// and Practice's "Ask your record" can open the screen at its door.
  final GlobalKey _leadTileKey = GlobalKey();
  final GlobalKey _recordKey = GlobalKey();
  final GlobalKey _railKey = GlobalKey();
  Timer? _glanceTimer;
  bool _stageGlanced = false;
  bool _railShown = false;

  /// "See all 7 questions about your record" is open.
  bool _allRecord = false;

  /// Mobi waves hello the first time Ask opens each day (late at night he is sleepy or asleep);
  /// after that he is simply there. Asked once, here.
  late final MobiAct _entrance = MobiRation.greeting('ask');
  late final bool _greets = MobiRation.speakOnce('ask');

  /// How many messages were already there when this screen opened or have since settled: those
  /// appear at once; later ones arrive with motion.
  late int _settled = ref.read(askControllerProvider).messages.length;

  @override
  void initState() {
    super.initState();
    _doorField.addListener(_onDoorFocus);
    // Local answers need the record; read it if nothing has yet.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Read again on every open (not only when none is held), so the counts are the record's now.
      ref.read(insightsRepositoryProvider.notifier).refresh();
      // A question handed over from a repair is opened (its context read); an ordinary visit hands
      // nothing over, so an earlier question never rides along.
      if (cleanQuestionRef(widget.questionRef) != null) {
        ref.read(askQuestionProvider.notifier).open(widget.questionRef);
      } else {
        ref.read(askQuestionProvider.notifier).clear();
      }
      // A door chosen on Practice's card is a new question: the last conversation is put away so the
      // doors show (an ordinary open keeps it, with "Ask something new" one tap away).
      if (widget.door != null && cleanQuestionRef(widget.questionRef) == null) {
        ref.read(askControllerProvider.notifier).startOver();
      }
      // A question that was on its way when the app closed comes back with Send again.
      ref.read(askControllerProvider.notifier).restoreInterrupted();
      _openAtDoor();
    });
  }

  /// Opens at the door Practice's card asked for, once the route has risen into place.
  void _openAtDoor() {
    final door = widget.door;
    if (door == null || cleanQuestionRef(widget.questionRef) != null) return;
    final wait = Motion.of(context, const Duration(milliseconds: 320));
    final glide = Motion.of(context, const Duration(milliseconds: 360));
    Future<void>.delayed(wait, () {
      if (!mounted || ref.read(askControllerProvider).messages.isNotEmpty) return;
      switch (door) {
        case AskDoor.now:
          _doorField.requestFocus();
        case AskDoor.record:
          final target = _recordKey.currentContext;
          if (target != null && target.mounted) Scrollable.ensureVisible(target, duration: glide, curve: Motion.glide, alignment: 0.04);
      }
    });
  }

  void _onDoorFocus() {
    // Mobi leans in to listen while the student types, and stands at ease after.
    if (!mounted || ref.read(askControllerProvider).busy) return;
    _stageMobi.play(_doorField.hasFocus ? MobiAct.listen : MobiAct.idle);
  }

  @override
  void dispose() {
    _text.dispose();
    _scroll.dispose();
    _doorField
      ..removeListener(_onDoorFocus)
      ..dispose();
    _glanceTimer?.cancel();
    _stageMobi.dispose();
    super.dispose();
  }

  Future<void> _send([String? text]) => _sendWith(text);

  /// Sends [text] (or the field) with what it carries beside its words: a starter's subject and chapter, or the
  /// free `tonight` plan.
  Future<void> _sendWith(String? text, {String? subject, String? chapter, String? replyKind}) async {
    final message = (text ?? _text.text).trim();
    // A reply is still on its way: keep the draft where it is, nothing is sent.
    if (message.isEmpty || ref.read(askControllerProvider).busy) return;
    // The handed-over question is still opening: nothing is sent, and the words stay in the field.
    if (ref.read(askQuestionProvider)?.loading ?? false) return;
    ref.read(hapticsProvider).light();
    if (text == null) _text.clear();
    // "Why did I lose marks in my last paper?" is answered from that paper's own breakdown on the
    // phone: free, at once, and about that one paper, never the whole record.
    if (message == AskDoorCopy.lastPaper && ref.read(askQuestionProvider) == null) {
      final inputs = ref.read(insightsInputsProvider);
      final last = lastPaper(inputs.attempts, ref.read(nowProvider)(), unopened: inputs.unopened);
      if (last != null) {
        ref.read(askControllerProvider.notifier).answerLocally(message, last.answer);
        _toEnd();
        return;
      }
    }
    final sending = ref.read(askControllerProvider.notifier).send(message, subject: subject, chapter: chapter, replyKind: replyKind);
    _toEnd();
    final failure = await sending;
    _toEnd();
    // Too long to send: the words go back into the field to be cut, never lost.
    if (failure == AskFailure.tooLong && mounted && text == null && _text.text.isEmpty) {
      _text.value = TextEditingValue(text: message, selection: TextSelection.collapsed(offset: message.length));
    }
  }

  /// A record door ask: a Pro one explains Pro (never sends), one already answered on the phone
  /// lands at once, and the rest go the way every question goes.
  void _askRecord(DoorAsk a) {
    if (a.locked) {
      showAskProSheet(context, a.intent ?? AskIntent.pace);
      return;
    }
    final answer = a.answer;
    if (answer != null) {
      ref.read(hapticsProvider).light();
      ref.read(askControllerProvider.notifier).answerLocally(a.text, answer);
      _toEnd();
      return;
    }
    // "What should I revise tonight?" is worked out by the server from the record, with no model: free.
    _sendWith(a.text, replyKind: a.intent == AskIntent.plan ? tonightReplyKind : null);
  }

  /// Opens a chapter's practice from Where you stand (the web path maps to the app's own setup).
  void _openPractice(String href) {
    final location = InsightsPaths.locationFor(href);
    if (location == null) return;
    AppRoutes.opensWithGo(location) ? context.go(location) : context.push(location);
  }

  /// Back to the two doors with a fresh conversation (a new doubt is 1 credit; its price is on the key).
  void _startOver() {
    ref.read(askControllerProvider.notifier).startOver();
    _settled = 0;
    _stageGlanced = false;
  }

  /// The credit details, and a fresh read of the wallet behind them.
  void _openWallet() {
    ref.read(creditsRepositoryProvider.notifier).refresh();
    showAskWalletSheet(context);
  }

  /// Practise 10 questions: a quick 10 through setup, so its price shows before it starts.
  void _practise() {
    final location = InsightsPaths.locationFor(AskSheetCopy.firstCheckHref);
    if (location == null) return;
    AppRoutes.opensWithGo(location) ? context.go(location) : context.push(location);
  }

  /// The line under the field: what the question typed there will cost, before it is sent. A
  /// question Mobi answers from the record is free; anything else uses 1 credit, said against the
  /// balance the server last reported. Nothing here is a charge: that line comes with the reply.
  String _noteFor(String typed, AskWallet? wallet, String renew) {
    if (wallet?.paused ?? false) return InsightsCopy.askPausedLine;
    final text = typed.trim();
    final balance = wallet?.total;
    // A question handed over from a repair is only ever answered by a written reply: the line never
    // says record questions are free, because a record answer cannot discuss it.
    if (ref.read(askQuestionProvider)?.ready ?? false) return wallet?.empty ?? false ? InsightsCopy.askNoteEmpty(renew) : InsightsCopy.askNoteCost(balance);
    // A doubt under way: what is typed now is its one follow-up, and it is free.
    if (ref.read(askControllerProvider).thread?.canFollowUp ?? false) {
      return text.isNotEmpty && ref.read(askControllerProvider.notifier).answersOnPhone(text) ? InsightsCopy.askNoteFree : AskDoorCopy.followUpLeft;
    }
    if (text == AskDoorCopy.revise(ref.read(nowProvider)())) return InsightsCopy.askNoteFree;
    if (text.isEmpty) return wallet?.empty ?? false ? InsightsCopy.askNoteEmpty(renew) : InsightsCopy.askNoteIdle(balance);
    if (ref.read(askControllerProvider.notifier).answersOnPhone(text)) return InsightsCopy.askNoteFree;
    final held = ref.read(insightsInputsProvider);
    if (text == AskDoorCopy.lastPaper && lastPaper(held.attempts, ref.read(nowProvider)(), unopened: held.unopened) != null) {
      return InsightsCopy.askNoteFree;
    }
    return wallet?.empty ?? false ? InsightsCopy.askNoteEmpty(renew) : InsightsCopy.askNoteCost(balance);
  }

  /// The line under the composer while a reply is on its way: a record ask waiting for the record
  /// says so; anything else is a written reply, and it says what it uses.
  String? _waitingNote(AskState state) {
    if (!state.busy) return null;
    final i = state.messages.indexWhere((m) => m.sending);
    if (i < 0) return AskDoorCopy.writingNote;
    final anchor = state.messages[i].anchor;
    if (_waitsOnRecord(state, i) || anchor?.replyKind == tonightReplyKind) return InsightsCopy.askNoteFree;
    return anchor?.isFollowUp ?? false ? AskDoorCopy.followUpWriting : AskDoorCopy.writingNote;
  }

  /// The pending reply at [i] answers a record ask that is waiting for the record to load.
  static bool _waitsOnRecord(AskState state, int i) {
    final asked = i > 0 && state.messages[i - 1].fromStudent ? state.messages[i - 1].text : null;
    return asked != null && AskController.isRecordAsk(asked);
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

  /// Mobi looks at something that has just arrived (a door, the follow-ups), once the arriving
  /// content has settled into place.
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
    final now = ref.watch(nowProvider)();
    final renew = renewDay(wallet, now);
    final inputs = ref.watch(insightsInputsProvider);
    final record = inputs.insights.value;
    final pro = inputs.pro;
    final auth = ref.watch(authSnapshotProvider.select((s) => (s.name, s.subjects, s.email)));
    // Never "Hi g16-fresh-1019a": a handle or the email's own prefix is not a name (fresh-account walk, 19 Oct; G16
    // findings 4 and 38). One rule for every screen: core/auth/display_name.dart.
    final name = shownFirstName(auth.$1, email: auth.$3);
    final pad = MediaQuery.paddingOf(context);
    final size = MediaQuery.sizeOf(context);
    final compact = size.width < 380 || size.height < 760;
    final conversation = state.messages.isNotEmpty;
    final hand = ref.watch(askQuestionProvider);
    final withQuestion = hand != null && hand.ready;
    // Offline only when the app's connection monitor already says so (the shell runs it); the screen
    // never starts the monitor itself.
    final offline = ref.exists(networkStatusProvider) && ref.watch(networkStatusProvider) == NetworkStatus.offline;
    // A handed-over question can only be answered by a written reply. When those cannot be bought
    // (paused, no credits, unreadable) Mobi cannot answer it: the card says so once, and the
    // composer goes (a greyed-out field for a question that cannot be asked is a dead end).
    final blockedQuestion = withQuestion && wallet != null && wallet.cannotWrite;
    void dropQuestion() => ref.read(askQuestionProvider.notifier).clear();
    final canReport = ref.watch(aiReplyReportAvailableProvider);
    final stage = !conversation && hand == null;
    // On the doors the credit line ends the scrolling page (M4); the page's foot then clears the
    // gesture bar itself.
    final creditInScroll = stage && !(wallet?.empty ?? false);
    final scrollBottom = creditInScroll ? MmSpace.s8 + (MediaQuery.viewInsetsOf(context).bottom > 0 ? 0 : pad.bottom) : MmSpace.s24;

    final attempts = inputs.attempts;
    final evidence = attempts == null || record == null ? null : RecordEvidence(attempts, now: now);

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
    final followUps = hand != null || !conversation || state.busy || last == null || last.failure != null
        ? const <AskPrompt>[]
        : [
            for (final p in [...recordPrompts(record, pro: pro), ...moreRecordPrompts(), ...openPrompts(record)])
              if (!asked.contains(p.text)) p,
          ].take(3).toList();

    void sendPrompt(AskPrompt p) => _send(p.text);

    // Mobi glances at the Ask now door as the doors arrive, and at the follow-ups when a reply
    // brings new ones. Once each; the glance is a look, not a loop.
    if (stage && !_stageGlanced) {
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
                        LightPool(color: colors.lamp.withValues(alpha: colors.isNight ? 0.42 : 0.3), center: const Alignment(-0.62, -0.42), radius: 0.52),
                        LightPool(color: colors.voltGlow, center: const Alignment(-0.62, -0.3), radius: 0.3, strength: 0.7),
                      ],
                    ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _AskHeader(onCredits: _openWallet),
                Expanded(
                  // A conversation sits on the composer: short threads fill upward from the
                  // bottom, never leaving a dead band under the last reply.
                  child: LayoutBuilder(
                    builder: (context, box) => SingleChildScrollView(
                      controller: _scroll,
                      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: EdgeInsets.fromLTRB(MmSpace.gutter, stage ? MmSpace.s4 : MmSpace.s8, MmSpace.gutter, scrollBottom),
                      child: ConstrainedBox(
                        constraints: BoxConstraints(minHeight: box.maxHeight - MmSpace.s8 - scrollBottom),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          // Short threads keep Mobi at the top and the last reply on the composer:
                          // the space between is the thread's, never a dead band above it. On the
                          // doors the credit line closes the page the same way.
                          mainAxisAlignment: conversation || creditInScroll ? MainAxisAlignment.spaceBetween : MainAxisAlignment.start,
                          children: [
                            if (!conversation && hand != null)
                              ..._questionStage(record, name, hand, blockedQuestion, dropQuestion)
                            else if (!conversation) ...[
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: _doors(
                                  inputs: inputs,
                                  name: name,
                                  subjects: auth.$2,
                                  pro: pro,
                                  now: now,
                                  compact: compact,
                                  offline: offline,
                                  busy: state.busy,
                                  note: (text) => _noteFor(text, wallet, renew),
                                ),
                              ),
                              // M4 (walk 19 Oct): the credit line was pinned under the page and, at 360 dp, sat
                              // over the "Ask your record" key and took a fifth of the screen. It now ends the
                              // page and scrolls with the doors, so nothing is ever under it; the credits pill
                              // in the header shows the balance at all times.
                              if (creditInScroll)
                                Padding(
                                  padding: const EdgeInsets.only(top: MmSpace.s24),
                                  child: AskCreditLine(onTap: _openWallet, flush: true),
                                ),
                            ] else ...[
                              _head(record, name, size: 104, greet: hand == null),
                              // Back to the two doors at any time, once the reply has landed.
                              if (hand == null && !state.busy)
                                Center(
                                  child: KeyButton.secondary(
                                    label: AskDoorCopy.startOver,
                                    expanded: false,
                                    minHeight: MmTarget.min,
                                    onPressed: _startOver,
                                  ),
                                ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  const SizedBox(height: MmSpace.s16),
                                  if (hand != null) ...[
                                    AskQuestionCard(hand: hand, blocked: blockedQuestion, onDrop: dropQuestion),
                                    const SizedBox(height: MmSpace.s20),
                                  ],
                                  for (final (i, m) in state.messages.indexed) ...[
                                    if (i > 0) SizedBox(height: m.fromStudent ? MmSpace.s20 : MmSpace.s16),
                                    AskMessageView(
                                      message: m,
                                      animate: i >= settled,
                                      pendingWords: m.sending && _waitsOnRecord(state, i) ? InsightsCopy.askReading : null,
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
                                    // What the doubt's credit bought: its 2 real CUET questions, under the answer.
                                    if (state.thread case final t? when t.openedAt == i && hand == null) ...[
                                      const SizedBox(height: MmSpace.s32),
                                      DoubtChecks(
                                        thread: t,
                                        record: record,
                                        onAnswer: (id, pick) {
                                          ref.read(hapticsProvider).selection();
                                          ref.read(askControllerProvider.notifier).answerCheck(id, pick);
                                        },
                                        onChapter: (subject, chapter) => ref.read(askControllerProvider.notifier).attachChecks(subject, chapter),
                                      ),
                                    ],
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
                if ((wallet?.empty ?? false) && hand == null) AskOutOfCredits(onDetails: _openWallet),
                // The stage asks inside its Ask now door, and the credit line closes the screen; with no
                // credits left the band above says it instead (once, not twice; the doors keep their room).
                // Once a conversation starts (or a question is handed over) the composer takes the foot.
                if (stage && (wallet?.empty ?? false))
                  SizedBox(height: MediaQuery.viewInsetsOf(context).bottom > 0 ? 0 : pad.bottom)
                else if (!stage && hand == null && state.thread != null && !state.thread!.canFollowUp && !state.busy)
                  DoubtClosed(onNew: _startOver, bottomInset: MediaQuery.viewInsetsOf(context).bottom > 0 ? 0 : pad.bottom)
                else if (!stage && !blockedQuestion)
                  _Composer(
                    controller: _text,
                    hint: hand != null
                        ? InsightsCopy.askHintQuestion
                        : (state.thread?.canFollowUp ?? false)
                            ? AskDoorCopy.followUpOneHint
                            : AskDoorCopy.followUpHint,
                    busy: state.busy || (hand?.loading ?? false),
                    onSend: _send,
                    note: (text) => _waitingNote(state) ?? _noteFor(text, wallet, renew),
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

  /// Mobi above the conversation. The same controller as on the stage, so he never restarts when
  /// the conversation begins.
  Widget _head(PrepInsights? record, String? name, {double size = 132, bool greet = true}) {
    final ready = record != null && record.isReady;
    return Center(
      child: MobiStage(
        controller: _stageMobi,
        size: size,
        entrance: _entrance,
        // With a repaired mistake handed over he says nothing: his line is about the record.
        say: _greets && greet ? InsightsCopy.askGreeting(name, ready ? record.sessions : null) : null,
        semanticLabel: 'Mobi',
        bubbleWidth: 300,
        interactive: true,
      ),
    );
  }

  /// The stage with a question handed over: Mobi, the question card, and one line on what Mobi sees.
  /// No doors: they are about any doubt and the record, and this conversation is about one mistake.
  List<Widget> _questionStage(PrepInsights? record, String? name, AskQuestionHand hand, bool blocked, VoidCallback onDrop) => [
        _head(record, name, greet: false),
        const SizedBox(height: MmSpace.s24),
        AskQuestionCard(hand: hand, blocked: blocked, onDrop: onDrop),
        if (hand.ready && !blocked) ...[
          const SizedBox(height: MmSpace.s16),
          Text(InsightsCopy.questionHint, style: context.mmType.small.copyWith(color: context.mmColors.ink2)),
        ],
      ];

  /// The stage before the first message: Mobi's greeting, then the two doors, stacked. The doors
  /// rise 12 dp in turn (0 and 60 ms); their rows follow 40 ms apart, once per open.
  List<Widget> _doors({
    required InsightsInputs inputs,
    required String? name,
    required List<String> subjects,
    required bool pro,
    required DateTime now,
    required bool compact,
    required bool offline,
    required bool busy,
    required String Function(String) note,
  }) {
    final record = inputs.insights.value;
    final ready = record != null && record.isReady;
    final last = lastPaper(inputs.attempts, now, unopened: inputs.unopened);
    final asks = recordDoorAsks(record, pro: pro, last: last, now: now);
    // Where you stand leads the record door once there is a record to place (an empty standing leaves the door as
    // it was; a slow or failed read says so in its own tile, with Try again).
    final stand = ready ? ref.watch(mobiStandingProvider) : null;
    final standing = stand == null || (stand.value?.status == StandingStatus.empty)
        ? null
        : WhereYouStand(
            standing: stand,
            onPractise: _openPractice,
            onColleges: () => context.push(AppRoutes.colleges),
            onRetry: () => ref.invalidate(mobiStandingProvider),
          );
    return [
      if (offline) ...[
        const InlineBanner(message: AskDoorCopy.offline, tone: BannerTone.offline),
        const SizedBox(height: MmSpace.s12),
      ],
      AskGreeting(
        controller: _stageMobi,
        entrance: _entrance,
        size: compact ? 88 : 104,
        line: ready ? AskDoorCopy.greetHeavy(name, record.sessions) : AskDoorCopy.greetFresh(name),
      ),
      const SizedBox(height: MmSpace.s12),
      RiseIn(
        key: _leadTileKey,
        dy: MmSpace.s12,
        child: AskNowDoor(
          controller: _text,
          focusNode: _doorField,
          starters: askNowStarters(record: record, subjects: subjects),
          // ASK-MOBI-1019 B frames 2 and 3: a heavy record keeps its lead figure above the fold.
          shown: ready ? (compact ? 0 : 1) : (compact ? 1 : 2),
          busy: busy,
          note: note,
          onSend: _send,
          onStarter: (s) => _sendWith(s.text, subject: s.subject, chapter: s.chapter),
        ),
      ),
      const SizedBox(height: MmSpace.s12),
      RiseIn(
        key: _recordKey,
        delay: const Duration(milliseconds: 60),
        dy: MmSpace.s12,
        child: AskRecordDoor(
          record: inputs.insights,
          asks: asks,
          standing: standing,
          shown: standing == null ? 2 : 3,
          offline: offline,
          expanded: _allRecord,
          onToggle: () => setState(() => _allRecord = !_allRecord),
          onAsk: _askRecord,
          onPractise: InsightsPaths.locationFor(AskSheetCopy.firstCheckHref) == null ? null : _practise,
          onRetry: () => ref.read(insightsRepositoryProvider.notifier).refresh(force: true),
        ),
      ),
    ];
  }
}

/// The header of Ask Mobi's screen: a labelled Back key (the owner's D43), the title and the true
/// credit count, which opens the credit details.
class _AskHeader extends StatelessWidget {
  const _AskHeader({required this.onCredits});

  final VoidCallback onCredits;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return SizedBox(
      height: 58,
      child: Row(
        children: [
          const SizedBox(width: MmSpace.gutter),
          MmPressable(
            semanticsLabel: 'Back',
            haptic: MmPressHaptic.selection,
            focusRadius: MmRadius.pillAll,
            onTap: () => context.canPop() ? context.pop() : context.go(AppRoutes.review),
            builder: (context, pressed, _) => SizedBox(
              height: MmTarget.min,
              child: Center(
                child: FakeGlass(
                  borderRadius: MmRadius.pillAll,
                  pressed: pressed,
                  grain: false,
                  child: SizedBox(
                    height: 44,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(10, 0, 16, 0),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(LucideIcons.chevronLeft, size: 20, color: colors.ink),
                          const SizedBox(width: MmSpace.s4),
                          Text('Back', style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          // The title steps down to fit whole (never "Ask Mo..."); at large text the pill does too.
          Expanded(
            child: Semantics(
              header: true,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(InsightsCopy.askTitle, style: type.screenTitle, maxLines: 1, softWrap: false),
              ),
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.4),
            child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerRight, child: AskCreditPill(onTap: onCredits)),
          ),
          const SizedBox(width: MmSpace.gutter),
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
    required this.hint,
    required this.busy,
    required this.onSend,
    required this.note,
    required this.bottomInset,
    this.onFocusChange,
  });

  final TextEditingController controller;
  final String hint;
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
                          hintText: widget.hint,
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
                  child: MmOverlapSwitcher.fade(
                    duration: Motion.crossFade,
                    alignment: Alignment.center,
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
