import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../../core/router/routes.dart' show AppRoutes;
import '../../../core/sync/sync_providers.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/ai_reply_report.dart';
import '../data/ask_citation.dart';
import '../data/ask_controller.dart';
import '../data/ask_mobi_context.dart';
import '../data/ask_question.dart';
import '../data/ask_sheet_controller.dart';
import '../data/ask_suggestions.dart';
import '../data/ask_wallet.dart';
import '../data/evidence.dart';
import '../data/insights_models.dart';
import '../data/insights_repository.dart';
import '../data/readout.dart';
import '../insights_paths.dart';
import '../screens/insights_screen.dart' show insightsInputsProvider;
import 'ask_messages.dart';
import 'ask_wallet.dart' show askOneBalanceProvider;
import 'insights_bits.dart' show ActionLink;
import 'mobi_mark.dart';
import 'motion_bits.dart';

/// How far below the top of the screen the tallest sheet stops, so the head of the page it was
/// opened over (the question being asked about) stays in view.
const double kAskSheetTopGap = 92;

/// Pushes the Ask Mobi sheet over the current screen. Call through `openAskMobi`, which sets what
/// the sheet is about first.
///
/// The sheet is as tall as its content, up to [kAskSheetTopGap] below the top. It rises in 380 ms
/// on the drawer curve, follows the finger while dragged and leaves in 220 ms; under reduced
/// motion it fades.
Future<void> showAskMobiSheet(BuildContext context) {
  final colors = context.mmColors;
  final reduced = Motion.reduced(context);
  final navigator = Navigator.of(context, rootNavigator: true);
  final localizations = MaterialLocalizations.of(context);
  return navigator.push(MmSheetRoute<void>(
    capturedThemes: InheritedTheme.capture(from: context, to: navigator.context),
    barrierLabel: localizations.scrimLabel,
    barrierOnTapHint: localizations.scrimOnTapHint(localizations.bottomSheetLabel),
    isScrollControlled: true,
    useSafeArea: true,
    isDismissible: true,
    enableDrag: true,
    backgroundColor: Colors.transparent,
    modalBarrierColor: colors.sheetScrim,
    elevation: 0,
    clipBehavior: Clip.none,
    constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
    shape: const RoundedRectangleBorder(),
    settings: const RouteSettings(name: 'ask-mobi'),
    sheetAnimationStyle: AnimationStyle(
      duration: reduced ? Motion.reducedFade : const Duration(milliseconds: 380),
      reverseDuration: reduced ? Motion.reducedFade : const Duration(milliseconds: 220),
      curve: reduced ? Curves.linear : Motion.drawer,
      reverseCurve: reduced ? Curves.linear : Motion.exit,
    ),
    builder: (context) => const MmSheetReleaseTracker(child: AskMobiSheet()),
  ));
}

/// "1 November" to "1 Nov".
String _shortDay(String day) {
  final parts = day.split(' ');
  // A no-break space keeps "1 Nov" on one line when the credits line wraps.
  return parts.length == 2 && parts[1].length > 3 ? '${parts[0]} ${parts[1].substring(0, 3)}' : day;
}

/// Ask Mobi as a sheet (ASK-MOBI-1018 sections 4 and 7): the header with Mobi's flat mark, the
/// context chips, what the sheet opens with (the question, or the free first answer), the asks
/// with their prices, the conversation, and the composer with the credits line under it.
///
/// Every ask says its price before it is sent. Record asks are answered on the phone for free; a
/// written reply goes through the server's budget guard and its line says what it used. A reply
/// that did not arrive is sent again with the same request id, so it is never charged twice.
class AskMobiSheet extends ConsumerStatefulWidget {
  const AskMobiSheet({super.key});

  @override
  ConsumerState<AskMobiSheet> createState() => _AskMobiSheetState();
}

class _AskMobiSheetState extends ConsumerState<AskMobiSheet> {
  late final TextEditingController _text = TextEditingController(text: _seed());
  final ScrollController _scroll = ScrollController();
  bool _summary = false;

  /// Messages that were there when the sheet opened appear at once; later ones arrive with motion.
  late int _settled = ref.read(askSheetControllerProvider).messages.length;

  String? _seed() {
    final s = ref.read(askSheetScopeProvider).context.seed;
    return s != null && s.length > askMaxChars ? s.substring(0, askMaxChars) : s;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Record answers need the record, and prices need the wallet.
      // The record is read again each time the sheet opens, not only when none is held: the chip's session count and the
      // answers below it come from the same read, so a copy left over from an hour ago never disagrees with them (v15 walk:
      // the chip said 17 sessions while the answer said 19). The copy on the phone shows meanwhile.
      ref.read(insightsRepositoryProvider.notifier).refresh();
      if (ref.read(creditsRepositoryProvider).value == null) ref.read(creditsRepositoryProvider.notifier).refresh();
      // Back to a conversation already under way: its latest turn is in view.
      if (ref.read(askSheetControllerProvider).messages.isNotEmpty && _scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  @override
  void dispose() {
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  AskSheetController get _ask => ref.read(askSheetControllerProvider.notifier);

  void _toEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: Motion.of(context, Motion.ui), curve: Motion.glide);
    });
  }

  /// Sends an ask. A free suggestion lands from its [local] answer; anything else goes through the
  /// controller, which answers record questions on the phone and sends the rest to Mobi.
  Future<void> _send(String text, {RecordAnswer? local, bool fromField = false}) async {
    final message = text.trim();
    if (message.isEmpty || ref.read(askSheetControllerProvider).busy) return;
    if (local != null) {
      ref.read(hapticsProvider).light();
      _ask.answerLocally(message, local);
      _toEnd();
      return;
    }
    if (ref.read(askSheetQuestionProvider)?.loading ?? false) return;
    ref.read(hapticsProvider).light();
    if (fromField) _text.clear();
    final sending = _ask.send(message);
    _toEnd();
    final failure = await sending;
    _toEnd();
    if (failure == AskFailure.tooLong && mounted && fromField && _text.text.isEmpty) {
      _text.value = TextEditingValue(text: message, selection: TextSelection.collapsed(offset: message.length));
    }
  }

  /// Leaves the sheet for [location] (a reply's next move, the full record).
  void _go(String location) {
    final router = GoRouter.maybeOf(context);
    Navigator.of(context).maybePop();
    router?.push(location);
  }

  /// The fine print of a written reply: it can be wrong, what it cost, and Report this reply.
  Future<void> _about(AskMessage m) async {
    final canReport = ref.read(aiReplyReportAvailableProvider);
    final report = await showMmSheet<bool>(
      context: context,
      title: InsightsCopy.aboutReply,
      builder: (sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(InsightsCopy.aiCaveat, style: sheet.mmType.body),
          const SizedBox(height: MmSpace.s8),
          Text(InsightsCopy.chargedLine(m.charged, m.left), style: sheet.mmType.small.copyWith(color: sheet.mmColors.ink2)),
          if (canReport) ...[
            const SizedBox(height: MmSpace.s16),
            KeyButton.secondary(label: InsightsCopy.reportReply, onPressed: () => Navigator.of(sheet).pop(true)),
          ],
        ],
      ),
    );
    if (report != true || !mounted) return;
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
        sessionId: ref.read(askSheetControllerProvider).sessionId,
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

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final media = MediaQuery.of(context);
    final inset = media.viewInsets.bottom;

    final scope = ref.watch(askSheetScopeProvider);
    final about = scope.effective;
    final hand = ref.watch(askSheetQuestionProvider);
    final questionFailed = !scope.dropped && hand?.status == AskQuestionStatus.error;
    // A question that could not be opened drops back to the record; the line below says so.
    final ctx = questionFailed ? const AskMobiContext.page() : about;
    final state = ref.watch(askSheetControllerProvider);
    final wallet = ref.watch(askSheetWalletProvider);
    final renew = _shortDay(renewDay(wallet, ref.watch(nowProvider)()));
    final inputs = ref.watch(insightsInputsProvider);
    final record = inputs.insights.value;
    final pro = inputs.pro;
    final attempts = inputs.attempts;
    final evidence = attempts == null || record == null ? null : RecordEvidence(attempts, now: ref.watch(nowProvider)());
    final cannotWrite = wallet != null && wallet.cannotWrite;
    final newStudent = record != null && !record.isReady && ctx.kind != AskMobiKind.question;

    final firstPending = state.messages.indexWhere((m) => m.sending);
    final settledNow = firstPending == -1 ? state.messages.length : firstPending;
    final settled = _settled;
    WidgetsBinding.instance.addPostFrameCallback((_) => _settled = settledNow < _settled ? _settled : settledNow);

    final conversation = state.messages.isNotEmpty;
    final asked = {for (final m in state.messages) if (m.fromStudent) m.text};
    final opening = openingFor(ctx, record, pro: pro);
    final suggestions = [for (final s in suggestionsFor(ctx, record, pro: pro)) if (!asked.contains(s.sent)) s];
    final shown = conversation || opening != null ? suggestions.take(2).toList() : suggestions.take(3).toList();
    final showSuggestions = shown.isNotEmpty && !state.busy && (state.messages.isEmpty || state.messages.last.failure == null);
    final suggestionsTitle = newStudent
        ? AskSheetCopy.youCanAsk
        : ctx.kind == AskMobiKind.question && !conversation
            ? AskSheetCopy.askAboutQuestion
            : !conversation && opening == null
                ? AskSheetCopy.youCanAsk
                : AskSheetCopy.askNext;
    final label = ctx.kind == AskMobiKind.question ? ctx.chipLabel : null;
    final firstCheck = InsightsPaths.locationFor(AskSheetCopy.firstCheckHref);

    final body = <Widget>[
      if (questionFailed) ...[
        Text(AskSheetCopy.questionFailed, style: context.mmType.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
      ],
      if (cannotWrite) ...[
        _Notice(text: wallet.paused ? AskSheetCopy.paused : (wallet.empty ? AskSheetCopy.noCredits(renew) : AskSheetCopy.blocked)),
        const SizedBox(height: MmSpace.s16),
      ],
      if (ctx.kind == AskMobiKind.question) ...[
        _QuestionQuote(question: ctx.question, hand: hand),
        const SizedBox(height: MmSpace.s20),
      ] else if (newStudent) ...[
        _NewStudent(onStart: firstCheck == null ? null : () => _go(firstCheck)),
        const SizedBox(height: MmSpace.s24),
      ] else if (opening != null) ...[
        _AnswerBlock(
          reply: opening.reply,
          lines: opening.lines,
          title: opening.title,
          // A mock's breakdown is that paper's own count and Today's facts are its own figures; only an
          // opening read from the whole record names how much of the record it read.
          source: ctx.kind == AskMobiKind.mock && ctx.lines.isNotEmpty
              ? AskSheetCopy.sourceFrom(ctx.label ?? 'this mock')
              : ctx.kind == AskMobiKind.today && ctx.lines.isNotEmpty
                  ? AskSheetCopy.sourceRecord(null, 0)
                  : AskSheetCopy.sourceRecord(record?.questions, record?.sessions ?? 0),
          next: _nextMove(opening.actions),
          onGo: _go,
          animate: false,
        ),
        const SizedBox(height: MmSpace.s24),
      ],
      for (final (i, m) in state.messages.indexed) ...[
        if (i > 0) SizedBox(height: m.fromStudent ? MmSpace.s24 : MmSpace.s12),
        _turn(m, i, animate: i >= settled, label: label, record: record, evidence: evidence, renew: renew),
      ],
      if (showSuggestions) ...[
        if (conversation) const SizedBox(height: MmSpace.s24),
        Semantics(header: true, child: Text(suggestionsTitle, style: context.mmType.label.copyWith(color: colors.ink2))),
        const SizedBox(height: MmSpace.s4),
        for (final (i, s) in shown.indexed)
          RiseIn(
            key: ValueKey('ask:${s.text}'),
            delay: Duration(milliseconds: 40 * i),
            duration: const Duration(milliseconds: 220),
            dy: MmSpace.s4,
            child: _AskRow(
              suggestion: s,
              divider: i > 0,
              disabled: !s.free && cannotWrite,
              onTap: () => _send(s.sent, local: s.answer),
            ),
          ),
      ],
    ];

    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: (media.size.height - kAskSheetTopGap - inset).clamp(240.0, double.infinity)),
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: colors.raised,
            shape: RoundedRectangleBorder(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              side: BorderSide(color: colors.line),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Center(child: Padding(padding: EdgeInsets.only(top: MmSpace.s12, bottom: MmSpace.s4), child: MmSheetHandle())),
              _Header(onClose: () => Navigator.of(context).maybePop()),
              Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s16, 0, MmSpace.s16, MmSpace.s12),
                child: _ContextRow(
                  about: questionFailed ? null : about,
                  record: record,
                  recordFailed: record == null && inputs.insights.isFailedEmpty,
                  onDrop: () => ref.read(askSheetScopeProvider.notifier).drop(),
                  onRecord: () => setState(() => _summary = !_summary),
                  onRetry: () => ref.read(insightsRepositoryProvider.notifier).refresh(),
                  summaryOpen: _summary,
                ),
              ),
              AnimatedSize(
                duration: Motion.of(context, Motion.ui),
                curve: Motion.glide,
                alignment: Alignment.topCenter,
                child: _summary && record != null
                    ? _RecordSummary(lines: recordSummary(record, pro: pro), onFull: () => _go(InsightsPaths.insights))
                    : const SizedBox(width: double.infinity),
              ),
              Divider(height: 1, thickness: 1, color: colors.line),
              Flexible(
                child: SingleChildScrollView(
                  controller: _scroll,
                  padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s16, MmSpace.s20, MmSpace.s16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: body),
                ),
              ),
              Divider(height: 1, thickness: 1, color: colors.line),
              _Composer(
                controller: _text,
                hint: AskSheetCopy.hint(ctx.kind == AskMobiKind.question ? ctx.chipLabel : null),
                busy: state.busy || (hand?.loading ?? false),
                walletLine: walletLine(
                  total: wallet?.total,
                  includedMonthly: wallet?.includedMonthly,
                  bonus: wallet?.bonus,
                  // A pause is said once, in the notice above; the credits themselves are untouched.
                  resetsOn: renew,
                  oneBalance: ref.watch(askOneBalanceProvider),
                ),
                note: (typed) {
                  if (typed.trim().isEmpty) return AskSheetCopy.recordFree;
                  return _ask.answersOnPhone(typed) ? AskSheetCopy.thisIsFree : AskSheetCopy.thisCosts;
                },
                canSend: (typed) => !cannotWrite || _ask.answersOnPhone(typed),
                onSend: (typed) => _send(typed, fromField: true),
                onCredits: () => _go(AppRoutes.youCredits),
                bottomPad: inset > 0 ? 0 : media.padding.bottom,
              ),
            ],
          ),
        ),
      ),
    );
  }

  (String, String)? _nextMove(List<(String, String)> actions) {
    for (final (label, href) in actions) {
      if (InsightsPaths.locationFor(href) case final location?) return (label, location);
    }
    return null;
  }

  Widget _turn(AskMessage m, int i, {required bool animate, String? label, PrepInsights? record, RecordEvidence? evidence, required String renew}) {
    Widget child;
    if (m.fromStudent) {
      child = _StudentAsk(text: m.text);
    } else if (m.sending) {
      child = _Waiting(label: label, question: label != null);
    } else if (m.failure != null) {
      // The failure words, the credit line and Send again, exactly as on the Ask screen: the retry
      // reuses the request id, so a reply that did arrive is never charged twice.
      child = _Framed(
        child: AskMessageView(message: m, renew: renew, indented: false, onRetry: () {
          _ask.retry(i);
          _toEnd();
        }),
      );
    } else {
      final cite = citationFor(m, record, evidence);
      final source = switch (m.origin) {
        AskOrigin.model => AskSheetCopy.sourceWritten(label, m.charged, m.left),
        AskOrigin.paused => AskSheetCopy.sourcePaused,
        _ => AskSheetCopy.sourceRecord(cite?.questions, cite?.sessions.length ?? 0),
      };
      child = _AnswerBlock(
        reply: m.text,
        source: source,
        next: _nextMove(m.actions),
        onGo: _go,
        onAbout: m.isModel ? () => _about(m) : null,
        animate: false,
      );
    }
    if (!animate) return child;
    return RiseIn(dy: MmSpace.s4, duration: const Duration(milliseconds: 220), curve: Motion.out, child: child);
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s20, 0, MmSpace.s8, MmSpace.s4),
      child: Row(
        children: [
          const MobiMark(size: 24),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Semantics(header: true, child: Text(AskSheetCopy.title, style: context.mmType.title.copyWith(fontSize: 19))),
          ),
          MmPressable(
            semanticsLabel: AskSheetCopy.close,
            focusRadius: MmRadius.pillAll,
            pressedScale: 0.97,
            onTap: onClose,
            builder: (context, pressed, _) => SizedBox.square(
              dimension: MmTarget.min,
              child: Center(child: Icon(LucideIcons.x, size: 22, color: pressed ? colors.ink2 : colors.ink)),
            ),
          ),
        ],
      ),
    );
  }
}

/// The context chips: what Mobi is asked about (its x drops back to the record) and the record.
class _ContextRow extends StatelessWidget {
  const _ContextRow({
    required this.about,
    required this.record,
    required this.recordFailed,
    required this.onDrop,
    required this.onRecord,
    required this.onRetry,
    required this.summaryOpen,
  });

  final AskMobiContext? about;
  final PrepInsights? record;
  final bool recordFailed;
  final bool summaryOpen;
  final VoidCallback onDrop;
  final VoidCallback onRecord;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final subject = about?.chipLabel;
    return Wrap(
      spacing: MmSpace.s8,
      runSpacing: MmSpace.s4,
      children: [
        if (subject != null) _Chip(label: subject, detail: about!.chipDetail, onDrop: onDrop, selected: true),
        if (recordFailed)
          _Chip(label: AskSheetCopy.recordNotLoaded, detail: AskSheetCopy.retry, onTap: onRetry)
        else
          _Chip(
            label: AskSheetCopy.recordChip,
            detail: record == null ? null : AskSheetCopy.recordSessions(record!.isReady ? record!.sessions : 0),
            onTap: record != null && record!.isReady ? onRecord : null,
            expanded: summaryOpen,
          ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, this.detail, this.onTap, this.onDrop, this.selected = false, this.expanded});

  final String label;
  final String? detail;
  final VoidCallback? onTap;
  final VoidCallback? onDrop;
  final bool selected;
  final bool? expanded;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final face = DecoratedBox(
      decoration: ShapeDecoration(
        color: selected ? colors.sunken : null,
        shape: RoundedRectangleBorder(borderRadius: MmRadius.smallAll, side: BorderSide(color: colors.lineStrong)),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s6, onDrop != null ? 0 : MmSpace.s12, MmSpace.s6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text.rich(
                TextSpan(children: [
                  TextSpan(text: label, style: type.small.copyWith(fontWeight: FontWeight.w700, color: colors.ink)),
                  if (detail != null) TextSpan(text: ' · $detail', style: type.small.copyWith(color: colors.ink2)),
                ]),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            // Room for the drop key laid over the chip's end.
            if (onDrop != null) const SizedBox(width: 34),
          ],
        ),
      ),
    );
    final hit = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: MmTarget.min),
      child: Align(widthFactor: 1, child: face),
    );
    if (onDrop != null) {
      return Stack(
        alignment: Alignment.centerRight,
        children: [
          Semantics(container: true, label: detail == null ? label : '$label, $detail', excludeSemantics: true, child: hit),
          MmPressable(
            semanticsLabel: AskSheetCopy.dropSubject(label),
            focusRadius: MmRadius.smallAll,
            onTap: onDrop,
            builder: (context, pressed, _) => SizedBox(
              width: 36,
              height: MmTarget.min,
              child: Center(child: Icon(LucideIcons.x, size: 15, color: pressed ? colors.ink : colors.ink2)),
            ),
          ),
        ],
      );
    }
    if (onTap == null) return Semantics(container: true, label: detail == null ? label : '$label, $detail', excludeSemantics: true, child: hit);
    return MmPressable(
      semanticsLabel: detail == null ? label : '$label, $detail',
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.97,
      selected: expanded,
      onTap: onTap,
      builder: (context, pressed, _) => hit,
    );
  }
}

/// The record chip opened: the marks ledger, the biggest leak and pace, then Full record.
class _RecordSummary extends StatelessWidget {
  const _RecordSummary({required this.lines, required this.onFull});

  final List<String> lines;
  final VoidCallback onFull;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.s20, 0, MmSpace.s20, MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final l in lines)
            Padding(padding: const EdgeInsets.only(bottom: MmSpace.s4), child: Text(l, style: type.small.copyWith(color: colors.ink))),
          ActionLink(label: AskSheetCopy.fullRecord, onTap: onFull),
        ],
      ),
    );
  }
}

/// The question in three lines, then what was picked and the key, as far as they are known.
class _QuestionQuote extends StatelessWidget {
  const _QuestionQuote({required this.question, required this.hand});

  final AskMobiQuestion? question;
  final AskQuestionHand? hand;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final served = hand?.context;
    final stem = question?.stem ?? served?.question;
    final pick = question?.pickLetter ?? served?.pickLetter;
    final key = question?.keyLetter;
    final keyKnown = served?.hasKey ?? true;
    if (stem == null) {
      return Text(hand?.loading ?? false ? AskSheetCopy.openingQuestion : '', style: type.small.copyWith(color: colors.ink2));
    }
    return DecoratedBox(
      decoration: ShapeDecoration(color: colors.sunken, shape: const RoundedRectangleBorder(borderRadius: MmRadius.keyAll)),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(stem, style: type.small.copyWith(color: colors.ink, height: 1.5), maxLines: 3, overflow: TextOverflow.ellipsis),
            if (pick != null || (key != null && keyKnown)) ...[
              const SizedBox(height: MmSpace.s8),
              Wrap(
                spacing: MmSpace.s16,
                runSpacing: MmSpace.s4,
                children: [
                  if (pick != null)
                    Text(AskSheetCopy.youPicked(pick, question?.pickText), style: type.caption.copyWith(color: colors.badText, fontWeight: FontWeight.w600)),
                  if (key != null && keyKnown)
                    Text(AskSheetCopy.keyIs(key, question?.keyText), style: type.caption.copyWith(color: colors.goodText, fontWeight: FontWeight.w600)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// A student with no sessions: the real Mobi, what Mobi will do, and one first step.
class _NewStudent extends StatelessWidget {
  const _NewStudent({required this.onStart});

  final VoidCallback? onStart;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const MobiCharacter(size: 96, still: true, shadow: false),
        const SizedBox(height: MmSpace.s12),
        Text(AskSheetCopy.newStudent, style: context.mmType.body.copyWith(fontWeight: FontWeight.w600)),
        if (onStart != null) ...[
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(label: AskSheetCopy.firstCheck, expanded: false, minHeight: MmTarget.min, onPressed: onStart),
        ],
      ],
    );
  }
}

/// A failure, framed so its words and Send again read as one notice.
class _Framed extends StatelessWidget {
  const _Framed({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: ShapeDecoration(shape: RoundedRectangleBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: context.mmColors.lineStrong))),
        child: Padding(padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s4), child: child),
      );
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      liveRegion: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(shape: RoundedRectangleBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: colors.lineStrong))),
        child: Padding(padding: const EdgeInsets.all(MmSpace.s16), child: Text(text, style: context.mmType.small.copyWith(color: colors.ink))),
      ),
    );
  }
}

/// The student's ask, on a quiet surface at the start of the line.
class _StudentAsk extends StatelessWidget {
  const _StudentAsk({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Align(
      alignment: Alignment.centerLeft,
      child: FractionallySizedBox(
        widthFactor: 0.86,
        alignment: Alignment.centerLeft,
        child: Align(
          alignment: Alignment.centerLeft,
          child: DecoratedBox(
            decoration: ShapeDecoration(color: colors.sunken, shape: const RoundedRectangleBorder(borderRadius: MmRadius.keyAll)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
              child: Text(text, style: context.mmType.small.copyWith(color: colors.ink, fontWeight: FontWeight.w500)),
            ),
          ),
        ),
      ),
    );
  }
}

/// A written reply on its way: Mobi's eyes blink once every 1.6 s beside what is being read.
/// After 12 s the words say it is still working, so a long wait reads as a wait.
class _Waiting extends StatefulWidget {
  const _Waiting({required this.label, required this.question});

  final String? label;
  final bool question;

  @override
  State<_Waiting> createState() => _WaitingState();
}

class _WaitingState extends State<_Waiting> {
  Timer? _timer;
  bool _long = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(seconds: 12), () {
      if (mounted) setState(() => _long = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final words = _long ? AskSheetCopy.stillWriting : (widget.question ? AskSheetCopy.reading(widget.label) : AskSheetCopy.writing);
    return Semantics(
      liveRegion: true,
      label: words,
      excludeSemantics: true,
      child: Row(
        children: [
          const MobiMark(size: 20, blinking: true),
          const SizedBox(width: MmSpace.s12),
          Flexible(child: Text(words, style: context.mmType.small.copyWith(color: context.mmColors.ink2))),
        ],
      ),
    );
  }
}

/// A reply: the words, the line saying where they came from and what they used, and at most one
/// next move as an outline key.
class _AnswerBlock extends StatelessWidget {
  const _AnswerBlock({required this.reply, required this.source, required this.onGo, this.lines = const [], this.title, this.next, this.onAbout, this.animate = false});

  final String reply;

  /// Figures shown one to a line, in place of [reply].
  final List<String> lines;
  final String? title;
  final String source;
  final (String, String)? next;
  final void Function(String location) onGo;
  final VoidCallback? onAbout;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Text(title!, style: type.small.copyWith(fontWeight: FontWeight.w700, color: colors.ink)),
            const SizedBox(height: MmSpace.s4),
          ],
          if (lines.isNotEmpty)
            for (final (i, l) in lines.indexed) ...[
              if (i > 0) const SizedBox(height: MmSpace.s8),
              Text(l, style: type.small.copyWith(color: colors.ink, height: 1.5)),
            ]
          else if (reply.isNotEmpty)
            Text(reply, style: type.small.copyWith(color: colors.ink, height: 1.55)),
          const SizedBox(height: MmSpace.s8),
          Row(
            children: [
              const MobiMark(size: 14),
              const SizedBox(width: MmSpace.s8),
              Flexible(child: Text(source, style: type.caption.copyWith(color: colors.ink3))),
              if (onAbout != null)
                MmPressable(
                  semanticsLabel: InsightsCopy.aboutReply,
                  focusRadius: MmRadius.pillAll,
                  haptic: MmPressHaptic.selection,
                  onTap: onAbout,
                  builder: (context, pressed, _) => SizedBox.square(
                    dimension: MmTarget.min,
                    child: Center(child: Icon(LucideIcons.info, size: 16, color: pressed ? colors.ink : colors.ink3)),
                  ),
                ),
            ],
          ),
          if (next case (final label, final location)) ...[
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: label, expanded: false, minHeight: MmTarget.min, onPressed: () => onGo(location)),
          ],
        ],
      ),
    );
  }
}

/// One suggested ask: the ask, its preview line, and its price. A paid ask that cannot be bought
/// now says it needs a written reply and does nothing.
class _AskRow extends StatelessWidget {
  const _AskRow({required this.suggestion, required this.onTap, this.divider = false, this.disabled = false});

  final AskSuggestion suggestion;
  final VoidCallback onTap;
  final bool divider;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = suggestion;
    final preview = disabled ? AskSheetCopy.needsWritten : s.preview;
    final price = s.free ? AskSheetCopy.free : AskSheetCopy.oneCredit;
    return MmPressable(
      semanticsLabel: '${s.text}. ${preview == null ? '' : '$preview. '}$price',
      pressedScale: 0.97,
      focusRadius: MmRadius.smallAll,
      onTap: disabled ? null : onTap,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: BoxDecoration(border: divider ? Border(top: BorderSide(color: colors.line)) : null),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(s.text, style: type.labelLarge.copyWith(fontSize: 15, color: disabled ? colors.ink3 : colors.ink)),
                      if (preview != null) ...[
                        const SizedBox(height: MmSpace.s2),
                        Text(preview, style: type.caption.copyWith(color: colors.ink3)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                _Price(label: price, free: s.free, disabled: disabled),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Price extends StatelessWidget {
  const _Price({required this.label, required this.free, required this.disabled});

  final String label;
  final bool free;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(color: colors.sunken, shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(8)))),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: MmSpace.s4),
        child: Text(
          label,
          style: context.mmType.caption.copyWith(fontWeight: FontWeight.w600, color: disabled ? colors.ink3 : (free ? colors.goodText : colors.ink2)),
        ),
      ),
    );
  }
}

/// The field (one line, growing to five), the neutral Ask key, and under it the credits left and
/// what the typed ask will cost, said again as the student types.
class _Composer extends StatefulWidget {
  const _Composer({
    required this.controller,
    required this.hint,
    required this.busy,
    required this.walletLine,
    required this.note,
    required this.canSend,
    required this.onSend,
    required this.onCredits,
    required this.bottomPad,
  });

  final TextEditingController controller;
  final String hint;
  final bool busy;
  final String walletLine;
  final String Function(String typed) note;
  final bool Function(String typed) canSend;
  final void Function(String typed) onSend;

  /// The credits line is a link to the AI credits page (the wallet, its rules and top-ups).
  final VoidCallback onCredits;
  final double bottomPad;

  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
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
    return Padding(
      padding: EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, widget.bottomPad + MmSpace.s8),
      child: ValueListenableBuilder(
        valueListenable: widget.controller,
        builder: (context, value, _) {
          final typed = value.text;
          final enabled = !widget.busy && typed.trim().isNotEmpty && widget.canSend(typed);
          void send() {
            if (enabled) widget.onSend(typed);
          }

          final note = widget.note(typed);
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DecoratedBox(
                decoration: ShapeDecoration(
                  color: colors.sunken,
                  shape: RoundedRectangleBorder(
                    borderRadius: MmRadius.keyAll,
                    side: BorderSide(color: _focus.hasFocus ? colors.focusRing : colors.lineStrong, width: _focus.hasFocus ? 1.5 : 1),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s2, MmSpace.s4, MmSpace.s2),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: widget.controller,
                          focusNode: _focus,
                          minLines: 1,
                          maxLines: 5,
                          maxLength: askMaxChars,
                          textCapitalization: TextCapitalization.sentences,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => send(),
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
                      MmPressable(
                        semanticsLabel: AskSheetCopy.ask,
                        focusRadius: MmRadius.smallAll,
                        pressedScale: 0.97,
                        onTap: enabled ? send : null,
                        builder: (context, pressed, _) => SizedBox(
                          height: MmTarget.min,
                          child: Center(
                            child: AnimatedContainer(
                              duration: Motion.of(context, Motion.ui),
                              curve: Motion.glide,
                              constraints: const BoxConstraints(minWidth: 56, minHeight: 40),
                              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: enabled ? colors.ink : colors.line, borderRadius: MmRadius.smallAll),
                              child: Text(
                                AskSheetCopy.ask,
                                style: type.label.copyWith(fontWeight: FontWeight.w700, color: enabled ? colors.ground : colors.ink3),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // The credits line (a 48 dp link to the AI credits page) and the price line share one
              // row when they fit; otherwise the price line drops under the credits, never splitting "1 Nov".
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: MmSpace.s12,
                children: [
                  _WalletLink(line: widget.walletLine, onTap: widget.onCredits),
                  Semantics(liveRegion: true, child: Text(note, style: type.caption.copyWith(color: colors.ink3))),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

/// The credits line as a link: "9 of 50 AI credits left · resets 1 Nov". It opens the AI credits page,
/// and when a reply changes the balance the number crossfades (160 ms) instead of counting.
class _WalletLink extends StatelessWidget {
  const _WalletLink({required this.line, required this.onTap});

  final String line;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return MmPressable(
      semanticsLabel: '$line. ${AskSheetCopy.openCredits}',
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.97,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Align(
          alignment: Alignment.centerLeft,
          widthFactor: 1,
          // The balance line changes in place: the shared overlap switcher (no dip to half strength), left-aligned.
          child: MmOverlapSwitcher.fade(
            duration: const Duration(milliseconds: 160),
            alignment: Alignment.centerLeft,
            child: _WalletText(line, pressed: pressed, key: ValueKey(line)),
          ),
        ),
      ),
    );
  }
}

/// The wallet line, with its leading count in the ink colour and a quiet underline that says it opens.
class _WalletText extends StatelessWidget {
  const _WalletText(this.line, {required this.pressed, super.key});

  final String line;
  final bool pressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.caption.copyWith(
      color: pressed ? colors.ink2 : colors.ink3,
      decoration: TextDecoration.underline,
      decorationColor: colors.lineStrong,
    );
    final m = RegExp(r'^(\d+)(.*)$').firstMatch(line);
    if (m == null) return Text(line, style: style);
    return Text.rich(TextSpan(children: [
      TextSpan(text: m.group(1), style: style.copyWith(color: pressed ? colors.ink2 : colors.ink, fontWeight: FontWeight.w700)),
      TextSpan(text: m.group(2), style: style),
    ]));
  }
}
