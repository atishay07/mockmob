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

/// `https://www.mockmob.in/join/<code>`: what a Mob is, the subject and seats (never a name), and
/// the name and colour step, then Join. An unusable code, for any reason including a block,
/// reads the same plain sentence (P10).
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
      setState(() => _nameError = MobCopy.nameRule);
      return;
    }
    setState(() => _busy = true);
    final failure = await ref.read(mobActionsProvider).join(code: _code!, name: _name.text, colour: _colour);
    if (!mounted) return;
    setState(() => _busy = false);
    if (failure == null) {
      ref.read(hapticsProvider).confirm();
      setState(() => _joined = true);
    } else if (failure == MobFailure.nameInvalid) {
      setState(() => _nameError = MobCopy.failure(failure));
    } else {
      setState(() => _failure = failure);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_joined) return const MobScreen();
    final type = context.mmType;
    final colors = context.mmColors;
    final inMob = ref.watch(currentMobProvider) != null;
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
                  label: MobCopy.joinTitle,
                  child: Column(children: [Skeleton(height: 32), SizedBox(height: MmSpace.s12), Skeleton(height: 64)]),
                )
              else if (_failure != null && preview == null || _failure == MobFailure.inviteInvalid || _failure == MobFailure.inviteExpired) ...[
                Text(MobCopy.inviteUnusable, style: type.title.copyWith(color: colors.ink)),
              ] else if (preview != null) ...[
                Text(MobCopy.joinTitle, style: type.headline.copyWith(color: colors.ink)),
                const SizedBox(height: MmSpace.s12),
                Text(MobCopy.joinBody(preview), style: type.body.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s24),
                if (inMob) ...[
                  const InlineBanner(message: MobCopy.alreadyInOne),
                  const SizedBox(height: MmSpace.s16),
                  KeyButton.secondary(label: MobCopy.seeMob, onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute<void>(builder: (_) => const MobScreen()))),
                ] else ...[
                  MobNameField(controller: _name, label: MobCopy.nameLabel, error: _nameError, onChanged: (_) => setState(() => _nameError = null)),
                  const SizedBox(height: MmSpace.s4),
                  const MobNote(MobCopy.nameRule),
                  const SizedBox(height: MmSpace.s16),
                  Text(MobCopy.colourLabel, style: type.label.copyWith(color: colors.ink2)),
                  ColourPicker(value: _colour, onChanged: (c) => setState(() => _colour = c)),
                  if (_failure != null) ...[
                    const SizedBox(height: MmSpace.s12),
                    InlineBanner(message: MobCopy.failure(_failure!), tone: BannerTone.error),
                  ],
                  const SizedBox(height: MmSpace.s24),
                  KeyButton(label: MobCopy.joinKey, loading: _busy, onPressed: _busy ? null : _join),
                ],
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
