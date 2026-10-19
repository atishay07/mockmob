import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/auth/display_name.dart' show shownName;
import '../../../core/motion/motion.dart';
import '../../../core/storage/storage_providers.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/data/profile_editor.dart';
import '../../you/edit_copy.dart';

/// The words of the one-time name ask on Today (I11, 20 Oct).
abstract final class NameAskCopy {
  static const title = 'What should Mobi call you?';
  static const note = 'Your first name is enough. It shows on Today and You, and you can change it in You.';
  static const hint = 'Your first name';
  static const save = 'Save name';
  static const notNow = 'Not now';
}

/// A calm, one-time card under Today's greeting that asks for the student's first name.
///
/// A code sign-up has no name the student gave (the server keeps the email's prefix, which no
/// screen shows), so Today greets "Good evening" with no name and You says "Add your name"
/// (owner, 19 Oct, I11). The card shows once, while the account has no shown name and the student
/// has not saved or closed it on this phone. It saves through the profile route
/// (`PATCH /api/users/{id}`, [ProfileEditor.saveName]); the greeting then reads the name at once.
/// "Not now" puts it away for good: the name stays one tap away on You.
class TodayNameAsk extends ConsumerStatefulWidget {
  const TodayNameAsk({super.key});

  @override
  ConsumerState<TodayNameAsk> createState() => _TodayNameAskState();
}

class _TodayNameAskState extends ConsumerState<TodayNameAsk> {
  final _text = TextEditingController();
  final _focus = FocusNode();
  bool? _done;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _readDone();
  }

  Future<void> _readDone() async {
    bool done;
    try {
      done = await ref.read(appPrefsProvider).nameAskDone();
    } on Object {
      done = false;
    }
    if (mounted) setState(() => _done = done);
  }

  Future<void> _markDone() async {
    setState(() => _done = true);
    try {
      await ref.read(appPrefsProvider).setNameAskDone(true);
    } on Object {
      // Shown again next launch at worst.
    }
  }

  @override
  void dispose() {
    _text.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _text.text.trim();
    if (name.isEmpty) {
      setState(() => _error = EditCopy.nameEmpty);
      return;
    }
    if (name.length > kMaxNameLength) {
      setState(() => _error = EditCopy.nameTooLong);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(profileEditorProvider).saveName(name);
      if (!mounted) return;
      _focus.unfocus();
      setState(() => _saving = false);
      await _markDone();
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.isOffline ? EditCopy.nameOffline : EditCopy.nameFailed;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authSnapshotProvider);
    final show = _done == false && auth.isSignedIn && shownName(auth.name, email: auth.email) == null;
    return MmSizeEase(
      duration: Motion.card,
      curve: Motion.out,
      alignment: Alignment.topCenter,
      child: show ? _card(context) : const SizedBox(width: double.infinity),
    );
  }

  Widget _card(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s12),
      child: MmSurface.plain(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(NameAskCopy.title, style: type.lead.copyWith(color: colors.ink)),
            const SizedBox(height: MmSpace.s4),
            Text(NameAskCopy.note, style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            TextField(
              key: const ValueKey('today-name-ask-field'),
              controller: _text,
              focusNode: _focus,
              enabled: !_saving,
              maxLength: kMaxNameLength,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.givenName],
              style: type.lead,
              // The field scrolls itself clear of the keyboard, with room for the key under it.
              scrollPadding: const EdgeInsets.only(bottom: 120),
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
              onSubmitted: (_) => _save(),
              decoration: const InputDecoration(hintText: NameAskCopy.hint, counterText: ''),
            ),
            if (_error != null) ...[
              const SizedBox(height: MmSpace.s12),
              InlineBanner(message: _error!, tone: BannerTone.error),
            ],
            const SizedBox(height: MmSpace.s12),
            Row(
              children: [
                Expanded(child: KeyButton.secondary(label: NameAskCopy.save, loading: _saving, onPressed: _saving ? null : _save)),
                const SizedBox(width: MmSpace.s8),
                KeyButton(label: NameAskCopy.notNow, variant: KeyVariant.quiet, expanded: false, onPressed: _saving ? null : _markDone),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
