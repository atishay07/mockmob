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
import '../widgets/mob_pro_entry.dart';
import '../widgets/mob_ring.dart';
import 'mob_screen.dart';

/// `https://www.mockmob.in/join/<code>`: who invited you and what a Mob asks (one 10-question paper a
/// week, 10 minutes), the subject and seats (never a member's name), your name and colour already
/// filled in and editable (T001), and one key. An unusable code, for any reason including a block,
/// reads the same plain sentence (P10). A full Mob (MOB_FULL) and the paused links (JOIN_PAUSED) each
/// have their own words and one way forward. Open to everyone (owner decision D-S1): nothing stands
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
    // Only a name that passes the screen's own rule is prefilled; otherwise the field starts empty.
    final first = mobNameFrom(ref.read(authSnapshotProvider).name);
    _name = TextEditingController(text: first);
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
    } else if (failure == MobFailure.inviteInvalid || failure == MobFailure.inviteExpired || failure == MobFailure.full || failure == MobFailure.joinPaused) {
      // The link stopped working, or the Mob filled, since the page was drawn: the page says so.
      setState(() => _failure = failure);
    } else {
      setState(() => _failure = failure);
    }
  }

  /// The link is unusable (bad, expired, gone, or a block): one sentence, nothing more.
  bool get _unusable => _failure == MobFailure.inviteInvalid || _failure == MobFailure.inviteExpired;

  /// The Mob has its 5 members (MOB_FULL), at the page or at the Join key.
  bool get _full => _failure == MobFailure.full;

  /// New members cannot join by link right now (the owner's stop rule, JOIN_PAUSED).
  bool get _paused => _failure == MobFailure.joinPaused;

  void _openMobs() => Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => const MobScreen()));

  /// A state that is not an invite: its own words, and the way forward.
  List<Widget> _stateCard(String title, String note, {bool startOwn = false}) {
    final type = context.mmType;
    final colors = context.mmColors;
    return [
      Text(title, style: type.headline.copyWith(color: colors.ink)),
      const SizedBox(height: MmSpace.s8),
      Text(note, style: type.body.copyWith(color: colors.ink2)),
      if (startOwn) ...[
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: MobCopy.startOwn, onPressed: _openMobs),
      ],
    ];
  }

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
              else if (_unusable)
                ..._stateCard(MobCopy.inviteUnusableTitle, MobCopy.inviteUnusableNote, startOwn: true)
              else if (_full)
                ..._stateCard(MobCopy.inviteFullTitle, MobCopy.inviteFullNote, startOwn: true)
              else if (_paused)
                ..._stateCard(MobCopy.invitePausedTitle, MobCopy.invitePausedNote)
              else if (preview == null) ...[
                Text(MobCopy.inviteLoadFailedTitle, style: type.headline.copyWith(color: colors.ink)),
                const SizedBox(height: MmSpace.s8),
                Text(ref.read(mobActionsProvider).say(_failure ?? MobFailure.generic), style: type.body.copyWith(color: colors.ink2)),
                MobProEntry(failure: _failure),
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
                  InlineBanner(message: ref.read(mobActionsProvider).say(_failure!), tone: BannerTone.error),
                  MobProEntry(failure: _failure),
                  // Joining is open to every plan up to one safety ceiling (12 Mobs); a Mob you are in already just opens.
                  if (_failure == MobFailure.mobCeiling || _failure == MobFailure.alreadyInMob) ...[
                    const SizedBox(height: MmSpace.s8),
                    KeyButton.secondary(label: MobCopy.openYourMobs, onPressed: _openMobs),
                  ],
                ],
                const SizedBox(height: MmSpace.s24),
                KeyButton(label: _busy ? 'Joining' : MobCopy.joinKey, loading: _busy, onPressed: _busy ? null : _join),
              ],
              if (preview != null && !_unusable && !_full && !_paused) ...[
                const SizedBox(height: MmSpace.s16),
                const MobNote(MobCopy.joinNoContacts, center: true),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
