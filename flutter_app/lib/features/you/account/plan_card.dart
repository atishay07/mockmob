import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/copy/copy.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../edit_copy.dart';
import '../widgets/you_page.dart' show PillKey, youText;

/// The plan as the server reports it (WEB-PARITY F3): Free or Pro, the practice credit balance
/// (or unlimited practice on Pro) and when Pro access ends. Read-only: the app never sells, so
/// there is no price and no purchase key, only a plain line saying where plans are managed.
class PlanCard extends ConsumerStatefulWidget {
  const PlanCard({super.key, required this.auth});

  final AuthSnapshot auth;

  @override
  ConsumerState<PlanCard> createState() => _PlanCardState();
}

class _PlanCardState extends ConsumerState<PlanCard> {
  bool _retrying = false;

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
          figure,
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

/// "Pro" inked in volt, or "Free" as a quiet outline.
class _PlanTag extends StatelessWidget {
  const _PlanTag({required this.pro});

  final bool pro;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
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
  }
}
