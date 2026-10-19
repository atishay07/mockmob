// SET Mob settings (spec 5.3): "Show a podium" (the Mob's owner; everyone else reads who decided), the
// Mob's name from the kind list (owner), "Resting this week" (everyone), "Share my marks in games" (the
// old show-score switch, relabelled), then today's members with Report, Leave and block and Remove, and
// the two old rows: change my name or colour, and Leave. The sheets and calls for the last group are the
// old Mob's own (screens/mob_sheets.dart and MobActions); nothing in them changed.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../you/widgets/you_page.dart';
import '../../../you/widgets/you_row.dart';
import '../../copy.dart';
import '../../data/mob_models.dart' show MobMember;
import '../../data/mob_repository.dart' show mobActionsProvider;
import '../../screens/mob_sheets.dart' show EditMeSheet, ReportSheet, confirmMobSheet;
import '../../widgets/mob_parts.dart';
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/mob_say.dart';
import '../widgets/fold_picker.dart';
import '../widgets/mob_fx.dart';
import '../widgets/mob_name_chips.dart';

class MobSettingsV3Screen extends ConsumerStatefulWidget {
  const MobSettingsV3Screen({super.key});

  @override
  ConsumerState<MobSettingsV3Screen> createState() => _MobSettingsV3ScreenState();
}

class _MobSettingsV3ScreenState extends ConsumerState<MobSettingsV3Screen> {
  /// What a switch shows between the tap and the server's answer.
  final Map<String, bool> _pending = {};
  String? _error;

  /// [call] answers null when the server took it, else the sentence to show (or it throws).
  Future<void> _write(String key, bool value, Future<String?> Function() call) async {
    ref.read(hapticsProvider).toggle(value);
    setState(() {
      _pending[key] = value;
      _error = null;
    });
    try {
      final said = await call();
      if (said != null && mounted) setState(() => _error = said);
    } on Object catch (e) {
      if (mounted) setState(() => _error = mobV3Say(e));
    } finally {
      if (mounted) setState(() => _pending.remove(key));
    }
  }

  @override
  Widget build(BuildContext context) {
    final den = ref.watch(denViewProvider);
    final mob = den?.mob;
    return MobIdleScope(
      child: YouPage(
        title: MobV3Copy.settingsTitle,
        children: [
          if (den == null || mob == null)
            Padding(
              padding: youGutter,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(MobV3Copy.settingsFailed, style: context.mmType.title.copyWith(color: context.mmColors.ink)),
                  const SizedBox(height: MmSpace.s16),
                  KeyButton.secondary(label: MobV3Copy.tryAgain, onPressed: () => ref.read(mobV3ActionsProvider).refresh()),
                ],
              ),
            )
          else
            ..._body(context, den),
        ],
      ),
    );
  }

  List<Widget> _body(BuildContext context, DenView den) {
    final v3 = den.v3;
    final mob = den.mob!;
    final c = context.mmColors;
    final type = context.mmType;
    final actions = ref.read(mobV3ActionsProvider);
    final owner = v3.members.where((m) => m.owner).firstOrNull;
    final podium = _pending['podium'] ?? v3.showPodium;
    final resting = _pending['rest'] ?? v3.quest.youSteppedOut;
    final share = _pending['share'] ?? mob.you.showScore;
    final mobName = v3.name.text.isEmpty ? den.subjectName : v3.name.text;
    return [
      const GroupHeading(MobV3Copy.settingsTitle, top: MmSpace.s8),
      if (v3.youOwn)
        MobSwitchRow(
          key: const ValueKey('set-podium'),
          title: MobV3Copy.showPodium,
          note: MobV3Copy.showPodiumNote,
          value: podium,
          onChanged: (v) => _write('podium', v, () async {
            await actions.settings(showPodium: v);
            return null;
          }),
        )
      else
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter + MmSpace.s4, MmSpace.s8, MmSpace.gutter + MmSpace.s4, MmSpace.s8),
          child: Text(MobV3Copy.podiumNotOwner(mobName, v3.showPodium, owner?.name ?? ''), key: const ValueKey('set-podium-text'), style: type.body.copyWith(color: c.ink2)),
        ),
      if (v3.youOwn) ...[
        const GroupHeading(MobV3Copy.mobName, top: MmSpace.s16),
        Padding(
          padding: youGutter,
          child: MobNameChips(
            key: const ValueKey('set-name'),
            selected: v3.name.key,
            onChanged: (k) async {
              if (k == v3.name.key) return;
              ref.read(hapticsProvider).selection();
              setState(() => _error = null);
              try {
                await actions.settings(nameKey: k);
              } on Object catch (e) {
                if (mounted) setState(() => _error = mobV3Say(e));
              }
            },
          ),
        ),
      ],
      const SizedBox(height: MmSpace.s8),
      MobSwitchRow(
        key: const ValueKey('set-rest'),
        title: MobV3Copy.restingWeek,
        note: MobV3Copy.restingNote,
        value: resting,
        onChanged: (v) => _write('rest', v, () async {
          await actions.stepOut(v);
          return null;
        }),
      ),
      MobSwitchRow(
        key: const ValueKey('set-share'),
        title: MobV3Copy.shareMarks,
        note: MobV3Copy.shareMarksNote,
        value: share,
        onChanged: (v) => _write('share', v, () async {
          final f = await ref.read(mobActionsProvider).updateMe(showScore: v);
          return f == null ? null : ref.read(mobActionsProvider).say(f);
        }),
      ),
      if (_error != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
          child: InlineBanner(message: _error!, tone: BannerTone.error),
        ),
      GroupHeading(MobV3Copy.membersHeading, top: MmSpace.s32, trailing: Padding(padding: const EdgeInsets.only(right: MmSpace.gutter - MmSpace.s4), child: Text(MobCopy.membersCount(v3.members.length), style: type.small.copyWith(color: c.ink2)))),
      Padding(
        padding: youGutter,
        child: Column(children: [for (final m in v3.members) _MemberRow(member: m, onMenu: m.you ? null : () => _memberMenu(context, m, youOwn: v3.youOwn))]),
      ),
      const SizedBox(height: MmSpace.s24),
      YouPanel(
        flat: true,
        inset: 28 + MmSpace.s16,
        children: [
          YouRow(
            flat: true,
            icon: LucideIcons.pencil,
            title: MobCopy.changeName,
            onTap: () => showMmSheet<void>(context: context, title: MobCopy.changeName, builder: (_) => EditMeSheet(name: mob.you.name, colour: mob.you.colour)),
          ),
          YouRow(flat: true, icon: LucideIcons.logOut, title: MobCopy.leave, destructive: true, onTap: () => _leave(context, several: mob.several, subject: den.subjectName)),
        ],
      ),
    ];
  }

  Future<void> _memberMenu(BuildContext context, MobV3Member m, {required bool youOwn}) async {
    final choice = await showMmSheet<String>(
      context: context,
      title: m.name,
      builder: (sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KeyButton.secondary(label: MobCopy.report, onPressed: () => Navigator.of(sheet).pop('report')),
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(label: MobCopy.leaveAndBlock, onPressed: () => Navigator.of(sheet).pop('block')),
          if (youOwn) ...[
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(label: MobCopy.removeMember, onPressed: () => Navigator.of(sheet).pop('remove')),
          ],
          const SizedBox(height: MmSpace.s8),
        ],
      ),
    );
    if (!mounted || choice == null || !context.mounted) return;
    final actions = ref.read(mobActionsProvider);
    final old = MobMember(memberId: m.memberId, name: m.name, colour: m.colour);
    switch (choice) {
      case 'report':
        final sent = await showMmSheet<bool>(context: context, title: MobCopy.reportTitle, builder: (_) => ReportSheet(member: old));
        if (sent == true && context.mounted) showMobToast(context, MobCopy.reported);
        return;
      case 'block':
        if (!await confirmMobSheet(context, title: MobCopy.blockTitle(m.name), body: MobCopy.blockBody(m.name), confirm: MobCopy.leaveAndBlock)) return;
        final f = await actions.leave(block: m.memberId);
        if (!mounted || !context.mounted) return;
        if (f != null) {
          showMobToast(context, actions.say(f));
        } else {
          await Navigator.of(context).maybePop();
        }
      case 'remove':
        if (!await confirmMobSheet(context, title: MobCopy.removeTitle(m.name), body: MobCopy.removeBody(m.name), confirm: MobCopy.removeMember)) return;
        final f = await actions.remove(m.memberId);
        if (f != null && context.mounted) showMobToast(context, actions.say(f));
    }
  }

  Future<void> _leave(BuildContext context, {required bool several, required String subject}) async {
    if (!await confirmMobSheet(context, title: MobCopy.leaveTitle(several, subject), body: MobCopy.leaveBody, confirm: MobCopy.leaveConfirm)) return;
    final actions = ref.read(mobActionsProvider);
    final f = await actions.leave();
    if (!mounted || !context.mounted) return;
    if (f != null) {
      showMobToast(context, actions.say(f));
    } else {
      await Navigator.of(context).maybePop();
    }
  }
}

/// One member as the Mob is today: the Fold's head, the name (a long one wraps), "you", and the menu.
/// No row carries a played or not-played state, and none shows marks.
class _MemberRow extends StatelessWidget {
  const _MemberRow({required this.member, required this.onMenu});

  final MobV3Member member;
  final VoidCallback? onMenu;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          FoldHeadDisc(fold: member.fold, size: 40, fallbackName: member.name, fallbackColour: member.colour),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Semantics(
              label: MobV3Copy.memberRow(member.name, member.you),
              excludeSemantics: true,
              child: Text.rich(TextSpan(children: [
                TextSpan(text: member.name, style: type.body.copyWith(color: c.ink, fontWeight: FontWeight.w600)),
                if (member.you) TextSpan(text: '  ${MobV3Copy.youTag}', style: type.small.copyWith(color: c.ink3)),
              ])),
            ),
          ),
          if (onMenu != null)
            IconButton(
              tooltip: MobV3Copy.memberMenu(member.name),
              onPressed: onMenu,
              constraints: const BoxConstraints(minWidth: MmTarget.min, minHeight: MmTarget.min),
              icon: Icon(LucideIcons.ellipsis, color: c.ink2, size: 20),
            )
          else
            const SizedBox(width: MmTarget.min),
        ],
      ),
    );
  }
}
