import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_navigator.dart';
import '../data/mob_repository.dart';
import '../widgets/mob_parts.dart';

/// A destructive confirm (leave, leave and block, remove). True when confirmed.
Future<bool> confirmMobSheet(BuildContext context, {required String title, required String body, required String confirm}) async {
  final ok = await showMmSheet<bool>(
    context: context,
    title: title,
    builder: (context) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.sheetSide),
      child: Text(body, style: context.mmType.body.copyWith(color: context.mmColors.ink2)),
    ),
    footer: (context) => Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.sheetSide, MmSpace.s12, MmSpace.sheetSide, MmSpace.s16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KeyButton.secondary(label: confirm, onPressed: () => Navigator.of(context).pop(true)),
          const SizedBox(height: MmSpace.s8),
          KeyButton.quiet(label: MobCopy.cancel, expanded: true, onPressed: () => Navigator.of(context).pop(false)),
        ],
      ),
    ),
  );
  return ok ?? false;
}

/// The invite: the link, Copy, the system share, the expiry, and a fresh link that stops the old.
class InviteSheet extends ConsumerStatefulWidget {
  const InviteSheet({super.key});

  @override
  ConsumerState<InviteSheet> createState() => _InviteSheetState();
}

class _InviteSheetState extends ConsumerState<InviteSheet> {
  bool _busy = false;
  String? _note;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final mob = ref.read(currentMobProvider);
      // Paused invites make no new link; the sheet says so instead.
      if (mob == null || mob.invitesPaused) return;
      final invite = mob.invite;
      final now = DateTime.now();
      if (invite == null || (invite.expiresAt != null && invite.expiresAt!.isBefore(now))) _make();
    });
  }

  Future<void> _make() async {
    if (_busy) return;
    setState(() => _busy = true);
    final failure = await ref.read(mobActionsProvider).newInvite();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _note = failure == null ? null : ref.read(mobActionsProvider).say(failure);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final mob = ref.watch(currentMobProvider);
    final invite = mob?.invite;
    final nav = ref.read(mobNavigatorProvider);
    if (mob?.invitesPaused ?? false) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.sheetSide, 0, MmSpace.sheetSide, MmSpace.s24),
        child: Text(MobCopy.invitesPaused, style: type.body.copyWith(color: colors.ink2)),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.sheetSide),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(MobCopy.inviteBody, style: type.body.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s16),
          Container(
            constraints: const BoxConstraints(minHeight: MmTarget.option),
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
            decoration: BoxDecoration(color: colors.sunken, borderRadius: MmRadius.keyAll, border: Border.all(color: colors.line)),
            alignment: Alignment.centerLeft,
            child: invite == null
                ? const Skeleton(height: 18)
                : SelectableText(invite.url, style: type.body.copyWith(color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()])),
          ),
          if (invite?.expiresAt != null) ...[
            const SizedBox(height: MmSpace.s8),
            MobNote(MobCopy.inviteUntil(invite!.expiresAt!)),
          ],
          if (_note != null) ...[
            const SizedBox(height: MmSpace.s8),
            InlineBanner(message: _note!, tone: BannerTone.error),
          ],
          const SizedBox(height: MmSpace.s16),
          KeyButton(
            label: MobCopy.share,
            loading: _busy && invite == null,
            onPressed: invite == null ? null : () => nav.shareLink('${MobCopy.shareText} ${invite.url}'),
          ),
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(
            label: MobCopy.copy,
            onPressed: invite == null
                ? null
                : () async {
                    final ok = await nav.copyLink(invite.url);
                    if (ok) ref.read(hapticsProvider).confirm();
                    if (context.mounted && ok) setState(() => _note = null);
                    if (context.mounted && ok) showMobToast(context, MobCopy.copied);
                  },
          ),
          const SizedBox(height: MmSpace.s8),
          KeyButton.quiet(label: MobCopy.newLink, expanded: true, onPressed: _busy ? null : _make),
          const MobNote(MobCopy.newLinkNote, center: true),
          const SizedBox(height: MmSpace.s16),
        ],
      ),
    );
  }
}

/// Name and colour, prefilled and editable (T001).
class EditMeSheet extends ConsumerStatefulWidget {
  const EditMeSheet({super.key, required this.name, required this.colour});

  final String name;
  final int colour;

  @override
  ConsumerState<EditMeSheet> createState() => _EditMeSheetState();
}

class _EditMeSheetState extends ConsumerState<EditMeSheet> {
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
      Navigator.of(context).pop();
    } else {
      setState(() => _error = ref.read(mobActionsProvider).say(failure));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.sheetSide),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MobNameField(controller: _name, label: MobCopy.nameLabel, error: _error, helper: MobCopy.nameTerms, onChanged: (_) => setState(() => _error = null)),
          const SizedBox(height: MmSpace.s16),
          Text(MobCopy.colourLabel, style: context.mmType.label.copyWith(color: context.mmColors.ink2)),
          ColourPicker(value: _colour, onChanged: (c) => setState(() => _colour = c)),
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: MobCopy.save, loading: _busy, onPressed: _busy ? null : _save),
          const SizedBox(height: MmSpace.s16),
        ],
      ),
    );
  }
}

/// Report a member: three preset reasons, no free text, and the option to leave and block.
class ReportSheet extends ConsumerStatefulWidget {
  const ReportSheet({super.key, required this.member});

  final MobMember member;

  @override
  ConsumerState<ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<ReportSheet> {
  String _reason = 'name';
  bool _leave = false;
  bool _busy = false;
  String? _error;

  Future<void> _send() async {
    setState(() => _busy = true);
    final failure = await ref
        .read(mobActionsProvider)
        .report(memberId: widget.member.memberId, reason: _reason, alsoLeave: _leave, block: _leave);
    if (!mounted) return;
    setState(() => _busy = false);
    if (failure == null) {
      Navigator.of(context).pop(true);
    } else {
      setState(() => _error = ref.read(mobActionsProvider).say(failure));
    }
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    const reasons = [('name', MobCopy.reportName), ('nudge', MobCopy.reportNudge), ('safety', MobCopy.reportSafety)];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.sheetSide),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.member.name, style: type.title.copyWith(color: colors.ink)),
          const SizedBox(height: MmSpace.s12),
          for (final (id, label) in reasons) ...[
            KeyButton.option(label: label, selected: _reason == id, onPressed: () => setState(() => _reason = id)),
            const SizedBox(height: MmSpace.s8),
          ],
          const SizedBox(height: MmSpace.s4),
          Row(
            children: [
              Expanded(child: Text(MobCopy.reportAlsoLeave, style: type.body.copyWith(color: colors.ink))),
              MmSwitch(value: _leave, semanticsLabel: MobCopy.reportAlsoLeave, onChanged: (v) => setState(() => _leave = v)),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: MmSpace.s8),
            InlineBanner(message: _error!, tone: BannerTone.error),
          ],
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: MobCopy.reportSend, loading: _busy, onPressed: _busy ? null : _send),
          const SizedBox(height: MmSpace.s16),
        ],
      ),
    );
  }
}
