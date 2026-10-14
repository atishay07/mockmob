import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/copy/copy.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../edit_copy.dart';
import '../widgets/you_motion.dart';
import '../widgets/you_page.dart' show PillKey, youText;

/// The plan as the server reports it (WEB-PARITY F3): Free or Pro, the practice credit balance
/// (or unlimited practice on Pro) and when Pro access ends. Read-only: the app never sells, so
/// there is no price and no purchase key, only a plain line saying where plans are managed.
///
/// The balance rolls up from 0 only when it came fresh from the server in this run
/// ([AuthSnapshot.profileFresh]); a balance read from the copy kept on the phone is shown as it
/// is, and rolls only if it later changes. A 56 dp Mobi stands beside the figure: [mobi] drives
/// him (a greeting after a saved name, a shrug when the credits did not load).
class PlanCard extends ConsumerStatefulWidget {
  const PlanCard({super.key, required this.auth, this.mobi});

  final AuthSnapshot auth;
  final MobiController? mobi;

  @override
  ConsumerState<PlanCard> createState() => _PlanCardState();
}

class _PlanCardState extends ConsumerState<PlanCard> {
  bool _retrying = false;
  MobiController? _ownMobi;
  MobiController get _mobi => widget.mobi ?? (_ownMobi ??= MobiController());

  @override
  void initState() {
    super.initState();
    _shrugIfFailed();
  }

  @override
  void didUpdateWidget(PlanCard old) {
    super.didUpdateWidget(old);
    if (old.auth.creditBalance != widget.auth.creditBalance || old.auth.isPro != widget.auth.isPro) _shrugIfFailed();
  }

  @override
  void dispose() {
    _ownMobi?.dispose();
    super.dispose();
  }

  /// Credits that could not be read: Mobi shrugs once per failure run, never again on a retry that
  /// fails the same way. A balance that arrives ends the run.
  void _shrugIfFailed() {
    final auth = widget.auth;
    if (auth.isPro || auth.creditBalance != null) {
      MobiRation.recovered('account');
      return;
    }
    if (MobiRation.oops('account')) WidgetsBinding.instance.addPostFrameCallback((_) => _mobi.play(MobiAct.oops));
  }

  /// Reads the profile again. The card watches the snapshot, so a balance that arrives replaces
  /// the message by itself; a failure leaves the message and the key.
  Future<void> _retry() async {
    if (_retrying) return;
    setState(() => _retrying = true);
    try {
      await ref.read(authSnapshotProvider.notifier).reload();
    } on Object {
      // The message stays and the key comes back.
    } finally {
      if (mounted) setState(() => _retrying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = widget.auth;
    final colors = context.mmColors;
    final type = context.mmType;
    final pro = auth.isPro;
    final until = auth.premiumUntil?.toLocal();
    final balance = auth.creditBalance;

    final Widget figure;
    if (pro) {
      figure = Text(EditCopy.unlimited, style: type.display);
    } else if (balance != null) {
      // The credit balance is the hero of the screen: a monumental number on the ground, no card.
      figure = Semantics(
        container: true,
        label: EditCopy.credits(balance),
        excludeSemantics: true,
        child: MonumentalNumber(
          value: '$balance',
          unit: balance == 1 ? EditCopy.creditUnitOne : EditCopy.creditUnit,
          style: type.figureHero,
          // From 0 only when the server just told us; the phone's own copy shows as it is.
          fromZeroOnFirstBuild: auth.profileFresh,
        ),
      );
    } else {
      figure = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(EditCopy.creditsUnknown, style: type.title),
          const SizedBox(height: MmSpace.s12),
          PillKey(
            label: _retrying ? EditCopy.creditsRetrying : EditCopy.creditsRetry,
            onPressed: _retrying ? null : _retry,
          ),
        ],
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(EditCopy.planOverline, style: type.caption.copyWith(color: colors.ink2))),
              _PlanTag(pro: pro),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(child: figure),
              const SizedBox(width: MmSpace.s8),
              YouMobi(size: 56, controller: _mobi, entrance: MobiAct.idle, cycle: const [MobiAct.hello, MobiAct.correct]),
            ],
          ),
          // Mobi's line (the greeting after a saved name): plain text, typed in, never boxed.
          ValueListenableBuilder<MobiSpeech?>(
            valueListenable: _mobi.speech,
            builder: (context, speech, _) => speech == null
                ? const SizedBox.shrink()
                : Padding(
                    padding: const EdgeInsets.only(top: MmSpace.s8),
                    child: MobiBubble(key: ValueKey(speech.id), speech: speech, boxed: false, maxWidth: 260),
                  ),
          ),
          if (pro) ...[
            const SizedBox(height: MmSpace.s8),
            Text(
              until == null ? EditCopy.proActive : EditCopy.proUntil('${formatDayMonth(until)} ${until.year}'),
              style: type.small.copyWith(color: colors.ink2),
            ),
          ],
        ],
      ),
    );
  }
}

/// "Pro" inked in volt, or "Free" as a quiet outline. The Pro tag shimmers once when the card
/// first shows: one light band crosses it in 700 ms and is gone (still under reduced motion).
class _PlanTag extends StatefulWidget {
  const _PlanTag({required this.pro});

  final bool pro;

  @override
  State<_PlanTag> createState() => _PlanTagState();
}

class _PlanTagState extends State<_PlanTag> with SingleTickerProviderStateMixin {
  late final AnimationController _shimmer = AnimationController(vsync: this, duration: Motion.sweep);
  bool _played = false;

  @override
  void initState() {
    super.initState();
    _shimmer;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_played || !widget.pro || Motion.reduced(context)) return;
    _played = true;
    _shimmer.forward(from: 0);
  }

  @override
  void didUpdateWidget(_PlanTag old) {
    super.didUpdateWidget(old);
    // Pro arriving while the card is open (a refresh) earns its one shimmer too.
    if (!old.pro && widget.pro && !_played && !Motion.reduced(context)) {
      _played = true;
      _shimmer.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _shimmer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final pro = widget.pro;
    final tag = DecoratedBox(
      decoration: BoxDecoration(
        color: pro ? colors.volt : null,
        borderRadius: MmRadius.pillAll,
        border: pro ? null : Border.all(color: colors.lineStrong),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4),
        child: Text(
          pro ? EditCopy.planPro : EditCopy.planFree,
          style: context.mmType.label.copyWith(color: pro ? colors.voltInk : colors.ink2, fontWeight: FontWeight.w700),
        ),
      ),
    );
    if (!pro) return tag;
    return ClipRRect(
      borderRadius: MmRadius.pillAll,
      child: Stack(
        children: [
          tag,
          Positioned.fill(
            child: IgnorePointer(
              child: RepaintBoundary(
                child: AnimatedBuilder(
                  animation: _shimmer,
                  builder: (context, _) {
                    final t = _shimmer.value;
                    if (t == 0 || t == 1) return const SizedBox.shrink();
                    // A soft white band leaning across the tag from left to right.
                    final x = -0.6 + 2.2 * Motion.sweepCurve.transform(t);
                    return DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment(x - 0.35, -0.4),
                          end: Alignment(x + 0.35, 0.4),
                          colors: [Colors.white.withValues(alpha: 0), Colors.white.withValues(alpha: 0.55), Colors.white.withValues(alpha: 0)],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
