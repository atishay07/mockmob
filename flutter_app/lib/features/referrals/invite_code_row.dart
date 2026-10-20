import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'referral_copy.dart';
import 'referral_data.dart';

/// "Have a friend's code?" (owner D165): one quiet key that opens a field for the code a friend shared. The code is read the
/// way the server reads it, kept with source 'code' and handed to the server at once, and what the server says is shown
/// plainly (added, unknown, your own, already used, not a new account, could not reach it). Drawn only once the server says
/// invites are live, and not for a student who already joined with an invite. Used in the after-sign-in sheet and the
/// Wallet's invite section.
class InviteCodeRow extends ConsumerStatefulWidget {
  const InviteCodeRow({super.key, this.startOpen = false});

  /// Opens the field at once (tests and goldens).
  final bool startOpen;

  @override
  ConsumerState<InviteCodeRow> createState() => _InviteCodeRowState();
}

class _InviteCodeRowState extends ConsumerState<InviteCodeRow> {
  late bool _open = widget.startOpen;
  final _controller = TextEditingController();
  final _focus = FocusNode();
  bool _busy = false;
  String? _problem;
  String? _added;

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _submit(ReferralStatus status) async {
    if (_busy || _added != null) return;
    final store = ref.read(pendingInviteStoreProvider);
    final service = ref.read(referralClaimServiceProvider);
    setState(() {
      _busy = true;
      _problem = null;
    });
    try {
      final kept = await store.captureCode(_controller.text);
      if (kept == null) {
        if (mounted) setState(() => _problem = ReferralCopy.codeBad);
        return;
      }
      final outcome = await service.claimPending(fresh: true);
      if (!mounted) return;
      setState(() {
        if (outcome.ok) {
          _added = ReferralCopy.codeAdded(status.reward);
        } else {
          _problem = ReferralCopy.codeProblem(outcome.reason);
        }
      });
    } on Object {
      if (mounted) setState(() => _problem = ReferralCopy.codeOffline);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        // After a refusal the cursor goes back to the field, so the code can be fixed at once.
        if (_problem != null) WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? _focus.requestFocus() : null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = ref.watch(referralStatusProvider).value;
    final colors = context.mmColors;
    final type = context.mmType;

    // Once added, the answer stays on screen even while the status is read again (a read that fails must not take it away).
    if (_added != null) {
      return Padding(
        padding: const EdgeInsets.only(top: MmSpace.s8),
        child: _Line(icon: LucideIcons.circleCheck, color: colors.goodText, text: _added!),
      );
    }
    if (status == null || !status.live || status.invitedState != null) return const SizedBox.shrink();
    if (!_open) {
      return Padding(
        padding: const EdgeInsets.only(top: MmSpace.s8),
        child: Align(
          alignment: AlignmentDirectional.centerStart,
          child: Transform.translate(
            offset: const Offset(-MmSpace.s16, 0),
            child: KeyButton.quiet(
              label: ReferralCopy.haveCode,
              onPressed: () {
                setState(() => _open = true);
                WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
              },
            ),
          ),
        ),
      );
    }

    OutlineInputBorder border(Color color, double width) =>
        OutlineInputBorder(borderRadius: MmRadius.keyAll, borderSide: BorderSide(color: color, width: width));
    final hasError = _problem != null;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(child: Text(ReferralCopy.codeLabel, style: type.label.copyWith(color: colors.ink2))),
          const SizedBox(height: MmSpace.s8),
          Semantics(
            label: ReferralCopy.codeLabel,
            child: TextField(
              controller: _controller,
              focusNode: _focus,
              enabled: !_busy,
              autocorrect: false,
              enableSuggestions: false,
              textCapitalization: TextCapitalization.characters,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(status),
              onChanged: (_) {
                if (_problem != null) setState(() => _problem = null);
              },
              // A pasted invite link works as well as a code, so the field takes any text up to a link's length.
              inputFormatters: [LengthLimitingTextInputFormatter(120)],
              cursorColor: colors.ink,
              style: type.body.copyWith(color: colors.ink, letterSpacing: 1.5),
              decoration: InputDecoration(
                hintText: ReferralCopy.codeHint,
                hintStyle: type.body.copyWith(color: colors.ink3, letterSpacing: 1.5),
                filled: true,
                fillColor: colors.raised,
                isDense: true,
                constraints: const BoxConstraints(minHeight: 56),
                contentPadding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: 16),
                enabledBorder: border(hasError ? colors.badText : colors.line, hasError ? 1.5 : 1),
                disabledBorder: border(colors.line, 1),
                focusedBorder: border(hasError ? colors.badText : colors.focusRing, 1.5),
              ),
            ),
          ),
          if (_problem != null) ...[
            const SizedBox(height: MmSpace.s8),
            _Line(icon: LucideIcons.circleAlert, color: colors.badText, text: _problem!),
          ],
          const SizedBox(height: MmSpace.s12),
          KeyButton.secondary(label: ReferralCopy.codeAdd, loading: _busy, onPressed: () => _submit(status)),
        ],
      ),
    );
  }
}

/// One plain line, read out when it appears: the icon and the words carry it, colour is the second signal.
class _Line extends StatelessWidget {
  const _Line({required this.icon, required this.color, required this.text});

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s2),
            child: ExcludeSemantics(child: Icon(icon, size: 16, color: color)),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(child: Text(text, style: context.mmType.small.copyWith(color: colors.ink))),
        ],
      ),
    );
  }
}
