import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/data/ai_reply_report.dart' show aiServiceDisclosed, insightsPrefsStoreProvider, markAiServiceDisclosed;
import '../../insights/data/ask_wallet.dart';
import 'lesson_help_controller.dart';
import 'lesson_help_copy.dart';

/// The line under a lesson step that offers another explanation (owner ledger L39). It is a quiet
/// row, not a card: the title, then what asking will cost against the balance the server last
/// reported. Tapping opens [LessonHelpSheet].
///
/// Hookup (one place): in `RunStep.build`, after the step's content, for a reading step or a step
/// whose answer is shown:
/// `LessonHelpEntry(helpKey: LessonHelpKey(runId: run.id, itemId: item.id, revision: run.revision))`.
class LessonHelpEntry extends ConsumerWidget {
  const LessonHelpEntry({super.key, required this.helpKey});

  final LessonHelpKey helpKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final answered = ref.watch(lessonHelpProvider(helpKey).select((s) => s.answered));
    final wallet = ref.watch(lessonHelpWalletProvider(helpKey));
    final now = ref.watch(nowProvider)();
    final note = answered
        ? LessonHelpCopy.entryReadyNote
        : (wallet?.paused ?? false)
            ? LessonHelpCopy.entryPaused
            : (wallet?.empty ?? false)
                ? LessonHelpCopy.entryEmpty(renewDay(wallet, now))
                : LessonHelpCopy.cost(wallet?.total);
    final title = answered ? LessonHelpCopy.entryReady : LessonHelpCopy.entryLabel;
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
      child: MmPressable(
        semanticsLabel: '$title. $note',
        focusRadius: MmRadius.keyAll,
        onTap: () => showLessonHelpSheet(context, helpKey),
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min + MmSpace.s8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: MmSpace.s2),
                  child: Icon(LucideIcons.lightbulb, size: 20, color: colors.ink2),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: type.label.copyWith(color: colors.ink)),
                      const SizedBox(height: MmSpace.s2),
                      Text(note, style: type.small.copyWith(color: colors.ink2)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Future<void> showLessonHelpSheet(BuildContext context, LessonHelpKey helpKey) => showMmSheet<void>(
      context: context,
      title: LessonHelpCopy.sheetTitle,
      builder: (sheet) => LessonHelpSheet(helpKey: helpKey),
    );

/// The sheet: your question (a default is filled in), what it costs, Ask. While the reply is
/// written it says so; the reply, what it cost and a reminder to check it against the lesson come
/// after; a failure says what happened and what it cost, and keeps the question.
class LessonHelpSheet extends ConsumerStatefulWidget {
  const LessonHelpSheet({super.key, required this.helpKey});

  final LessonHelpKey helpKey;

  @override
  ConsumerState<LessonHelpSheet> createState() => _LessonHelpSheetState();
}

class _LessonHelpSheetState extends ConsumerState<LessonHelpSheet> {
  final _text = TextEditingController(text: LessonHelpCopy.defaultQuestion);
  Timer? _slow;
  bool _slowNote = false;

  LessonHelpKey get _key => widget.helpKey;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await ref.read(lessonHelpProvider(_key).notifier).restoreInterrupted();
      final asked = ref.read(lessonHelpProvider(_key)).question;
      if (mounted && asked != null && asked != _text.text) _text.text = asked;
    });
  }

  @override
  void dispose() {
    _slow?.cancel();
    _text.dispose();
    super.dispose();
  }

  /// Before the first message that leaves the phone for an AI service, says so once. The same
  /// notice and flag as Ask Mobi, so a student told there is not told again here.
  Future<bool> _disclosed() async {
    final store = ref.read(insightsPrefsStoreProvider);
    if (await aiServiceDisclosed(store)) return true;
    if (!mounted) return false;
    final go = await showMmSheet<bool>(
      context: context,
      title: LessonHelpCopy.disclosureTitle,
      builder: (sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(LessonHelpCopy.disclosureBody, style: sheet.mmType.body),
          const SizedBox(height: MmSpace.s20),
          KeyButton(label: LessonHelpCopy.disclosureSend, onPressed: () => Navigator.of(sheet).pop(true)),
          const SizedBox(height: MmSpace.s4),
          Center(child: KeyButton.quiet(label: LessonHelpCopy.disclosureNotNow, onPressed: () => Navigator.of(sheet).pop(false))),
        ],
      ),
    );
    if (go != true) return false;
    await markAiServiceDisclosed(store);
    return true;
  }

  Future<void> _ask() async {
    final ctl = ref.read(lessonHelpProvider(_key).notifier);
    final state = ref.read(lessonHelpProvider(_key));
    final text = _text.text.trim();
    if (text.isEmpty || state.sending || state.answered) return;
    if (!await _disclosed() || !mounted) return;
    ref.read(hapticsProvider).light();
    _slow?.cancel();
    setState(() => _slowNote = false);
    _slow = Timer(const Duration(seconds: 10), () {
      if (mounted) setState(() => _slowNote = true);
    });
    await ctl.send(text);
    _slow?.cancel();
    if (mounted) setState(() => _slowNote = false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = ref.watch(lessonHelpProvider(_key));
    final wallet = ref.watch(lessonHelpWalletProvider(_key));
    final renew = renewDay(wallet, ref.watch(nowProvider)());
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (s.answered) ..._answered(s, colors, type) else ..._asking(s, wallet, renew, colors, type),
        ],
      ),
    );
  }

  List<Widget> _asking(LessonHelpState s, AskWallet? wallet, String renew, MmColors colors, MmType type) {
    final paused = wallet?.paused ?? false;
    final empty = wallet?.empty ?? false;
    final sending = s.sending;
    final failure = s.failure;
    final line = paused
        ? LessonHelpCopy.paused
        : empty
            ? LessonHelpCopy.empty(renew)
            : LessonHelpCopy.cost(wallet?.total);
    // Only an unknown outcome is sent again with the id the server already has; the words can
    // still be changed first (a changed question is a new request).
    final again = failure != null && !sending && _text.text.trim() == s.question && s.requestId != null;
    return [
      Text(LessonHelpCopy.scope, style: type.small.copyWith(color: colors.ink2)),
      const SizedBox(height: MmSpace.s16),
      Semantics(
        label: LessonHelpCopy.fieldLabel,
        textField: true,
        child: TextField(
          controller: _text,
          enabled: !sending,
          minLines: 3,
          maxLines: 5,
          maxLength: lessonHelpMaxChars,
          textCapitalization: TextCapitalization.sentences,
          textInputAction: TextInputAction.newline,
          keyboardType: TextInputType.multiline,
          style: type.body,
          cursorColor: colors.ink,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            labelText: LessonHelpCopy.fieldLabel,
            counterText: '',
            filled: true,
            fillColor: colors.raised,
            border: OutlineInputBorder(borderRadius: MmRadius.keyAll, borderSide: BorderSide(color: colors.lineStrong)),
            enabledBorder: OutlineInputBorder(borderRadius: MmRadius.keyAll, borderSide: BorderSide(color: colors.lineStrong)),
            disabledBorder: OutlineInputBorder(borderRadius: MmRadius.keyAll, borderSide: BorderSide(color: colors.line)),
            focusedBorder: OutlineInputBorder(borderRadius: MmRadius.keyAll, borderSide: BorderSide(color: colors.ink, width: 2)),
          ),
        ),
      ),
      Align(
        alignment: Alignment.centerRight,
        child: Padding(
          padding: const EdgeInsets.only(top: MmSpace.s4),
          child: Text(
            '${_text.text.characters.length} of $lessonHelpMaxChars',
            style: type.caption.copyWith(color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()]),
          ),
        ),
      ),
      const SizedBox(height: MmSpace.s8),
      if (failure != null && !sending) ...[
        Semantics(
          liveRegion: true,
          child: InlineBanner(message: _failureLine(s, renew), tone: BannerTone.error),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(_creditLine(s), style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
      ],
      if (sending) ...[
        Semantics(
          liveRegion: true,
          child: Row(
            children: [
              MmSpinner(color: colors.ink2),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(_slowNote ? LessonHelpCopy.stillWriting : LessonHelpCopy.writing, style: type.body)),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(LessonHelpCopy.creditHeld, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
      ] else if (failure == null || failure == HelpFailure.noCredits || failure == HelpFailure.paused) ...[
        Text(line, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s16),
      ],
      KeyButton(
        label: again ? LessonHelpCopy.sendAgain : LessonHelpCopy.ask,
        loading: sending,
        onPressed: sending || paused || empty || _text.text.trim().isEmpty ? null : _ask,
      ),
      const SizedBox(height: MmSpace.s8),
      Text(LessonHelpCopy.freeNote, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink3)),
    ];
  }

  List<Widget> _answered(LessonHelpState s, MmColors colors, MmType type) {
    return [
      Semantics(
        liveRegion: true,
        child: SelectableText(s.reply ?? '', style: type.body),
      ),
      const SizedBox(height: MmSpace.s16),
      Text(LessonHelpCopy.charged(s.charged, s.left, replayed: s.replayed), style: type.small.copyWith(color: colors.ink2)),
      const SizedBox(height: MmSpace.s4),
      Text(LessonHelpCopy.caveat, style: type.caption.copyWith(color: colors.ink3)),
      const SizedBox(height: MmSpace.s20),
      KeyButton(label: LessonHelpCopy.back, onPressed: () => Navigator.of(context).maybePop()),
    ];
  }

  String _failureLine(LessonHelpState s, String renew) => switch (s.failure!) {
        HelpFailure.offline => LessonHelpCopy.failOffline,
        HelpFailure.noCredits => LessonHelpCopy.failNoCredits(s.balance, renew),
        HelpFailure.paused => LessonHelpCopy.failPaused,
        HelpFailure.resend => LessonHelpCopy.failResend,
        HelpFailure.rateLimited => LessonHelpCopy.failRate,
        HelpFailure.tooLong => LessonHelpCopy.failTooLong,
        HelpFailure.unavailable => LessonHelpCopy.failUnavailable,
        HelpFailure.inProgress => LessonHelpCopy.failInProgress,
        HelpFailure.alreadyAnswered => LessonHelpCopy.failAlreadyAnswered,
        HelpFailure.budgetReached => LessonHelpCopy.failBudget(renew),
        HelpFailure.walletUnavailable => LessonHelpCopy.failWallet,
        HelpFailure.stepMoved => LessonHelpCopy.failStepMoved,
        HelpFailure.interrupted => LessonHelpCopy.failInterrupted,
      };

  /// What the failed question cost, as far as the server has said.
  String _creditLine(LessonHelpState s) {
    if (s.creditHeld) return LessonHelpCopy.creditHeld;
    return switch (s.failure!) {
      HelpFailure.offline || HelpFailure.inProgress || HelpFailure.interrupted => LessonHelpCopy.creditNotTwice,
      HelpFailure.alreadyAnswered => LessonHelpCopy.creditNoMore,
      _ => LessonHelpCopy.creditNone,
    };
  }
}
