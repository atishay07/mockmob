import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/student_target.dart';
import '../edit_copy.dart';
import '../widgets/you_page.dart';
import '../widgets/you_row.dart';
import '../you_routes.dart';
import 'name_sheet.dart';
import 'plan_card.dart';
import 'sign_out_flow.dart';

/// Account (spec 5.12.4, WEB-PARITY F2 and F3): the plan card, the name (edited in a sheet and
/// saved to the profile), the subjects, the email, sign out and the way to ask for deletion.
/// Plan and credits come from `/api/auth/me` through the auth snapshot. No price, no purchase.
class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  bool _signingOut = false;
  bool _failed = false;
  DateTime? _nameSavedAt;

  Future<void> _signOut() async {
    final unsent = await unsentAnswers(ref);
    if (!mounted) return;
    final confirmed = await confirmSignOut(context, unsent: unsent);
    if (!confirmed || !mounted) return;
    setState(() {
      _signingOut = true;
      _failed = false;
    });
    try {
      await performSignOut(ref);
    } on Object {
      if (mounted) {
        setState(() {
          _signingOut = false;
          _failed = true;
        });
      }
    }
  }

  Future<void> _editName() async {
    final saved = await showNameSheet(context);
    if (saved != null && mounted) setState(() => _nameSavedAt = ref.read(nowProvider)());
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authSnapshotProvider);
    final target = ref.watch(studentTargetProvider);
    final name = auth.name?.trim();
    final hasName = name != null && name.isNotEmpty;
    final subjects = auth.subjects.isNotEmpty ? auth.subjects : target.subjects;
    const inset = MmSpace.gutter + 36 + MmSpace.s12;

    return YouPage(
      title: YouCopy.accountTitle,
      children: [
        const SizedBox(height: MmSpace.s8),
        Padding(padding: youGutter, child: PlanCard(auth: auth)),
        const GroupHeading(YouCopy.accountProfile, top: MmSpace.s24),
        YouPanel(
          inset: inset,
          children: [
            YouRow(
              icon: LucideIcons.pencilLine,
              title: YouCopy.accountName,
              note: hasName ? name : EditCopy.nameAdd,
              value: hasName ? EditCopy.nameEdit : null,
              onTap: _editName,
            ),
            YouRow(
              icon: LucideIcons.bookOpen,
              title: YouCopy.fieldSubjects,
              note: subjects.isEmpty ? EditCopy.notSet : subjects.map(subjectDisplayName).join(', '),
              onTap: () => openYouPage(context, YouPaths.subjects),
            ),
            if (auth.email != null) _EmailFact(email: auth.email!),
          ],
        ),
        if (_nameSavedAt != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s12, MmSpace.gutter, 0),
            child: ReceiptLine(text: EditCopy.nameSaved(_nameSavedAt!)),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s32, MmSpace.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_failed) ...[
                const InlineBanner(message: YouCopy.signOutFailed, tone: BannerTone.error),
                const SizedBox(height: MmSpace.s16),
              ],
              KeyButton.secondary(label: YouCopy.signOut, loading: _signingOut, onPressed: _signingOut ? null : _signOut),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s32),
        YouPanel(
          children: [
            YouRow(
              icon: LucideIcons.trash2,
              title: YouCopy.deleteRow,
              note: YouCopy.deleteRowNote,
              destructive: true,
              onTap: () => context.push(AppRoutes.youDelete),
            ),
          ],
        ),
      ],
    );
  }
}

/// The email: an icon well and the address, read-only, aligned with the rows above it.
class _EmailFact extends StatelessWidget {
  const _EmailFact({required this.email});

  final String email;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return RowFrame(
      semanticsLabel: '${YouCopy.accountEmail}. $email. ${YouCopy.accountEmailNote}',
      child: Row(
        children: [
          const IconWell(LucideIcons.atSign),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(YouCopy.accountEmail, style: type.labelLarge.copyWith(fontSize: 16)),
                const SizedBox(height: 2),
                Text(email, style: type.caption.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s4),
                Text(YouCopy.accountEmailNote, style: type.caption.copyWith(color: colors.ink3)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
