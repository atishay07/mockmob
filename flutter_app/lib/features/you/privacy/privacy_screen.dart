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

/// Privacy: usage data. Everyone sees the page; only a self-declared adult gets the switch. For a
/// minor or an unknown age it reads "Off for your account." with no switch.
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
        ..._outside(context, ref, consent),
      ];
    } else {
      body = [
        const SizedBox(height: MmSpace.s8),
        const OffForAccountPanel(),
        if (ui.phase == UsagePhase.ageFailed)
          const Padding(
            padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, 0),
            child: InlineBanner(message: YouCopy.ageChangeFailed, tone: BannerTone.error),
          ),
        const SeeEventsKey(),
        ..._outside(context, ref, consent),
      ];
    }

    return YouPage(title: YouCopy.privacyTitle, children: body);
  }

  List<Widget> _outside(BuildContext context, WidgetRef ref, ConsentState consent) => [
        const GroupHeading(YouCopy.operationalHeading),
        const YouParagraph(YouCopy.operationalNote),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
          child: Align(
            alignment: Alignment.centerLeft,
            child: PillKey(label: YouCopy.changeAnswer, onPressed: () => _changeAnswer(context, ref, consent)),
          ),
        ),
      ];
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
            Skeleton(height: 64, radius: MmRadius.panel),
            SizedBox(height: MmSpace.s20),
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
