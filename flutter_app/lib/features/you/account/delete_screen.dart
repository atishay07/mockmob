import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/auth/sign_out_cleanup.dart';
import '../../../core/models/auth_me.dart' show PlaySubscriptionInfo;
import '../../../core/haptics/haptics.dart';
import '../../../core/sync/pending_work.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../billing/billing.dart' show playBillingProvider, playSubscriptionProvider, subscriptionHeld;
import '../../billing/billing_copy.dart';
import '../copy.dart';
import '../widgets/you_page.dart';
import 'sign_out_flow.dart';

/// What the server said to a deletion request.
class DeletionReceipt {
  const DeletionReceipt({required this.requestedAt, required this.alreadyRequested});

  final DateTime requestedAt;

  /// A repeat request: the server returns the earlier pending request, so its `requestedAt` is
  /// well before the call we just made.
  final bool alreadyRequested;
}

/// How much older than the call a `requestedAt` must be to read as an earlier request. The phone
/// and the server do not share a clock, and a phone running a few minutes fast must not turn a
/// first request into a repeat, so only a request from a day or more earlier counts.
const Duration kRepeatRequestGap = Duration(days: 1);

/// Sends `POST /api/me/delete {source:'android'}`. Deletion is only a request: an operator
/// processes it, so nothing here says "deleted".
Future<DeletionReceipt> requestAccountDeletion(WidgetRef ref, {DateTime Function() now = DateTime.now}) async {
  final startedAt = now();
  // Only ever for the account on screen: never sent with the token of one that signed in since.
  final response = await ref.read(apiClientProvider).post(
        '/api/me/delete',
        body: {'source': 'android'},
        expectUserId: ref.read(authSnapshotProvider).userId,
      );
  final map = response.map;
  final requestedAt = DateTime.tryParse('${map['requestedAt']}')?.toLocal() ?? startedAt;
  // The server's own word wins when it gives one; otherwise the gap, wide enough to ride out
  // a phone clock that is off by minutes or hours.
  final flagged = map['alreadyRequested'];
  final repeat = flagged is bool ? flagged : requestedAt.isBefore(startedAt.subtract(kRepeatRequestGap));
  return DeletionReceipt(requestedAt: requestedAt, alreadyRequested: repeat);
}

/// Whether deleting the account would leave a Google Play subscription that can still charge the student:
/// one that is active with renewal on (or not known to be off, a payment Google Play is retrying included),
/// or one Google Play holds or has paused. A subscription that was cancelled in Google Play and only runs
/// to its end charges nothing more, so no warning is owed. Deleting the account never cancels it.
bool deleteLeavesPlayCharging(PlaySubscriptionInfo? sub) => sub != null && ((sub.active && !sub.renewalOff) || subscriptionHeld(sub));

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
  bool _manageFailed = false;
  PendingWorkCount _pending = PendingWorkCount.none;
  bool _pendingUnknown = false;
  final TextEditingController _typed = TextEditingController();
  final MobiController _mobi = MobiController();
  final GlobalKey _cancelKey = GlobalKey();

  /// The page tells the student to type DELETE; a phone keyboard may capitalise it for them or
  /// not, so the case does not matter.
  bool get _confirmed => _typed.text.trim().toUpperCase() == YouCopy.deleteWord;

  @override
  void initState() {
    super.initState();
    pendingWork(ref).then((read) {
      if (!mounted) return;
      setState(() {
        _pending = read.count;
        _pendingUnknown = read.unknown;
      });
    });
  }

  @override
  void dispose() {
    _typed.dispose();
    _mobi.dispose();
    super.dispose();
  }

  Future<void> _request() async {
    if (!_confirmed) return;
    FocusScope.of(context).unfocus();
    ref.read(hapticsProvider).warn();
    setState(() {
      _step = _Step.sending;
      _error = null;
    });
    try {
      final receipt = await requestAccountDeletion(ref, now: ref.read(nowProvider));
      // The request is with us: a question left waiting in Ask Mobi is not kept for an account that is going.
      await forgetPendingAsk(ref.read(pendingAskPrefsProvider));
      if (!mounted) return;
      setState(() {
        _receipt = receipt;
        _step = _Step.recorded;
      });
      // Mobi points at how to cancel once the page has laid it out.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _mobi.pointAtWidget(_cancelKey);
      });
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _step = _Step.ask;
        _error = e.isOffline ? YouCopy.deleteOffline : YouCopy.deleteFailed;
      });
    } on Object {
      // Anything else (a decode failure, a bad response) must not leave the key spinning.
      if (!mounted) return;
      setState(() {
        _step = _Step.ask;
        _error = YouCopy.deleteFailed;
      });
    }
  }

  /// Opens Google Play's own subscription page, as the plan card does; when it does not open, one line says
  /// where to find it.
  Future<void> _manage() async {
    final opened = await ref.read(playBillingProvider.notifier).manageSubscription();
    if (mounted) setState(() => _manageFailed = !opened);
  }

  /// Whether a Google Play subscription that can still charge the student is on this account.
  bool get _playOwed => deleteLeavesPlayCharging(ref.watch(playSubscriptionProvider));

  /// The warning, read before the student types DELETE and again once the request is recorded: deleting the
  /// account does not stop Google Play charging for Pro, so the student is pointed at Google Play (it protects
  /// teens from a charge they did not expect). Callers draw it only when [_playOwed].
  Widget _playNotice(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InlineBanner(
          message: YouCopy.deletePlayNote,
          tone: BannerTone.warning,
          actionLabel: BillingCopy.manageSubscription,
          onAction: _manage,
          actionChevron: false,
        ),
        if (_manageFailed) ...[
          const SizedBox(height: MmSpace.s8),
          Semantics(liveRegion: true, child: Text(BillingCopy.manageOpenFailed, style: context.mmType.small.copyWith(color: colors.ink2))),
        ],
      ],
    );
  }

  Future<void> _signOut() async {
    setState(() {
      _step = _Step.signingOut;
      _error = null;
    });
    try {
      // The account is going, so what was queued for it goes too.
      await performSignOut(ref, keepQueuedWork: false);
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
          padding: const EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
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
        const SizedBox(height: MmSpace.s12),
        Text(YouCopy.deleteWorksUntil, style: type.body.copyWith(color: colors.ink2)),
        if (_pendingUnknown) ...[
          const SizedBox(height: MmSpace.s12),
          Text(YouCopy.deleteUnknown, style: type.body.copyWith(color: colors.ink2)),
        ],
        if (_pending.unsentAnswers > 0) ...[
          const SizedBox(height: MmSpace.s12),
          Text(YouCopy.deleteUnsent(_pending.unsentAnswers), style: type.body.copyWith(color: colors.ink2)),
        ],
        if (_pending.queuedWrites > 0) ...[
          const SizedBox(height: MmSpace.s12),
          Text(YouCopy.deleteQueued(_pending.queuedWrites), style: type.body.copyWith(color: colors.ink2)),
        ],
        if (_playOwed) ...[const SizedBox(height: MmSpace.s16), _playNotice(context)],
        const SizedBox(height: MmSpace.group),
        Semantics(
          label: YouCopy.deleteTypeLabel,
          child: Text(YouCopy.deleteTypeLabel, style: type.labelLarge),
        ),
        const SizedBox(height: MmSpace.s8),
        TextField(
          controller: _typed,
          enabled: !sending,
          autocorrect: false,
          enableSuggestions: false,
          textCapitalization: TextCapitalization.characters,
          textInputAction: TextInputAction.done,
          style: type.lead,
          onChanged: (_) => setState(() => _error = null),
          onSubmitted: (_) => _confirmed ? _request() : null,
          decoration: InputDecoration(
            hintText: YouCopy.deleteHint,
            hintStyle: type.lead.copyWith(color: colors.ink4),
            counterText: '',
          ),
        ),
        const SizedBox(height: MmSpace.group),
        if (_error != null) ...[InlineBanner(message: _error!, tone: BannerTone.error), const SizedBox(height: MmSpace.s16)],
        // The safe choice is the dominant key. The destructive key sits flat beside it in weight,
        // stays off until DELETE is typed, and never carries Mobi.
        KeyButton(label: YouCopy.deleteKeep, onPressed: sending ? null : () => Navigator.of(context).maybePop()),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(
          label: YouCopy.deleteRequest,
          loading: sending,
          hapticOnCommit: false,
          onPressed: sending || !_confirmed ? null : _request,
        ),
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
        // Mobi points at the way to cancel, which is the one thing left to do besides signing out.
        Align(
          alignment: Alignment.centerLeft,
          child: Mobi(pose: MobiPose.point, size: 64, controller: _mobi),
        ),
        const SizedBox(height: MmSpace.s8),
        Semantics(
          liveRegion: true,
          child: Text(receipt.alreadyRequested ? YouCopy.deleteAlready : YouCopy.deleteRecordedHeadline, style: type.lead),
        ),
        const SizedBox(height: MmSpace.s16),
        ReceiptLine(
          text: receipt.alreadyRequested ? YouCopy.deleteRequestedOn(receipt.requestedAt) : YouCopy.deleteRecordedAt(receipt.requestedAt),
        ),
        const SizedBox(height: MmSpace.s12),
        Text(YouCopy.deleteCancelNote, key: _cancelKey, style: type.body.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s12),
        Text(YouCopy.deleteSignOutNote, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.group),
        if (_error != null) ...[InlineBanner(message: _error!, tone: BannerTone.error), const SizedBox(height: MmSpace.s16)],
        if (_playOwed) ...[_playNotice(context), const SizedBox(height: MmSpace.s16)],
        KeyButton(label: YouCopy.signOut, loading: signingOut, onPressed: signingOut ? null : _signOut),
      ],
    );
  }
}
