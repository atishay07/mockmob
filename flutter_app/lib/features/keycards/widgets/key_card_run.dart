import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/keycards_models.dart';
import '../data/keycards_providers.dart';
import '../data/keycards_reviews.dart';
import '../data/keycards_rules.dart';
import '../keycards_copy.dart';
import 'key_card_parts.dart';

/// A card session (Study): the question first, Space or a tap shows the answer, then Missed, Got it or Easy
/// (1, 2, 3). Each rating goes to the outbox and on; the next card arrives once the rating is saved (on the
/// server, or on this phone while offline). "4 of 20" says where the student is. The end shows counts only.
class KeyCardRun extends ConsumerStatefulWidget {
  const KeyCardRun({super.key, required this.cards, required this.mode, required this.onDone, this.startAt = 0, this.startRevealed = false});

  final List<KeyCard> cards;

  /// `study` or `revise` (the mode the ratings are logged with).
  final String mode;

  /// Back to the chapter.
  final VoidCallback onDone;

  /// For goldens: where the session stands when it opens.
  final int startAt;
  final bool startRevealed;

  @override
  ConsumerState<KeyCardRun> createState() => _KeyCardRunState();
}

class _KeyCardRunState extends ConsumerState<KeyCardRun> {
  late int _at = widget.startAt;
  late bool _revealed = widget.startRevealed;
  int? _sending;
  String? _error;
  bool _waitingAny = false;
  bool _capped = false;
  final Map<int, int> _counts = {KeyCardRules.missed: 0, KeyCardRules.gotIt: 0, KeyCardRules.easy: 0};

  void _reveal() {
    if (_revealed) return;
    setState(() => _revealed = true);
  }

  Future<void> _rate(int rating) async {
    if (_sending != null || !_revealed || _at >= widget.cards.length) return;
    final card = widget.cards[_at];
    setState(() {
      _sending = rating;
      _error = null;
    });
    final outcome = await rateKeyCard(ref, cardId: card.id, rating: rating, mode: widget.mode);
    if (!mounted) return;
    switch (outcome.kind) {
      case KcSendKind.sent || KcSendKind.waiting:
        unawaited(rating == KeyCardRules.missed ? ref.read(hapticsProvider).tick() : ref.read(hapticsProvider).confirm());
        setState(() {
          _counts[rating] = (_counts[rating] ?? 0) + 1;
          _waitingAny = _waitingAny || outcome.kind == KcSendKind.waiting;
          _sending = null;
          _revealed = false;
          _at += 1;
        });
        if (_at < widget.cards.length) {
          unawaited(SemanticsService.sendAnnouncement(View.of(context), KeyCardsCopy.position(_at + 1, widget.cards.length), TextDirection.ltr));
        }
      case KcSendKind.proRequired:
        setState(() {
          _sending = null;
          _capped = true;
        });
      case KcSendKind.failed:
        setState(() {
          _sending = null;
          _error = KeyCardsCopy.notSaved;
        });
    }
  }

  void _again() => setState(() {
    _at = 0;
    _revealed = false;
    _error = null;
    _counts.updateAll((_, _) => 0);
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final total = widget.cards.length;
    if (total == 0) return Text(KeyCardsCopy.studyNothing, style: type.body.copyWith(color: colors.ink2));
    if (_capped) return const KcReviewCapNote();
    if (_at >= total) {
      return KcSessionEnd(
        missed: _counts[KeyCardRules.missed] ?? 0,
        gotIt: _counts[KeyCardRules.gotIt] ?? 0,
        easy: _counts[KeyCardRules.easy] ?? 0,
        waiting: _waitingAny,
        onAgain: _again,
        onDone: widget.onDone,
      );
    }
    final card = widget.cards[_at];
    return KcSessionKeys(
      revealed: _revealed,
      enabled: _sending == null,
      onReveal: _reveal,
      onRate: (r) => unawaited(_rate(r)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MmOverlapSwitcher.fade(
            duration: Motion.card,
            alignment: Alignment.topCenter,
            child: KeyedSubtree(
              key: ValueKey('kc-run-${card.id}'),
              child: MmEntrance(
                rise: 8,
                child: KcStudyFace(
                  card: card,
                  revealed: _revealed,
                  sending: _sending,
                  error: _error,
                  position: KeyCardsCopy.position(_at + 1, total),
                  onReveal: _reveal,
                  onRate: (r) => unawaited(_rate(r)),
                ),
              ),
            ),
          ),
          if (_waitingAny) ...[
            const SizedBox(height: MmSpace.s12),
            Text(KeyCardsCopy.savedOnPhone, style: type.small.copyWith(color: colors.ink2)),
          ],
        ],
      ),
    );
  }
}

/// The end of a session: the counts, and the two ways on.
class KcSessionEnd extends StatelessWidget {
  const KcSessionEnd({super.key, required this.missed, required this.gotIt, required this.easy, required this.onAgain, required this.onDone, this.waiting = false});

  final int missed;
  final int gotIt;
  final int easy;
  final bool waiting;
  final VoidCallback onAgain;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final counts = KeyCardsCopy.studyEnd(missed: missed, gotIt: gotIt, easy: easy);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(header: true, liveRegion: true, child: Text(KeyCardsCopy.studyDone, style: type.title)),
        const SizedBox(height: MmSpace.s8),
        if (counts.isNotEmpty) Text(counts, style: type.body.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
        if (waiting) ...[
          const SizedBox(height: MmSpace.s12),
          Text(KeyCardsCopy.savedOnPhone, style: type.small.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: KeyCardsCopy.backToChapter, onPressed: onDone),
        Align(child: KeyButton.quiet(label: KeyCardsCopy.studyAgain, onPressed: onAgain)),
      ],
    );
  }
}

//// Last look: the Must-know cards with their answers showing, one at a time at its own height. A swipe left
/// or Next moves on, a swipe right goes back. Nothing is scheduled and nothing is sent.
class KcLastLook extends StatefulWidget {
  const KcLastLook({super.key, required this.cards, this.startAt = 0});

  final List<KeyCard> cards;
  final int startAt;

  @override
  State<KcLastLook> createState() => _KcLastLookState();
}

class _KcLastLookState extends State<KcLastLook> {
  late int _at = widget.startAt;

  /// The way the last move went: 1 forward, -1 back (the card slides in from that side).
  int _way = 1;

  void _go(int step) {
    final next = (_at + step).clamp(0, widget.cards.length);
    if (next == _at) return;
    setState(() {
      _way = step.sign;
      _at = next;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final total = widget.cards.length;
    if (total == 0) return Text(KeyCardsCopy.lastLookNone, style: type.body.copyWith(color: colors.ink2));
    if (_at >= total) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(liveRegion: true, child: Text(KeyCardsCopy.lastLookDone, style: type.body)),
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(label: KeyCardsCopy.studyAgain, onPressed: () => setState(() => _at = 0)),
        ],
      );
    }
    final card = widget.cards[_at];
    final reduced = Motion.reduced(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(KeyCardsCopy.lastLookNote, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s12),
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onHorizontalDragEnd: (d) {
            final v = d.primaryVelocity ?? 0;
            if (v < -200) _go(1);
            if (v > 200) _go(-1);
          },
          child: AnimatedSwitcher(
            duration: Motion.of(context, Motion.card),
            switchInCurve: Motion.out,
            switchOutCurve: Motion.out,
            layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
            transitionBuilder: (child, animation) {
              final incoming = child.key == ValueKey('kc-look-${card.id}');
              final dx = (incoming ? 1 : -1) * _way * 0.08;
              return FadeTransition(
                opacity: animation,
                child: reduced
                    ? child
                    : SlideTransition(position: Tween(begin: Offset(dx, 0), end: Offset.zero).animate(animation), child: child),
              );
            },
            child: MmSurface.plain(
              key: ValueKey('kc-look-${card.id}'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  KcKindLine(card: card, trailing: KcCardMenu(card: card)),
                  Text(card.front, style: type.small.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s8),
                  KcBack(card: card),
                  const SizedBox(height: MmSpace.s12),
                  KcReference(card: card),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        Row(
          children: [
            Text(
              KeyCardsCopy.position(_at + 1, total),
              style: type.label.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
            const Spacer(),
            KeyButton(label: _at + 1 >= total ? KeyCardsCopy.finish : KeyCardsCopy.nextCard, onPressed: () => _go(1), expanded: false),
          ],
        ),
      ],
    );
  }
}
