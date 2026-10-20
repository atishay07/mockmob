// A7, the Mob settings sheet (Mob V4, MOB-MINIMAL 3.5): one sheet from the den's gear. Switches first
// (Show a podium, Resting this week, Share my marks in games, and "Show my study time to my Mob", off until
// the student turns it on), then the members with their menu open in place, then "You": change my name or
// colour (in place), How the Mob works, Free and Pro in the Mob (in place, with an honest way to Pro), and
// Leave the Mob. Report and the leave, block and remove confirmations stay the three small sheets.
//
// The same body (MobSettingsBody) is the old Mob settings page's, so page and sheet never disagree.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../../copy.dart';
import '../../data/mob_models.dart' show MobMember, isValidMobName;
import '../../data/mob_repository.dart' show mobActionsProvider, mobRepositoryProvider;
import '../../screens/mob_sheets.dart' show ReportSheet, confirmMobSheet;
import '../../widgets/mob_parts.dart';
import '../copy_v3.dart';
import '../data/mob_v3_api.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/mob_say.dart';
import '../mob_v3_nav.dart';
import 'fold_picker.dart';
import 'free_pro_sheet.dart';
import 'mob_name_chips.dart';
import 'sheet_parts.dart';

/// Opens the Mob settings sheet over the current screen.
Future<void> openMobSettingsSheet(BuildContext context) => showMmSheet<void>(
      context: context,
      title: MobV3Copy.settingsTitle,
      heightFactor: 0.94,
      builder: (_) => const MobSettingsBody(),
    );

/// "How the Mob works": opens the explainer's replay. Tests may override it with null (no row drawn).
final mobHowItWorksProvider = Provider<Future<void> Function(BuildContext context)?>((ref) => (context) => MobV3Nav.howItWorks(context, replay: true));

class MobSettingsBody extends ConsumerStatefulWidget {
  const MobSettingsBody({super.key});

  @override
  ConsumerState<MobSettingsBody> createState() => _MobSettingsBodyState();
}

class _MobSettingsBodyState extends ConsumerState<MobSettingsBody> {
  /// What a switch shows between the tap and the server's answer.
  final Map<String, bool> _pending = {};
  String? _error;

  /// The member whose menu is open, and which "You" row is open ('edit' or 'plans').
  String? _menuFor;
  String? _open;

  static const _none = SizedBox.shrink();

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
    if (den == null || mob == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(MobV3Copy.settingsFailed, style: context.mmType.title.copyWith(color: context.mmColors.ink)),
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(label: MobV3Copy.tryAgain, onPressed: () => ref.read(mobV3ActionsProvider).refresh()),
        ],
      );
    }
    return _body(context, den);
  }

  Widget _body(BuildContext context, DenView den) {
    final v3 = den.v3;
    final mob = den.mob!;
    final c = context.mmColors;
    final type = context.mmType;
    final actions = ref.read(mobV3ActionsProvider);
    final owner = v3.members.where((m) => m.owner).firstOrNull;
    final podium = _pending['podium'] ?? v3.showPodium;
    final resting = _pending['rest'] ?? v3.quest.youSteppedOut;
    final share = _pending['share'] ?? mob.you.showScore;
    final hours = v3.hours;
    final study = _pending['study'] ?? hours?.meSharing ?? false;
    final mobName = v3.name.text.isEmpty ? den.subjectName : v3.name.text;
    const rowPad = EdgeInsets.symmetric(vertical: MmSpace.s8);
    final howItWorks = ref.watch(mobHowItWorksProvider);
    final isPro = v3.starts.via == StartVia.pro;
    final billingOn = v3.starts.billingOn;
    final mocks = v3.starts.shows(GameFormat.mock);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (v3.youOwn)
          MobSwitchRow(
            key: const ValueKey('set-podium'),
            padding: rowPad,
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
            padding: rowPad,
            child: Text(MobV3Copy.podiumNotOwner(mobName, v3.showPodium, owner?.name ?? ''), key: const ValueKey('set-podium-text'), style: type.body.copyWith(color: c.ink2)),
          ),
        if (v3.youOwn) ...[
          const MobSheetLabel(MobV3Copy.mobName),
          MobNameChips(
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
          const SizedBox(height: MmSpace.s8),
        ],
        MobSwitchRow(
          key: const ValueKey('set-rest'),
          padding: rowPad,
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
          padding: rowPad,
          title: MobV3Copy.shareMarks,
          note: MobV3Copy.shareMarksNote,
          value: share,
          onChanged: (v) => _write('share', v, () async {
            final f = await ref.read(mobActionsProvider).updateMe(showScore: v);
            return f == null ? null : ref.read(mobActionsProvider).say(f);
          }),
        ),
        // Mob hours (D171): drawn only when the server has shipped them. Off until the student turns it on.
        if (hours != null)
          MobSwitchRow(
            key: const ValueKey('set-study'),
            padding: rowPad,
            title: MobV3Copy.studyTimeTitle,
            note: MobV3Copy.studyTimeNote,
            value: study,
            onChanged: (v) => _write('study', v, () async {
              final body = await ref.read(mobV3ApiProvider).studyShare(mob: actions.mobId, on: v);
              ref.read(mobRepositoryProvider.notifier).accept(body);
              return null;
            }),
          ),
        if (_error != null) ...[
          const SizedBox(height: MmSpace.s8),
          InlineBanner(message: _error!, tone: BannerTone.error),
        ],
        MobSheetLabel(MobV3Copy.membersHeading, padding: const EdgeInsets.only(top: MmSpace.s24, bottom: MmSpace.s4)),
        Align(alignment: Alignment.centerLeft, child: Text(MobCopy.membersCount(v3.members.length), style: type.small.copyWith(color: c.ink2))),
        const SizedBox(height: MmSpace.s4),
        for (final m in v3.members)
          _MemberRow(
            member: m,
            open: _menuFor == m.memberId,
            onMenu: m.you ? null : () => setState(() => _menuFor = _menuFor == m.memberId ? null : m.memberId),
            actions: m.you
                ? null
                : _MemberActions(
                    youOwn: v3.youOwn,
                    onReport: () => _report(context, m),
                    onBlock: () => _block(context, m),
                    onRemove: () => _remove(context, m),
                  ),
          ),
        MobSheetLabel(MobV3Copy.youHeading, padding: const EdgeInsets.only(top: MmSpace.s24, bottom: MmSpace.s4)),
        const _Hairline(),
        _Disclosure(
          key: const ValueKey('set-edit-me'),
          icon: LucideIcons.pencil,
          title: MobCopy.changeName,
          note: MobV3Copy.changeMeLine,
          open: _open == 'edit',
          onToggle: () => setState(() => _open = _open == 'edit' ? null : 'edit'),
          child: _EditMeInline(name: mob.you.name, colour: mob.you.colour, onSaved: () => setState(() => _open = null)),
        ),
        if (howItWorks != null) ...[
          const _Hairline(),
          _DisclosureRow(
            key: const ValueKey('set-how'),
            icon: LucideIcons.circleHelp,
            title: MobV3Copy.howMobWorks,
            note: MobV3Copy.howMobWorksLine,
            onTap: () => howItWorks(context),
          ),
        ],
        if (billingOn) ...[
          const _Hairline(),
          _Disclosure(
            key: const ValueKey('set-plans'),
            icon: LucideIcons.layers,
            title: MobV3Copy.freeProTitle,
            note: MobV3Copy.freeProRowLine,
            open: _open == 'plans',
            onToggle: () => setState(() => _open = _open == 'plans' ? null : 'plans'),
            child: _PlansInline(live: v3.live.enabled, mocks: mocks, price: v3.starts.freeMockPrice, isPro: isPro),
          ),
        ],
        const _Hairline(),
        _DisclosureRow(
          key: const ValueKey('set-leave'),
          icon: LucideIcons.logOut,
          title: MobCopy.leave,
          note: MobV3Copy.leaveMobLine,
          destructive: true,
          onTap: () => _leave(context, several: mob.several, subject: den.subjectName),
        ),
        const SizedBox(height: MmSpace.s8),
      ],
    );
  }

  Future<void> _report(BuildContext context, MobV3Member m) async {
    final old = MobMember(memberId: m.memberId, name: m.name, colour: m.colour);
    final sent = await showMmSheet<bool>(context: context, title: MobCopy.reportTitle, builder: (_) => ReportSheet(member: old));
    if (sent == true && context.mounted) showMobToast(context, MobCopy.reported);
  }

  Future<void> _block(BuildContext context, MobV3Member m) async {
    if (!await confirmMobSheet(context, title: MobCopy.blockTitle(m.name), body: MobCopy.blockBody(m.name), confirm: MobCopy.leaveAndBlock)) return;
    final actions = ref.read(mobActionsProvider);
    final f = await actions.leave(block: m.memberId);
    if (!mounted || !context.mounted) return;
    if (f != null) {
      showMobToast(context, actions.say(f));
    } else {
      await Navigator.of(context).maybePop();
    }
  }

  Future<void> _remove(BuildContext context, MobV3Member m) async {
    if (!await confirmMobSheet(context, title: MobCopy.removeTitle(m.name), body: MobCopy.removeBody(m.name), confirm: MobCopy.removeMember)) return;
    final actions = ref.read(mobActionsProvider);
    final f = await actions.remove(m.memberId);
    if (f != null && context.mounted) showMobToast(context, actions.say(f));
    if (mounted) setState(() => _menuFor = null);
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

/// A hairline between the rows of the You group.
class _Hairline extends StatelessWidget {
  const _Hairline();

  @override
  Widget build(BuildContext context) => Divider(height: 1, thickness: 1, color: context.mmColors.line);
}

/// Grows its child open under [header]: 240 ms, or at once with reduced motion.
class _Reveal extends StatelessWidget {
  const _Reveal({required this.open, required this.child});

  final bool open;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return KeepInView(
      open: open,
      child: MmSizeEase(duration: Motion.card, curve: Motion.glide, alignment: Alignment.topCenter, child: open ? child : const SizedBox(width: double.infinity)),
    );
  }
}

/// One member: the Fold's head, the name (a long one wraps), "you", and the menu key. The menu opens under the row.
class _MemberRow extends StatelessWidget {
  const _MemberRow({required this.member, required this.open, required this.onMenu, required this.actions});

  final MobV3Member member;
  final bool open;
  final VoidCallback? onMenu;
  final Widget? actions;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ConstrainedBox(
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
                  icon: Icon(open ? LucideIcons.x : LucideIcons.ellipsis, color: c.ink2, size: 20),
                )
              else
                const SizedBox(width: MmTarget.min),
            ],
          ),
        ),
        _Reveal(open: open && actions != null, child: actions ?? _MobSettingsBodyState._none),
      ],
    );
  }
}

class _MemberActions extends StatelessWidget {
  const _MemberActions({required this.youOwn, required this.onReport, required this.onBlock, required this.onRemove});

  final bool youOwn;
  final VoidCallback onReport;
  final VoidCallback onBlock;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 40 + MmSpace.s12, bottom: MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KeyButton.secondary(label: MobCopy.report, minHeight: 44, onPressed: onReport),
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(label: MobCopy.leaveAndBlock, minHeight: 44, onPressed: onBlock),
            if (youOwn) ...[
              const SizedBox(height: MmSpace.s8),
              KeyButton.secondary(label: MobCopy.removeMember, minHeight: 44, onPressed: onRemove),
            ],
          ],
        ),
      );
}

/// A tappable row of the "You" group: icon, title, a line, and a chevron (or nothing when it opens a page).
class _DisclosureRow extends StatelessWidget {
  const _DisclosureRow({super.key, required this.icon, required this.title, required this.note, required this.onTap, this.destructive = false, this.expanded});

  final IconData icon;
  final String title;
  final String note;
  final VoidCallback onTap;
  final bool destructive;

  /// Null: the row opens elsewhere (a chevron). True or false: it opens in place.
  final bool? expanded;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final ink = destructive ? c.ink : c.ink;
    return MmPressable(
      onTap: onTap,
      haptic: MmPressHaptic.selection,
      semanticsLabel: '$title. $note',
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Row(
          children: [
            PaperChip(icon: icon, size: 40),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: type.cardTitle.copyWith(color: pressed ? c.ink2 : ink)),
                  Text(note, style: type.small.copyWith(color: c.ink2)),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            if (expanded != null) AnimatedRotation(turns: expanded! ? 0.25 : 0, duration: Motion.reduced(context) ? Duration.zero : Motion.ui, child: Icon(LucideIcons.chevronRight, size: 20, color: c.ink3)) else if (!destructive) Icon(LucideIcons.chevronRight, size: 20, color: c.ink3),
          ],
        ),
      ),
    );
  }
}

/// A "You" row that opens its panel in place, under the row.
class _Disclosure extends StatelessWidget {
  const _Disclosure({super.key, required this.icon, required this.title, required this.note, required this.open, required this.onToggle, required this.child});

  final IconData icon;
  final String title;
  final String note;
  final bool open;
  final VoidCallback onToggle;
  final Widget child;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _DisclosureRow(icon: icon, title: title, note: note, expanded: open, onTap: onToggle),
          _Reveal(open: open, child: Padding(padding: const EdgeInsets.only(top: MmSpace.s12, bottom: MmSpace.s16), child: child)),
        ],
      );
}

/// Name and colour, prefilled and editable, in place. Saving closes the panel; the sheet stays open.
class _EditMeInline extends ConsumerStatefulWidget {
  const _EditMeInline({required this.name, required this.colour, required this.onSaved});

  final String name;
  final int colour;
  final VoidCallback onSaved;

  @override
  ConsumerState<_EditMeInline> createState() => _EditMeInlineState();
}

class _EditMeInlineState extends ConsumerState<_EditMeInline> {
  late final TextEditingController _name = TextEditingController(text: widget.name);
  late int _colour = widget.colour;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!isValidMobName(_name.text)) {
      setState(() => _error = MobCopy.nameRule);
      return;
    }
    setState(() => _busy = true);
    final failure = await ref.read(mobActionsProvider).updateMe(name: _name.text, colour: _colour);
    if (!mounted) return;
    setState(() => _busy = false);
    if (failure == null) {
      ref.read(hapticsProvider).confirm();
      widget.onSaved();
    } else {
      setState(() => _error = ref.read(mobActionsProvider).say(failure));
    }
  }

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MobNameField(controller: _name, label: MobCopy.nameLabel, error: _error, helper: MobCopy.nameTerms, onChanged: (_) => setState(() => _error = null)),
          const SizedBox(height: MmSpace.s12),
          Text(MobCopy.colourLabel, style: context.mmType.label.copyWith(color: context.mmColors.ink2)),
          ColourPicker(value: _colour, onChanged: (c) => setState(() => _colour = c)),
          const SizedBox(height: MmSpace.s12),
          KeyButton(key: const ValueKey('set-edit-save'), label: MobCopy.save, loading: _busy, onPressed: _busy ? null : _save),
        ],
      );
}

/// Free and Pro in the Mob, in place: the two lists, the full mock rule in one plain paragraph, and an
/// honest way to Pro for a Free member (Pro never changes marks, chains or what you can earn).
class _PlansInline extends ConsumerWidget {
  const _PlansInline({required this.live, required this.mocks, required this.price, required this.isPro});

  final bool live;
  final bool mocks;
  final int? price;
  final bool isPro;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.mmColors;
    final type = context.mmType;
    final nudges = ref.watch(proNudgesOnProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FreeProBody(live: live, mocks: mocks, price: price),
        if (mocks) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(header: true, child: Text(MobV3Copy.mockRuleHeading, style: type.cardTitle)),
          const SizedBox(height: MmSpace.s4),
          Text(MobV3Copy.mockRuleFor(price), key: const ValueKey('set-mock-rule'), style: type.body.copyWith(color: c.ink2)),
        ],
        const SizedBox(height: MmSpace.s12),
        if (isPro)
          Text(MobV3Copy.proIncluded, style: type.small.copyWith(color: c.ink2))
        else if (nudges)
          KeyButton(key: const ValueKey('set-get-pro'), label: MobV3Copy.getPro, onPressed: () => showUpgradeSheetIfOn(context, reason: ProReason.mobHosting)),
      ],
    );
  }
}
