// Your Mobs (pass-1020 MOB-MINIMAL 3.5, A11): every Mob you are in, "Start another Mob" (the New Mob flow)
// and "Join with a code". Opened by the chevron by the Mob name (always, also with one Mob).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../data/mob_repository.dart';
import '../../widgets/mob_plan_widgets.dart' show MobSwitcher;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../mob_v3_nav.dart';
import '../screens/den_start_screen.dart' show showStartMobSheet;

/// What the sheet asks the den to do once it closes.
sealed class YourMobsPick {
  const YourMobsPick();
}

class SwitchToMob extends YourMobsPick {
  const SwitchToMob(this.id);
  final String id;
}

class StartAnotherMob extends YourMobsPick {
  const StartAnotherMob();
}

class JoinMobWithCode extends YourMobsPick {
  const JoinMobWithCode();
}

/// Shows the sheet and acts on the pick. [onSwitch] lets the den fade through to the new Mob (M13); without it
/// the repository selects the Mob directly.
Future<void> showYourMobsSheet(BuildContext context, {Future<void> Function(String id)? onSwitch}) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final pick = await showMmSheet<YourMobsPick>(context: context, title: MobV4DenCopy.yourMobsTitle, builder: (sheet) => const YourMobsBody());
  if (pick == null || !context.mounted) return;
  switch (pick) {
    case SwitchToMob(:final id):
      if (onSwitch != null) {
        await onSwitch(id);
      } else {
        await container.read(mobRepositoryProvider.notifier).select(id);
      }
    case StartAnotherMob():
      await showStartMobSheet(context);
    case JoinMobWithCode():
      await MobV3Nav.join(context);
  }
}

class YourMobsBody extends ConsumerWidget {
  const YourMobsBody({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    final view = ref.watch(denViewProvider);
    final mob = view?.mob;
    if (view == null || mob == null) return const SizedBox(height: MmSpace.s48);
    final labels = MobSwitcher.labelsFor(mob.mobs);
    final plan = mob.plan;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.sheetSide, 0, MmSpace.sheetSide, MmSpace.s16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < mob.mobs.length; i++) ...[
            _MobRow(
              key: ValueKey('your-mobs-${mob.mobs[i].id}'),
              title: mob.mobs[i].active && view.v3.name.text.isNotEmpty ? view.v3.name.text : labels[i],
              line: mob.mobs[i].active ? '${mob.mobs[i].subjectName} · ${MobV4DenCopy.here}' : mob.mobs[i].subjectName,
              active: mob.mobs[i].active,
              onTap: () => Navigator.of(context).pop(mob.mobs[i].active ? null : SwitchToMob(mob.mobs[i].id)),
            ),
            Divider(height: 1, color: colors.line),
          ],
          const SizedBox(height: MmSpace.s16),
          if (plan.canStartAnother)
            KeyButton.secondary(key: const ValueKey('your-mobs-start'), label: MobV4DenCopy.startAnother, onPressed: () => Navigator.of(context).pop(const StartAnotherMob()))
          else
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s8),
              child: Text(MobV4DenCopy.planLimit(plan.maxMobs), style: type.caption.copyWith(color: colors.ink2)),
            ),
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(key: const ValueKey('your-mobs-join'), label: MobV4DenCopy.joinWithCode, onPressed: () => Navigator.of(context).pop(const JoinMobWithCode())),
        ],
      ),
    );
  }
}

class _MobRow extends ConsumerWidget {
  const _MobRow({super.key, required this.title, required this.line, required this.active, required this.onTap});

  final String title;
  final String line;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    return MmPressable(
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      semanticsLabel: '$title. $line',
      pressedScale: 0.98,
      focusRadius: BorderRadius.circular(MmRadius.small),
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title, style: type.subhead.copyWith(color: colors.ink)),
                    const SizedBox(height: MmSpace.s2),
                    Text(line, style: type.label.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              Icon(active ? LucideIcons.check : LucideIcons.chevronRight, size: 20, color: active ? colors.ink : colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}
