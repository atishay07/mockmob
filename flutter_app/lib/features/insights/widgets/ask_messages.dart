import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/ask_citation.dart';
import '../data/ask_controller.dart';
import '../data/ask_wallet.dart';
import '../insights_paths.dart';
import 'answer_text.dart';
import 'ask_marks.dart';
import 'evidence.dart';
import 'insights_bits.dart';
import 'motion_bits.dart';

/// What the student picked in the About sheet of a model reply.
enum _AboutChoice { record, report }

/// One turn of Ask. The student's words sit on the right in an ink bubble; Mobi's replies sit on
/// the left beside Mobi's mark, set for reading (a lead, then the rest, figures heavier). A reply
/// says where it came from: a record answer cites the questions it rests on and opens the
/// sessions behind it with Show me; a model reply says it cost a credit
/// and carries one info glyph: the fine print (it can be wrong, what it cost, Open your record,
/// Report this reply) lives in the sheet behind it, never as a line under every answer. A pending reply is three bubbles inking; a failure says
/// nothing was charged.
///
/// A message with [animate] set has just arrived: it slides in or reveals word by word, and its
/// footer rises after. Everything else (history, goldens, reduced motion) is simply there.
class AskMessageView extends StatefulWidget {
  const AskMessageView({
    super.key,
    required this.message,
    required this.onRetry,
    this.onReport,
    this.citation,
    this.animate = false,
    this.onOpenRecord,
    this.onCredits,
    this.renew,
    this.indented = true,
    this.pendingWords,
  });

  /// False lays a failure at the start of the line (the Ask Mobi sheet frames it instead of
  /// indenting it beside a mark).
  final bool indented;

  final AskMessage message;
  final VoidCallback onRetry;

  /// Opens the credit details from a failure about credits; null hides the key.
  final VoidCallback? onCredits;

  /// "1 November": when the included credits renew. Null works it out from today.
  final String? renew;

  /// Reports a model reply; null hides the control.
  final VoidCallback? onReport;

  /// Where a record answer comes from; null shows no source strip.
  final AskCitation? citation;

  /// The message has just arrived.
  final bool animate;

  /// Opens the record from a model reply ("check it against your record"); null hides the key.
  final VoidCallback? onOpenRecord;

  /// What the wait says while this reply is on its way: "Writing a reply" unless the screen knows
  /// better (a record ask waiting on the record says it is reading it). Replies are not streamed,
  /// so the wait never pretends to type (ASK-MOBI-1019, C-pick 2).
  final String? pendingWords;

  @override
  State<AskMessageView> createState() => _AskMessageViewState();
}

class _AskMessageViewState extends State<AskMessageView> {
  late bool _footer = !widget.animate;

  /// The side of the small "mo" mark that heads each of Mobi's lines, and the left edge of the
  /// column beside it. Mobi himself stands once, at the head of the screen; the thread carries
  /// only this mark, so there is never a second face on the page.
  static const double _face = 24;
  static const double _indent = _face + MmSpace.s12;

  /// The one place the fine print lives: what a model reply is, what it cost, and the two things
  /// to do about it (check it against the record, report it). Opened from the info glyph.
  Future<void> _openAbout() async {
    final m = widget.message;
    final picked = await showMmSheet<_AboutChoice>(
      context: context,
      title: InsightsCopy.aboutReply,
      builder: (sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(InsightsCopy.aiCaveat, style: sheet.mmType.body),
          const SizedBox(height: MmSpace.s8),
          Text(InsightsCopy.chargedLine(m.charged, m.left), style: sheet.mmType.small.copyWith(color: sheet.mmColors.ink2)),
          const SizedBox(height: MmSpace.s8),
          if (widget.onOpenRecord != null) ActionLink(label: InsightsCopy.openRecord, onTap: () => Navigator.of(sheet).pop(_AboutChoice.record)),
          if (widget.onReport != null) _ReportKey(onTap: () => Navigator.of(sheet).pop(_AboutChoice.report)),
        ],
      ),
    );
    if (!mounted) return;
    switch (picked) {
      case _AboutChoice.record:
        widget.onOpenRecord?.call();
      case _AboutChoice.report:
        widget.onReport?.call();
      case null:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = widget.message;

    if (m.fromStudent) {
      Widget bubble = Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
          child: DecoratedBox(
            decoration: ShapeDecoration(
              // The student's words: the selected surface (a step up on Night, the card on Day, where
              // raised2 is darker than the page) with the volt hairline.
              color: colors.selectedSurface,
              shape: mmShapeBorder(
                const BorderRadius.only(
                  topLeft: Radius.circular(MmRadius.key),
                  topRight: Radius.circular(MmRadius.key),
                  bottomLeft: Radius.circular(MmRadius.key),
                  bottomRight: Radius.circular(MmSpace.s4),
                ),
                side: BorderSide(color: colors.volt.withValues(alpha: colors.isNight ? 0.34 : 0.55)),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
              child: Text(m.text, style: type.body),
            ),
          ),
        ),
      );
      if (widget.animate) bubble = RiseIn(dx: MmSpace.s12, dy: 0, duration: Motion.card, child: bubble);
      return bubble;
    }

    if (m.sending) return _Pending(face: _face, words: widget.pendingWords ?? InsightsCopy.askThinking);

    if (m.failure case final failure?) {
      final renew = widget.renew ?? renewDay(null, DateTime.now());
      // What happened, in the server's terms, and then what it cost: every failure is free, and the
      // credit line says so only once that is true (a held credit is said as held).
      final (text, credit, canRetry) = switch (failure) {
        AskFailure.offline => (InsightsCopy.failOffline, InsightsCopy.creditNotTwice, true),
        AskFailure.slow => (InsightsCopy.failSlow, InsightsCopy.creditNotTwice, true),
        // Nothing was charged and the question is kept: after the credits renew (or the pause
        // ends) Send again sends the same words, so the student never retypes them.
        AskFailure.noCredits => (InsightsCopy.failNoCredits(m.balance, renew), InsightsCopy.creditNone, true),
        AskFailure.paused => (InsightsCopy.failPaused, InsightsCopy.creditNone, true),
        AskFailure.resend => (InsightsCopy.failResend, InsightsCopy.creditNone, true),
        AskFailure.rateLimited => (InsightsCopy.failRate, InsightsCopy.creditNone, true),
        AskFailure.tooLong => (InsightsCopy.failTooLong, InsightsCopy.creditNone, false),
        AskFailure.unavailable => (InsightsCopy.failUnavailable, m.creditHeld ? InsightsCopy.creditHeld : InsightsCopy.creditNone, true),
        AskFailure.inProgress => (InsightsCopy.failInProgress, InsightsCopy.creditNotTwice, true),
        AskFailure.alreadyAnswered => (InsightsCopy.failAlreadyAnswered, InsightsCopy.creditNoMore, true),
        AskFailure.budgetReached => (InsightsCopy.failBudget(renew), InsightsCopy.creditNone, false),
        AskFailure.walletUnavailable => (InsightsCopy.failWallet, InsightsCopy.creditNone, true),
        AskFailure.interrupted => (InsightsCopy.failInterrupted, InsightsCopy.creditNotTwice, true),
      };
      // A plain line under Mobi's face, with one retry key: never a card holding a button.
      return Padding(
        padding: EdgeInsets.only(left: widget.indented ? _indent : 0),
        child: Semantics(
          liveRegion: true,
          container: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(text, style: type.small.copyWith(color: colors.ink)),
              const SizedBox(height: MmSpace.s4),
              Text(credit, style: type.caption.copyWith(fontSize: 12.5, color: colors.ink3)),
              Wrap(
                spacing: MmSpace.s20,
                children: [
                  if (canRetry)
                    _RetryKey(
                      label: failure == AskFailure.alreadyAnswered ? InsightsCopy.askAgain : InsightsCopy.sendAgain,
                      onTap: widget.onRetry,
                    ),
                  if (widget.onCredits != null && (failure == AskFailure.noCredits || failure == AskFailure.budgetReached))
                    ActionLink(label: InsightsCopy.creditDetails, onTap: widget.onCredits!),
                ],
              ),
            ],
          ),
        ),
      );
    }

    final record = m.origin == AskOrigin.phone || m.origin == AskOrigin.record;
    final actions = [
      for (final (label, href) in m.actions)
        if (InsightsPaths.locationFor(href) case final location?) (label, location),
    ];
    final cite = widget.citation;

    Widget footer = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: MmSpace.s12),
        _SourceStrip(message: m, citation: cite, onAbout: m.isModel ? _openAbout : null),
        if (cite != null && cite.sessions.isNotEmpty)
          EvidencePill(attempts: cite.sessions, what: InsightsCopy.behindAnswer),
        for (final (label, location) in actions.take(2)) ...[
          const SizedBox(height: MmSpace.s8),
          _ActionChip(label: label, onTap: () => context.push(location)),
        ],
      ],
    );
    if (widget.animate) {
      footer = AnimatedOpacity(
        opacity: _footer ? 1 : 0,
        duration: const Duration(milliseconds: 240),
        curve: Motion.glide,
        child: AnimatedSlide(
          offset: _footer ? Offset.zero : const Offset(0, 0.04),
          duration: const Duration(milliseconds: 240),
          curve: Motion.glide,
          child: IgnorePointer(ignoring: !_footer, child: footer),
        ),
      );
    }

    return Semantics(
      container: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const MmMark(size: _face),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AnswerText(
                  parts: splitAnswer(m.text, wantLead: record || m.origin == AskOrigin.paused),
                  animate: widget.animate,
                  figures: record,
                  onRevealed: () {
                    if (mounted && !_footer) setState(() => _footer = true);
                  },
                ),
                footer,
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A reply on its way: Mobi's mark beside three bubbles inking and what is happening. The
/// inking is the only loop on the screen, and it does not run for ever: after [_patience] the
/// bubbles rest half inked and the words change to say it is still working, so a long wait reads
/// as a wait and not a hang (MOTION.md 1.1).
class _Pending extends StatefulWidget {
  const _Pending({required this.face, required this.words});

  final double face;

  /// What is happening, until the patience runs out.
  final String words;

  @override
  State<_Pending> createState() => _PendingState();
}

class _PendingState extends State<_Pending> {
  /// How long the loop runs before the words change.
  static const Duration _patience = Duration(seconds: 12);

  Timer? _timer;
  bool _still = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer(_patience, () {
      if (mounted) setState(() => _still = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final words = _still ? InsightsCopy.askStillThinking : widget.words;
    return Semantics(
      liveRegion: true,
      label: _still ? InsightsCopy.askStillThinking : InsightsCopy.askSending,
      excludeSemantics: true,
      child: RiseIn(
        dy: MmSpace.s8,
        duration: Motion.card,
        child: Row(
          children: [
            // Mobi at the head of the screen is the one who thinks; here only his mark and the inking.
            MmMark(size: widget.face),
            const SizedBox(width: MmSpace.s12),
            // Plain on the ground: three bubbles inking and what is happening, no pill.
            InkDots(settleAfter: _patience),
            const SizedBox(width: MmSpace.s12),
            Flexible(
              child: AnimatedSwitcher(
                duration: Motion.of(context, const Duration(milliseconds: 150)),
                child: Text(words, key: ValueKey(words), style: type.small.copyWith(color: colors.ink2)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Where a reply came from, as small glass chips: a record answer says it is from the record,
/// how many questions it rests on and that no credit was used; a model reply says it used one.
class _SourceStrip extends StatelessWidget {
  const _SourceStrip({required this.message, required this.citation, this.onAbout});

  final AskMessage message;
  final AskCitation? citation;

  /// Opens the About sheet of a model reply; null for a record answer (no fine print to carry).
  final VoidCallback? onAbout;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final origin = message.origin;
    final (label, free) = switch (origin) {
      AskOrigin.model => (InsightsCopy.sourceModel, InsightsCopy.chargedLine(message.charged, message.left)),
      AskOrigin.paused => (InsightsCopy.sourcePaused, InsightsCopy.noCreditsUsed),
      _ => (InsightsCopy.sourceRecord, InsightsCopy.noCreditsUsed),
    };
    final questions = citation?.questions;
    // A model reply whose charge is not known yet says nothing here: the final charge is in the
    // About sheet and on the credits page, not repeated under the answer.
    final cost = origin == AskOrigin.model && message.charged == null ? '' : free;
    final text = questions == null ? cost : (cost.isEmpty ? InsightsCopy.basedOn(questions) : '${InsightsCopy.basedOn(questions)}. $cost');
    return Semantics(
      container: true,
      label: switch (origin) {
        AskOrigin.model => InsightsCopy.originModel(message.charged, message.left),
        AskOrigin.paused => InsightsCopy.originPaused,
        _ => InsightsCopy.originPhone,
      },
      excludeSemantics: true,
      child: Wrap(
        spacing: MmSpace.s8,
        runSpacing: MmSpace.s8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          FakeGlass(
            borderRadius: MmRadius.pillAll,
            grain: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s4, MmSpace.s12, MmSpace.s4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (origin == AskOrigin.model)
                    Icon(LucideIcons.sparkles, size: 13, color: colors.ink2)
                  else
                    const Bubble(state: BubbleState.filled, size: 11, animate: false),
                  const SizedBox(width: MmSpace.s4),
                  Text(label, style: type.caption.copyWith(fontSize: 12.5, fontWeight: FontWeight.w600, color: colors.ink)),
                ],
              ),
            ),
          ),
          if (text.isNotEmpty)
            Text(text, style: type.caption.copyWith(fontSize: 12.5, color: colors.ink3)),
          if (onAbout != null) _AboutKey(onTap: onAbout!),
        ],
      ),
    );
  }
}

/// The one info glyph of a model reply: 48 dp to reach, a 18 dp mark to look at. It opens the
/// About sheet, where the caveat, the cost and the report live.
class _AboutKey extends StatelessWidget {
  const _AboutKey({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      semanticsLabel: InsightsCopy.aboutReply,
      focusRadius: MmRadius.pillAll,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox.square(
        dimension: MmTarget.min,
        child: Center(child: Icon(LucideIcons.info, size: 18, color: pressed ? colors.ink : colors.ink2)),
      ),
    );
  }
}

/// A next step Mobi offers under a reply: a glass key with the label and an arrow, 48 dp tall.
class _ActionChip extends ConsumerWidget {
  const _ActionChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: label,
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => FakeGlass(
        borderRadius: MmRadius.keyAll,
        pressed: pressed,
        grain: false,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s8),
            child: Row(
              children: [
                Expanded(child: Text(label, style: type.labelLarge.copyWith(fontSize: 14.5), maxLines: 2, overflow: TextOverflow.ellipsis)),
                const SizedBox(width: MmSpace.s8),
                Icon(LucideIcons.arrowRight, size: 16, color: colors.ink2),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Send again": a quiet text key with a small retry glyph, 48 dp tall, at the start of the line.
class _RetryKey extends StatelessWidget {
  const _RetryKey({required this.onTap, this.label = InsightsCopy.sendAgain});

  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.rotateCw, size: 16, color: pressed ? colors.ink2 : colors.ink),
            const SizedBox(width: MmSpace.s8),
            Text(label, style: type.labelLarge.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: pressed ? colors.ink2 : colors.ink)),
          ],
        ),
      ),
    );
  }
}

/// "Report this reply": a quiet flag key under a model reply, 48 dp tall.
class _ReportKey extends StatelessWidget {
  const _ReportKey({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: InsightsCopy.reportReply,
      focusRadius: MmRadius.smallAll,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.flag, size: 16, color: pressed ? colors.ink : colors.ink2),
            const SizedBox(width: MmSpace.s4),
            Text(InsightsCopy.reportReply, style: type.label.copyWith(color: pressed ? colors.ink : colors.ink2)),
          ],
        ),
      ),
    );
  }
}
