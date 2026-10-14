import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../access_copy.dart';
import '../access_gateway.dart';
import 'access_field.dart';

/// "Sign out of other devices" for You, Account: ends the account's sessions on the website and
/// other phones, keeping this one. Shows a working state, then what happened.
class SignOutOtherDevicesCard extends ConsumerStatefulWidget {
  const SignOutOtherDevicesCard({super.key});

  @override
  ConsumerState<SignOutOtherDevicesCard> createState() =>
      _SignOutOtherDevicesCardState();
}

class _SignOutOtherDevicesCardState
    extends ConsumerState<SignOutOtherDevicesCard> {
  bool _working = false;
  bool _done = false;
  String? _problem;

  Future<void> _run() async {
    if (_working) return;
    setState(() {
      _working = true;
      _done = false;
      _problem = null;
    });
    try {
      await ref.read(accountAccessGatewayProvider).signOutOtherDevices();
      if (!mounted) return;
      setState(() {
        _working = false;
        _done = true;
      });
    } on AccessException catch (e) {
      if (!mounted) return;
      setState(() {
        _working = false;
        _problem = AccessCopy.problem(e.failure);
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _working = false;
        _problem = AccessCopy.problem(AccessFailure.unknown);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.raised,
          borderRadius: MmRadius.panelAll,
          border: Border.all(color: colors.line),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.cardPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ExcludeSemantics(
                    child: Icon(
                      LucideIcons.monitorSmartphone,
                      size: 20,
                      color: colors.ink2,
                    ),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          AccessCopy.signOutOthersTitle,
                          style: type.title.copyWith(color: colors.ink),
                        ),
                        const SizedBox(height: MmSpace.s4),
                        Text(
                          AccessCopy.signOutOthersBody,
                          style: type.small.copyWith(color: colors.ink2),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: MmSpace.s16),
              if (_done) ...[
                const AccessDoneLine(
                  title: AccessCopy.signOutOthersTitle,
                  body: AccessCopy.signOutOthersDone,
                ),
              ] else ...[
                KeyButton.secondary(
                  label: _working
                      ? AccessCopy.signingOutOthers
                      : AccessCopy.signOutOthersAction,
                  loading: _working,
                  onPressed: _working ? null : _run,
                ),
                if (_problem != null) ...[
                  const SizedBox(height: MmSpace.s12),
                  AccessProblemLine(message: _problem!),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}
