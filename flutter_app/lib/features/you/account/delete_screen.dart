import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/you_page.dart';
import 'sign_out_flow.dart';

/// What the server said to a deletion request.
class DeletionReceipt {
  const DeletionReceipt({required this.requestedAt, required this.alreadyRequested});

  final DateTime requestedAt;

  /// A repeat request: the server returns the earlier pending request, so its `requestedAt` is
  /// older than the call we just made.
  final bool alreadyRequested;
}

/// Sends `POST /api/me/delete {source:'android'}`. Deletion is only a request: an operator
/// processes it, so nothing here says "deleted".
Future<DeletionReceipt> requestAccountDeletion(WidgetRef ref, {DateTime Function() now = DateTime.now}) async {
  final startedAt = now();
  final response = await ref.read(apiClientProvider).post('/api/me/delete', body: {'source': 'android'});
  final map = response.map;
  final requestedAt = DateTime.tryParse('${map['requestedAt']}')?.toLocal() ?? startedAt;
  final repeat = requestedAt.isBefore(startedAt.subtract(const Duration(minutes: 2)));
  return DeletionReceipt(requestedAt: requestedAt, alreadyRequested: repeat);
}

enum _Step { ask, sending, recorded, signingOut }

/// Delete account (spec 5.12.4). One screen, one destructive key. The student is signed out
/// only after the server has recorded the request, and that last step is theirs to press, so the
/// confirmation stays readable instead of vanishing under a redirect.
class DeleteScreen extends ConsumerStatefulWidget {
  const DeleteScreen({super.key});

  @override
  ConsumerState<DeleteScreen> createState() => _DeleteScreenState();
}

class _DeleteScreenState extends ConsumerState<DeleteScreen> {
  _Step _step = _Step.ask;
  String? _error;
  DeletionReceipt? _receipt;
  int _unsent = 0;

  @override
  void initState() {
    super.initState();
    unsentAnswers(ref).then((n) {
      if (mounted) setState(() => _unsent = n);
    });
  }

  Future<void> _request() async {
    ref.read(hapticsProvider).warn();
    setState(() {
      _step = _Step.sending;
      _error = null;
    });
    try {
      final receipt = await requestAccountDeletion(ref, now: ref.read(nowProvider));
      if (!mounted) return;
      setState(() {
        _receipt = receipt;
        _step = _Step.recorded;
      });
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _step = _Step.ask;
        _error = e.isOffline ? YouCopy.deleteOffline : YouCopy.deleteFailed;
      });
    }
  }

  Future<void> _signOut() async {
    setState(() {
      _step = _Step.signingOut;
      _error = null;
    });
    try {
      await performSignOut(ref);
    } on Object {
      if (mounted) {
        setState(() {
          _step = _Step.recorded;
          _error = YouCopy.deleteSignOutFailed;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final recorded = _step == _Step.recorded || _step == _Step.signingOut;
    return YouPage(
      title: recorded ? YouCopy.deleteReceivedTitle : YouCopy.deleteTitle,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
          child: recorded ? _recorded(context) : _ask(context),
        ),
      ],
    );
  }

  Widget _ask(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final sending = _step == _Step.sending;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(YouCopy.deleteConsequences, style: type.lead),
        const SizedBox(height: MmSpace.s12),
        Text(YouCopy.deleteNotInstant, style: type.body.copyWith(color: colors.ink2)),
        if (_unsent > 0) ...[
          const SizedBox(height: MmSpace.s12),
          Text(YouCopy.deleteUnsent(_unsent), style: type.body.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.group),
        if (_error != null) ...[InlineBanner(message: _error!, tone: BannerTone.error), const SizedBox(height: MmSpace.s16)],
        // The safe choice is the dominant key. The destructive key sits flat beside it in weight.
        KeyButton(label: YouCopy.deleteKeep, onPressed: sending ? null : () => Navigator.of(context).maybePop()),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(label: YouCopy.deleteRequest, loading: sending, hapticOnCommit: false, onPressed: sending ? null : _request),
      ],
    );
  }

  Widget _recorded(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final receipt = _receipt!;
    final signingOut = _step == _Step.signingOut;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          liveRegion: true,
          child: Text(receipt.alreadyRequested ? YouCopy.deleteAlready : YouCopy.deleteConsequences, style: type.lead),
        ),
        const SizedBox(height: MmSpace.s16),
        ReceiptLine(
          text: receipt.alreadyRequested ? YouCopy.deleteRequestedOn(receipt.requestedAt) : YouCopy.deleteRecordedAt(receipt.requestedAt),
        ),
        const SizedBox(height: MmSpace.s12),
        Text(YouCopy.deleteSignOutNote, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.group),
        if (_error != null) ...[InlineBanner(message: _error!, tone: BannerTone.error), const SizedBox(height: MmSpace.s16)],
        KeyButton(label: YouCopy.signOut, loading: signingOut, onPressed: signingOut ? null : _signOut),
      ],
    );
  }
}
