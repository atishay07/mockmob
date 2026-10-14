import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/profile_editor.dart';
import '../edit_copy.dart';

/// Edit the display name (WEB-PARITY F2): `PATCH /api/users/{id} {name}`, 1 to 80 characters.
/// The sheet closes only after the server answered; a failure keeps the text and says why.
/// Returns the saved name, or null when the student closed it.
Future<String?> showNameSheet(BuildContext context) => showMmSheet<String>(
      context: context,
      title: EditCopy.nameSheet,
      builder: (_) => const _NameBody(),
    );

class _NameBody extends ConsumerStatefulWidget {
  const _NameBody();

  @override
  ConsumerState<_NameBody> createState() => _NameBodyState();
}

class _NameBodyState extends ConsumerState<_NameBody> {
  late final TextEditingController _text = TextEditingController(text: ref.read(authSnapshotProvider).name?.trim() ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  String? get _problem {
    final name = _text.text.trim();
    if (name.isEmpty) return EditCopy.nameEmpty;
    if (name.length > kMaxNameLength) return EditCopy.nameTooLong;
    return null;
  }

  Future<void> _save() async {
    final problem = _problem;
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final saved = await ref.read(profileEditorProvider).saveName(_text.text);
      if (mounted) Navigator.of(context).pop(saved);
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
    final colors = context.mmColors;
    final type = context.mmType;
    final unchanged = _text.text.trim() == (ref.read(authSnapshotProvider).name?.trim() ?? '');
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(EditCopy.nameNote, style: type.small.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s12),
          TextField(
            controller: _text,
            enabled: !_saving,
            autofocus: true,
            maxLength: kMaxNameLength,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.done,
            style: type.lead,
            onChanged: (_) => setState(() => _error = null),
            onSubmitted: (_) => _save(),
            decoration: const InputDecoration(counterText: ''),
          ),
          const SizedBox(height: MmSpace.s16),
          if (_error != null) ...[
            InlineBanner(message: _error!, tone: BannerTone.error),
            const SizedBox(height: MmSpace.s12),
          ],
          KeyButton(label: EditCopy.nameSave, loading: _saving, onPressed: _saving || unchanged ? null : _save),
        ],
      ),
    );
  }
}
