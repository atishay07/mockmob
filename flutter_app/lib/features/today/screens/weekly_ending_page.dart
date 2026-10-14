// `/today/weekly-ending`: the week's ending on its own page (spec 6.9), opened from the Sunday
// reminder. The card itself belongs to the rhythm module; this page gives it the warm room.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart';
import '../copy.dart';

class WeeklyEndingPage extends ConsumerWidget {
  const WeeklyEndingPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final hasEnding = ref.watch(weeklyEndingProvider) != null;
    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          const Positioned.fill(child: IgnorePointer(child: LampScene())),
          SafeArea(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, MmSpace.s32),
              children: [
                const Center(child: Mobi(pose: MobiPose.read, size: 112, motion: MobiMotion.settle)),
                const SizedBox(height: MmSpace.s16),
                Semantics(header: true, child: Text(TodayCopy.weeklyEndingTitle, style: type.moment, textAlign: TextAlign.center)),
                const SizedBox(height: MmSpace.s24),
                if (hasEnding) const WeeklyEndingSection() else const WeekStripSection(),
                const SizedBox(height: MmSpace.s24),
                KeyButton.quiet(
                  label: TodayCopy.back,
                  expanded: true,
                  onPressed: () => context.canPop() ? context.pop() : context.go(AppRoutes.today),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
