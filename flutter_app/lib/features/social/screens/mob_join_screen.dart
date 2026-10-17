import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_page.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_repository.dart';
import '../widgets/mob_parts.dart';
import '../widgets/mob_ring.dart';
import 'mob_screen.dart';

/// `https://www.mockmob.in/join/<code>`: who invited you and what a Mob asks (one 10-question paper a
/// week, about 12 minutes), the subject and seats (never a member's name), your name and colour
/// already filled in and editable (T001), and one key. An unusable code, for any reason including a
/// block, reads the same plain sentence (P10). Open to everyone (owner decision D-S1): nothing stands
/// between the link and the key, and the Mob has no chat, no DMs and no free text beyond a name.
class MobJoinScreen extends ConsumerStatefulWidget {
  const MobJoinScreen({super.key, required this.code});

  final String code;

  @override
  ConsumerState<MobJoinScreen> createState() => _MobJoinScreenState();
}

class _MobJoinScreenState extends ConsumerState<MobJoinScreen> {
  late final String? _code = inviteCodeFromLink(widget.code);
  MobInvitePreview? _preview;
  MobFailure? _failure;
  bool _loading = true;
  bool _busy = false;
  bool _joined = false;
  bool _editing = false;
  late final TextEditingController _name;
  int _colour = 0;
  String? _nameError;

  @override
  void initState() {
    super.initState();
    final full = ref.read(authSnapshotProvider).name?.trim() ?? '';
    final first = full.split(RegExp(r'\s+')).first;
    _name = TextEditingController(text: first.length > 18 ? first.substring(0, 18) : first);
    _colour = first.isEmpty ? 3 : (first.codeUnits.fold<int>(0, (a, b) => a + b) + 3) % MobColours.count;
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final code = _code;
    if (code == null) {
      setState(() {
        _loading = false;
        _failure = MobFailure.inviteInvalid;
      });
      return;
    }
    setState(() {
      _loading = true;
      _failure = null;
    });
    final (preview, failure) = await ref.read(mobActionsProvider).preview(code);
    if (!mounted) return;
    setState(() {
      _loading = false;
      _preview = preview;
      _failure = failure;
    });
  }

  Future<void> _join() async {
    if (!isValidMobName(_name.text)) {
      setState(() {
        _editing = true;
        _nameError = MobCopy.nameRule;
      });
      return;
    }
    setState(() {
      _busy = true;
      _failure = null;
    });
    final failure = await ref.read(mobActionsProvider).join(code: _code!, name: _name.text, colour: _colour);
    if (!mounted) return;
    setState(() => _busy = false);
    if (failure == null) {
      ref.read(hapticsProvider).confirm();
      setState(() => _joined = true);
    } else if (failure == MobFailure.nameInvalid || failure == MobFailure.nameRefused) {
      setState(() {
        _editing = true;
        _nameError = failure == MobFailure.nameInvalid ? MobCopy.nameRule : MobCopy.failure(failure);
      });
    } else {
      setState(() => _failure = failure);
    }
  }

  /// The link is unusable (bad, expired, gone, or a block): one sentence, nothing more.
  bool get _unusable => _failure == MobFailure.inviteInvalid || _failure == MobFailure.inviteExpired;

  @override
  Widget build(BuildContext context) {
    if (_joined) return const MobScreen();
    final type = context.mmType;
    final colors = context.mmColors;
    final preview = _preview;
    return YouPage(
      title: MobCopy.title,
      children: [
        Padding(
          padding: youGutter,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: MmSpace.s8),
              if (_loading)
                const SkeletonGroup(
                  label: MobCopy.checkingInvite,
                  child: Column(children: [Skeleton(height: 32), SizedBox(height: MmSpace.s12), Skeleton(height: 64)]),
                )
              else if (_unusable) ...[
                Text(MobCopy.inviteUnusableTitle, style: type.headline.copyWith(color: colors.ink)),
                const SizedBox(height: MmSpace.s8),
                Text(MobCopy.inviteUnusableNote, style: type.body.copyWith(color: colors.ink2)),
              ] else if (preview == null) ...[
                Text(MobCopy.failure(_failure ?? MobFailure.generic), style: type.title.copyWith(color: colors.ink)),
                const SizedBox(height: MmSpace.s16),
                PillKey(label: MobCopy.tryAgain, onPressed: _load),
              ] else ...[
                Text(MobCopy.joinHeadline(preview), style: type.headline.copyWith(color: colors.ink)),
                const SizedBox(height: MmSpace.s12),
                Text(MobCopy.joinBody(preview), style: type.body.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s16),
                for (final fact in MobCopy.joinFacts)
                  Padding(
                    padding: const EdgeInsets.only(bottom: MmSpace.s8),
                    child: Text(fact, style: type.body.copyWith(color: colors.ink2)),
                  ),
                const SizedBox(height: MmSpace.s16),
                Semantics(header: true, child: Text(MobCopy.joinAs, style: type.label.copyWith(color: colors.ink2))),
                const SizedBox(height: MmSpace.s8),
                Row(
                  children: [
                    InitialDisc(member: MobMember(memberId: '', name: _name.text.trim().isEmpty ? '?' : _name.text.trim(), colour: _colour), size: 40),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Text(
                        _name.text.trim().isEmpty ? 'Your name' : _name.text.trim(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: type.title.copyWith(color: colors.ink),
                      ),
                    ),
                    KeyButton.quiet(
                      label: _editing ? 'Done' : 'Change',
                      semanticsLabel: _editing ? 'Done' : MobCopy.changeName,
                      onPressed: () => setState(() => _editing = !_editing),
                    ),
                  ],
                ),
                if (_editing) ...[
                  const SizedBox(height: MmSpace.s8),
                  MobNameField(controller: _name, label: MobCopy.nameLabel, error: _nameError, onChanged: (_) => setState(() => _nameError = null)),
                  const SizedBox(height: MmSpace.s4),
                  const MobNote(MobCopy.nameNote),
                  const SizedBox(height: MmSpace.s16),
                  Text(MobCopy.colourLabel, style: type.label.copyWith(color: colors.ink2)),
                  ColourPicker(value: _colour, onChanged: (c) => setState(() => _colour = c)),
                ],
                if (_failure != null) ...[
                  const SizedBox(height: MmSpace.s12),
                  InlineBanner(message: MobCopy.failure(_failure!), tone: BannerTone.error),
                  if (_failure == MobFailure.mobLimit || _failure == MobFailure.mobLimitPro || _failure == MobFailure.alreadyInMob) ...[
                    const SizedBox(height: MmSpace.s8),
                    KeyButton.secondary(
                      label: MobCopy.openYourMob,
                      onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => const MobScreen())),
                    ),
                  ],
                ],
                const SizedBox(height: MmSpace.s24),
                KeyButton(label: _busy ? 'Joining' : MobCopy.joinKey, loading: _busy, onPressed: _busy ? null : _join),
              ],
              const SizedBox(height: MmSpace.s16),
              const MobNote(MobCopy.joinNoContacts, center: true),
            ],
          ),
        ),
      ],
    );
  }
}
