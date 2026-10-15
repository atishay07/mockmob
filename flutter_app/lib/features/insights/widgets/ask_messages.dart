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

/// One turn of Ask. The student's words sit on the right in an ink bubble; Mobi's replies sit on
/// the left beside Mobi's mark, set for reading (a lead, then the rest, figures heavier). A reply
/// says where it came from: a record answer cites the questions it rests on and opens the
/// sessions behind it with Show me; a model reply says it cost a credit, that it can be wrong,
/// and offers Report this reply. A pending reply is three bubbles inking; a failure says
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
    this.newest = true,
    this.onCredits,
    this.renew,
  });

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

  /// This is the latest reply in the thread. Only the newest reply's face lives (and nods as the
  /// reply lands); the faces of older replies hold still, so one Mobi moves at a time.
  final bool newest;

  /// Opens the record from a model reply ("check it against your record"); null hides the key.
  final VoidCallback? onOpenRecord;

  @override
  State<AskMessageView> createState() => _AskMessageViewState();
}

class _AskMessageViewState extends State<AskMessageView> {
  late bool _footer = !widget.animate;

  /// The avatar's side, and the left edge of Mobi's column: the avatar and its gap.
  static const double _face = 32;
  static const double _indent = _face + MmSpace.s12;

  /// Each face blinks and glances on its own schedule, so a thread never blinks in unison.
  static int _faceSeed(AskMessage m) => 11 + (m.text.hashCode & 0xff) % 13;

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

    if (m.sending) return _Pending(faceSeed: _faceSeed(m), face: _face);

    if (m.failure case final failure?) {
      final renew = widget.renew ?? renewDay(null, DateTime.now());
      // What happened, in the server's terms, and then what it cost: every failure is free, and the
      // credit line says so only once that is true (a held credit is said as held).
      final (text, credit, canRetry) = switch (failure) {
        AskFailure.offline => (InsightsCopy.failOffline, InsightsCopy.creditNotTwice, true),
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
        padding: const EdgeInsets.only(left: _indent),
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
        _SourceStrip(message: m, citation: cite),
        if (cite != null && cite.sessions.isNotEmpty)
          EvidencePill(attempts: cite.sessions, what: InsightsCopy.behindAnswer),
        if (m.isModel) ...[
          const SizedBox(height: MmSpace.s4),
          Text(InsightsCopy.aiCaveat, style: type.caption.copyWith(color: colors.ink2)),
        ],
        for (final (label, location) in actions.take(2)) ...[
          const SizedBox(height: MmSpace.s8),
          _ActionChip(label: label, onTap: () => context.push(location)),
        ],
        if (m.isModel && widget.onOpenRecord != null) ActionLink(label: InsightsCopy.openRecord, onTap: widget.onOpenRecord!),
        if (m.isModel && widget.onReport != null) _ReportKey(onTap: widget.onReport!),
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
          // A reply that has just landed arrives with a small nod of its own. The thread is a
          // list of many, so the faces do not follow taps, and only the newest one is alive.
          MobiFace(
            size: _face,
            watchTaps: false,
            still: !widget.newest,
            entrance: widget.animate && widget.newest ? MobiAct.correct : MobiAct.idle,
            seed: _faceSeed(m),
          ),
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

/// A reply on its way: Mobi's face scanning beside three bubbles inking and what is happening. The
/// inking is the only loop on the screen, and it does not run for ever: after [_patience] the
/// bubbles rest half inked and the words change to say it is still working, so a long wait reads
/// as a wait and not a hang (MOTION.md 1.1).
class _Pending extends StatefulWidget {
  const _Pending({required this.faceSeed, required this.face});

  final int faceSeed;
  final double face;

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
    final words = _still ? InsightsCopy.askStillThinking : InsightsCopy.askThinking;
    return Semantics(
      liveRegion: true,
      label: _still ? InsightsCopy.askStillThinking : InsightsCopy.askSending,
      excludeSemantics: true,
      child: RiseIn(
        dy: MmSpace.s8,
        duration: Motion.card,
        child: Row(
          children: [
            // Working on it: the eyes scan while the three bubbles ink.
            MobiFace(size: widget.face, watchTaps: false, entrance: MobiAct.loading, seed: widget.faceSeed),
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
  const _SourceStrip({required this.message, required this.citation});

  final AskMessage message;
  final AskCitation? citation;

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
          Text(
            questions == null ? free : '${InsightsCopy.basedOn(questions)}. $free',
            style: type.caption.copyWith(fontSize: 12.5, color: colors.ink3),
          ),
        ],
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
