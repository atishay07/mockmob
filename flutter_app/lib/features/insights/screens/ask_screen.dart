import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/repositories/credits_repository.dart';
import '../../../core/sync/sync_providers.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/ai_reply_report.dart';
import '../data/ask_controller.dart';
import '../data/insights_repository.dart';
import '../widgets/ask_messages.dart';
import '../widgets/insights_bits.dart';

/// `/ask` (website Mentor): ask about the record. Record questions are answered on the phone
/// for free; anything else goes through the server's budget guard, and the reply says what it
/// cost. A reply shows only when the server has answered.
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
    super.dispose();
  }

  Future<void> _send([String? text]) async {
    final message = (text ?? _text.text).trim();
    // A reply is still on its way: keep the draft where it is, nothing is sent.
    if (message.isEmpty || ref.read(askControllerProvider).busy) return;
    if (!await _disclosed(message)) return;
    if (!mounted || ref.read(askControllerProvider).busy) return;
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

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final state = ref.watch(askControllerProvider);
    final credits = ref.watch(creditsRepositoryProvider).value;
    final paused = credits?.isPaused ?? false;
    final pad = MediaQuery.paddingOf(context);

    return Scaffold(
      backgroundColor: colors.ground,
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const InsightsHeader(title: InsightsCopy.askTitle, fallback: AppRoutes.review),
            Expanded(
              child: ListView(
                controller: _scroll,
                padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s24),
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Mobi(pose: MobiPose.think, size: 72, motion: MobiMotion.settle),
                      const SizedBox(width: MmSpace.s12),
                      Expanded(child: Text(InsightsCopy.askIntro, style: type.body.copyWith(color: colors.ink2))),
                    ],
                  ),
                  if (state.messages.isEmpty) ...[
                    const SizedBox(height: MmSpace.s24),
                    Wrap(
                      spacing: MmSpace.s8,
                      runSpacing: MmSpace.s8,
                      children: [
                        for (final s in InsightsCopy.askSuggestions) _Suggestion(label: s, onTap: () => _send(s)),
                      ],
                    ),
                  ],
                  for (final (i, m) in state.messages.indexed) ...[
                    const SizedBox(height: MmSpace.s16),
                    AskMessageView(
                      message: m,
                      onReport: m.isModel ? () => _report(m) : null,
                      onRetry: () {
                        ref.read(askControllerProvider.notifier).retry(i);
                        _toEnd();
                      },
                    ),
                  ],
                ],
              ),
            ),
            _Composer(
              controller: _text,
              busy: state.busy,
              onSend: _send,
              note: paused ? InsightsCopy.askPausedLine : InsightsCopy.askCostLine(credits?.explanationBalance),
              bottomInset: MediaQuery.viewInsetsOf(context).bottom > 0 ? 0 : pad.bottom,
            ),
          ],
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.busy, required this.onSend, required this.note, required this.bottomInset});

  final TextEditingController controller;
  final bool busy;
  final Future<void> Function([String?]) onSend;
  final String note;
  final double bottomInset;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(color: colors.ground, border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, bottomInset + MmSpace.s8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: controller,
                    minLines: 1,
                    maxLines: 4,
                    maxLength: askMaxChars,
                    textCapitalization: TextCapitalization.sentences,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => busy ? null : onSend(),
                    style: type.body,
                    decoration: const InputDecoration(hintText: InsightsCopy.askHint, counterText: ''),
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
                SizedBox.square(
                  dimension: 56,
                  child: ValueListenableBuilder(
                    valueListenable: controller,
                    builder: (context, value, _) {
                      final enabled = !busy && value.text.trim().isNotEmpty;
                      return IconButton.filled(
                        onPressed: enabled ? onSend : null,
                        tooltip: busy ? InsightsCopy.askSending : InsightsCopy.askSend,
                        style: IconButton.styleFrom(
                          backgroundColor: colors.volt,
                          foregroundColor: colors.voltInk,
                          disabledBackgroundColor: colors.raised2,
                          disabledForegroundColor: colors.ink3,
                        ),
                        icon: busy ? MmSpinner(color: colors.ink2) : const Icon(LucideIcons.arrowUp, size: 22),
                      );
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: MmSpace.s6),
            Text(note, style: type.caption.copyWith(color: colors.ink3)),
          ],
        ),
      ),
    );
  }
}

/// A question the student can send with one tap: an outlined pill with a speech mark, never a
/// selection bubble (nothing is being chosen). Wraps onto two lines at large text sizes.
class _Suggestion extends StatelessWidget {
  const _Suggestion({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: 'Ask: $label',
      onTap: onTap,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : colors.raised,
          shape: RoundedRectangleBorder(borderRadius: MmRadius.pillAll, side: BorderSide(color: colors.line)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.messageCircleQuestionMark, size: 16, color: colors.ink2),
                const SizedBox(width: MmSpace.s8),
                Flexible(child: Text(label, style: type.labelLarge.copyWith(fontSize: 14))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
