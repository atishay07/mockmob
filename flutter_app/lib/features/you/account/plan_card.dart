import 'package:flutter/material.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/copy/copy.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../edit_copy.dart';

/// The plan as the server reports it (WEB-PARITY F3): Free or Pro, the practice credit balance
/// (or unlimited practice on Pro) and when Pro access ends. Read-only: the app never sells, so
/// there is no price and no purchase key, only a plain line saying where plans are managed.
class PlanCard extends StatelessWidget {
  const PlanCard({super.key, required this.auth});

  final AuthSnapshot auth;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final pro = auth.isPro;
    final until = auth.premiumUntil?.toLocal();
    final balance = auth.creditBalance;

    final Widget figure;
    if (pro) {
      figure = Text(EditCopy.unlimited, style: type.title);
    } else if (balance != null) {
      figure = Semantics(
        container: true,
        label: EditCopy.credits(balance),
        excludeSemantics: true,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            MonumentalNumber(value: '$balance', style: type.figure),
            const SizedBox(width: MmSpace.s8),
            Flexible(
              child: Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s8),
                child: Text(balance == 1 ? EditCopy.creditUnitOne : EditCopy.creditUnit, style: type.body.copyWith(color: colors.ink2)),
              ),
            ),
          ],
        ),
      );
    } else {
      figure = Text(EditCopy.creditsUnknown, style: type.body.copyWith(color: colors.ink2));
    }

    return LitEdge(
      child: FakeGlass(
        opacity: colors.isNight ? 0.5 : 0.72,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s16, MmSpace.s20, MmSpace.s20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
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
                const SizedBox(height: MmSpace.s4),
                Text(
                  until == null ? EditCopy.proActive : EditCopy.proUntil('${formatDayMonth(until)} ${until.year}'),
                  style: type.small.copyWith(color: colors.ink2),
                ),
              ],
              const SizedBox(height: MmSpace.s16),
              DecoratedBox(
                decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
                child: Padding(
                  padding: const EdgeInsets.only(top: MmSpace.s12),
                  child: Text(EditCopy.manage, style: type.caption.copyWith(color: colors.ink2)),
                ),
              ),
            ],
          ),
        ),
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
