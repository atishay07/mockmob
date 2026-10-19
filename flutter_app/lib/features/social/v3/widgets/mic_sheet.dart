// P3 Pass the mic (spec 5.3; Pro, billing on). "Let a friend start one game in <Mob> this week." The other
// members are rows with a radio; the key names the one chosen ("Pass the mic to Kabir"); after it a toast says
// "Kabir can start one game this week." Errors are the server's sentences (MIC_LIMIT, MIC_SELF, START_PRO).
// The app never says who has Pro: a member's plan is not in anything it reads.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../widgets/mob_parts.dart' show showMobToast;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import 'sheet_parts.dart';

class _MicController extends ChangeNotifier {
  String? chosen;
  bool busy = false;
  String? error;

  void update(void Function() f) {
    f();
    notifyListeners();
  }
}

Future<void> showMicSheet(BuildContext context) async {
  final c = _MicController();
  await showMmSheet<void>(
    context: context,
    title: MobV3Copy.passMic,
    builder: (_) => _MicBody(controller: c),
    footer: (_) => _MicKeys(controller: c),
  );
}

class _MicBody extends ConsumerWidget {
  const _MicBody({required this.controller});

  final _MicController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final den = ref.watch(denViewProvider);
    if (den == null) return const SizedBox.shrink();
    final others = [for (final m in den.v3.members) if (!m.you) m];
    final mobName = den.v3.name.text.isEmpty ? MobV3Copy.title : den.v3.name.text;
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MobLine(MobV3Copy.micLine(mobName)),
          const SizedBox(height: MmSpace.s8),
          for (final m in others)
            _MemberRow(member: m, chosen: controller.chosen == m.memberId, onTap: controller.busy ? null : () => controller.update(() {
                  controller.chosen = m.memberId;
                  controller.error = null;
                })),
        ],
      ),
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({required this.member, required this.chosen, required this.onTap});

  final MobV3Member member;
  final bool chosen;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      haptic: MmPressHaptic.selection,
      focusRadius: MmRadius.smallAll,
      selected: chosen,
      inMutuallyExclusiveGroup: true,
      semanticsLabel: member.name,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
          child: Row(
            children: [
              MemberHead.of(member, size: 44),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(member.name, style: type.cardTitle)),
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: chosen ? colors.ink : colors.lineStrong, width: chosen ? 2 : 1.5)),
                child: chosen ? Container(width: 12, height: 12, decoration: BoxDecoration(shape: BoxShape.circle, color: colors.ink)) : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MicKeys extends ConsumerWidget {
  const _MicKeys({required this.controller});

  final _MicController controller;

  Future<void> _pass(BuildContext context, WidgetRef ref, MobV3Member to) async {
    final c = controller;
    if (c.busy) return;
    c.update(() {
      c.busy = true;
      c.error = null;
    });
    final actions = ref.read(mobV3ActionsProvider);
    try {
      await actions.passMic(to.memberId);
      try {
        await actions.refresh();
      } on Object {
        // The mic is passed; the den shows its new count when it next reads.
      }
      c.update(() => c.busy = false);
      if (!context.mounted) return;
      showMobToast(context, MobV3Copy.micToast(to.name));
      Navigator.of(context).pop();
    } on Object catch (e) {
      c.update(() {
        c.busy = false;
        c.error = MobV3Copy.error(e);
      });
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final den = ref.watch(denViewProvider);
    final colors = context.mmColors;
    final type = context.mmType;
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        MobV3Member? to;
        for (final m in den?.v3.members ?? const <MobV3Member>[]) {
          if (m.memberId == controller.chosen) to = m;
        }
        final target = to;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (controller.error != null) ...[
              Text(controller.error!, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink)),
              const SizedBox(height: MmSpace.s8),
            ],
            KeyButton(
              label: target == null ? MobV3Copy.passMic : MobV3Copy.micKey(target.name),
              loading: controller.busy,
              onPressed: target == null ? null : () => _pass(context, ref, target),
            ),
            const SizedBox(height: MmSpace.s8),
            Text(MobV3Copy.micNote, textAlign: TextAlign.center, style: type.small.copyWith(color: colors.ink2)),
          ],
        );
      },
    );
  }
}
