import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/consent.dart';
import '../../../core/repositories/consent_repository.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/you_page.dart';
import 'event_list_sheet.dart';
import 'usage_data_card.dart';
import 'usage_data_controller.dart';

/// Privacy: usage data (spec 5.12.3). Everyone sees the row; only a self-declared adult gets the
/// switch. For a minor or an unknown age the row reads "Off for your account." with no switch.
class PrivacyScreen extends ConsumerWidget {
  const PrivacyScreen({super.key});

  Future<void> _changeAnswer(BuildContext context, WidgetRef ref, ConsentState consent) async {
    final band = await showAgeQuestionSheet(
      context,
      current: consent.consent.ageBand,
      answered: consent.consent.decidedAt != null,
    );
    if (band == null) return;
    await ref.read(usageDataControllerProvider.notifier).changeAge(band);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final consent = ref.watch(consentRepositoryProvider);
    final ui = ref.watch(usageDataControllerProvider);

    final List<Widget> body;
    if (consent.status == ConsentStatus.loading || consent.status == ConsentStatus.notLoaded) {
      body = const [_ConsentSkeleton()];
    } else if (consent.status == ConsentStatus.failed) {
      body = [
        SizedBox(
          height: 480,
          child: StateView(
            kind: StateViewKind.error,
            title: YouCopy.consentLoadFailedTitle,
            message: YouCopy.consentLoadFailedBody,
            primary: StateAction(YouCopy.tryAgain, () => ref.read(consentRepositoryProvider.notifier).load()),
          ),
        ),
      ];
    } else if (consent.consent.ageBand == AgeBand.adult) {
      body = [
        const SizedBox(height: MmSpace.s8),
        const UsageDataSwitchCard(),
        _operational(type, colors),
        _changeKey(context, ref, consent),
      ];
    } else {
      body = [
        const SizedBox(height: MmSpace.s8),
        Padding(
          padding: youGutter,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                liveRegion: true,
                child: Text(YouCopy.offForAccount, style: type.subhead),
              ),
              const SizedBox(height: MmSpace.s8),
              Text(YouCopy.offForAccountNote, style: type.body.copyWith(color: colors.ink2)),
              if (ui.phase == UsagePhase.ageFailed) ...[
                const SizedBox(height: MmSpace.s16),
                const InlineBanner(message: YouCopy.ageChangeFailed, tone: BannerTone.error),
              ],
            ],
          ),
        ),
        Align(alignment: Alignment.centerLeft, child: _seeEvents(context)),
        _operational(type, colors),
        _changeKey(context, ref, consent),
      ];
    }

    return YouPage(title: YouCopy.privacyTitle, children: body);
  }

  Widget _seeEvents(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(0, MmSpace.s8, 0, 0),
        child: KeyButton.quiet(label: YouCopy.seeEvents, onPressed: () => showEventListSheet(context)),
      );

  Widget _operational(MmType type, MmColors colors) => Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.group, MmSpace.gutter, 0),
        child: Text(YouCopy.operationalNote, style: type.small.copyWith(color: colors.ink2)),
      );

  Widget _changeKey(BuildContext context, WidgetRef ref, ConsentState consent) => Padding(
        padding: const EdgeInsets.fromLTRB(0, MmSpace.s16, MmSpace.gutter, 0),
        child: Align(
          alignment: Alignment.centerLeft,
          child: KeyButton.quiet(label: YouCopy.changeAnswer, onPressed: () => _changeAnswer(context, ref, consent)),
        ),
      );
}

class _ConsentSkeleton extends StatelessWidget {
  const _ConsentSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
      child: SkeletonGroup(
        label: YouCopy.consentLoading,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Skeleton(height: 32, width: 240),
            SizedBox(height: MmSpace.s16),
            Skeleton.line(),
            SizedBox(height: MmSpace.s8),
            Skeleton.line(),
            SizedBox(height: MmSpace.s8),
            Skeleton.line(width: 200),
          ],
        ),
      ),
    );
  }
}
