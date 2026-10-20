// D0 No Mob (spec 5.3): the Mob tab for a student in no Mob. The lamp-lit room with your starter Fold
// and four dashed paper seats, one line of what a Mob is, the volt key "Start a Mob" and "Join with a
// code", and the quiet link "How the Mob works". With no subjects chosen, the one way forward is
// "Choose your subjects" (a Mob plays in one of them).
//
// The first time the tab shows, the Mob welcome plays over it (V16 A3, mob_welcome_screen.dart).
//
// Start and Join show the Mob explainer the first time (D166), then the one-question setup
// (MobSetupScreen, which replaced the D0a sheet) or the code screen.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_state.dart';
import '../../../../core/auth/display_name.dart' show shownName;
import '../../../../core/models/subject.dart' show isHiddenSubject;
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../practice/widgets/stale_subjects_banner.dart' show openEditSubjects;
import '../../data/mob_models.dart' show mobNameFrom;
import '../../data/mob_repository.dart' show mobRepositoryProvider;
import '../../widgets/mob_ask_key.dart';
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import '../mob_v3_nav.dart';
import '../widgets/den_preview.dart';
import '../widgets/mob_fx.dart';
import 'mob_welcome_screen.dart' show MobWelcomeHook;

/// The subjects a Mob can be started in: the student's own, as the old form read them.
final mobStartSubjectsProvider = Provider<List<String>>((ref) {
  final all = ref.watch(authSnapshotProvider.select((a) => a.subjects));
  return [for (final s in all) if (RegExp(r'^[a-z][a-z_]{1,40}$').hasMatch(s) && !isHiddenSubject(s)) s];
});

class DenStartScreen extends ConsumerWidget {
  const DenStartScreen({super.key, this.asTab = true});

  /// The Mob tab's root draws the tab header (account key, title, Ask Mobi). Pushed, it is the same row.
  final bool asTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.mmColors;
    final type = context.mmType;
    final seat = ref.watch(mobRepositoryProvider.select((s) => s.value?.v3?.seat));
    final subjects = ref.watch(mobStartSubjectsProvider);
    final noSubjects = subjects.isEmpty;
    final auth = ref.watch(authSnapshotProvider);
    final first = mobNameFrom(shownName(auth.name, email: auth.email));
    // The Mob welcome (V16 A3): the first time this account opens the Mob tab, before Start or Join.
    return MobWelcomeHook(
      inMob: false,
      enabled: asTab,
      child: Scaffold(
        backgroundColor: c.ground,
          body: MobIdleScope(
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: SafeArea(
                      bottom: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmRhythm.screenTop, MmSpace.gutter, MmSpace.s8),
                        child: const TabRootHeader(title: MobV3Copy.title, trailing: MobAskKey(title: MobV3Copy.title)),
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(child: DenPreview(fold: seat ?? FoldKey.dart, fallbackName: first)),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s4, MmSpace.gutter, 0),
                    sliver: SliverList.list(
                      children: [
                        Text(MobV3Copy.d0Lead, style: type.body.copyWith(color: c.ink2)),
                        const SizedBox(height: MmSpace.s24),
                        if (noSubjects) ...[
                          Text(MobV3Copy.noSubjects, style: type.body.copyWith(color: c.ink)),
                          const SizedBox(height: MmSpace.s16),
                          KeyButton(key: const ValueKey('d0-choose-subjects'), label: MobV3Copy.chooseSubjects, onPressed: () => openEditSubjects(context)),
                        ] else
                          KeyButton(key: const ValueKey('d0-start'), label: MobV3Copy.startMob, onPressed: () => MobV3Nav.startMob(context)),
                        const SizedBox(height: MmSpace.s12),
                        KeyButton.secondary(key: const ValueKey('d0-join'), label: MobV3Copy.joinWithCode, onPressed: () => MobV3Nav.joinMob(context)),
                        const SizedBox(height: MmSpace.s4),
                        Center(child: KeyButton.quiet(key: const ValueKey('d0-how'), label: MobExplainerCopy.howItWorks, expanded: false, onPressed: () => MobV3Nav.howItWorks(context))),
                        SizedBox(height: MmSpace.s32 + MediaQuery.viewPaddingOf(context).bottom),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
