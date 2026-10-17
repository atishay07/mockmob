import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import 'ask_controller.dart';
import 'ask_mobi_context.dart';
import 'ask_question.dart';
import 'ask_wallet.dart';

/// What the open Ask Mobi sheet is about. [dropped] is set when the student drops the subject
/// chip (or the question could not be opened): the sheet falls back to the record, and the
/// conversation so far stays.
class AskSheetScope {
  const AskSheetScope({required this.context, this.dropped = false, this.turn = 0});

  final AskMobiContext context;
  final bool dropped;

  /// Bumped when a sheet opens about something new; the conversation starts again then.
  final int turn;

  /// The context the sheet answers in now.
  AskMobiContext get effective => dropped ? const AskMobiContext.page() : context;
}

class AskSheetScopeController extends Notifier<AskSheetScope> {
  @override
  AskSheetScope build() {
    ref.watch(authSnapshotProvider.select((s) => s.userId));
    return const AskSheetScope(context: AskMobiContext.page());
  }

  /// Opens the sheet about [c]. The same thing again continues its conversation; anything else
  /// starts a new one. A question with a reference is opened (its context read from the server).
  void open(AskMobiContext c) {
    final same = c.identity == state.context.identity;
    state = AskSheetScope(context: c, turn: same ? state.turn : state.turn + 1);
    final questionRef = c.kind == AskMobiKind.question ? c.question?.ref : null;
    if (questionRef != null) {
      ref.read(askSheetQuestionProvider.notifier).open(questionRef);
    } else {
      ref.read(askSheetQuestionProvider.notifier).clear();
    }
  }

  /// Drops the subject: the sheet answers about the record from here.
  void drop() {
    if (state.dropped) return;
    state = AskSheetScope(context: state.context, dropped: true, turn: state.turn);
    ref.read(askSheetQuestionProvider.notifier).clear();
  }
}

final askSheetScopeProvider = NotifierProvider<AskSheetScopeController, AskSheetScope>(AskSheetScopeController.new);

/// The question the sheet was handed: its own, so the full Ask screen's never rides along.
final askSheetQuestionProvider = NotifierProvider<AskQuestionController, AskQuestionHand?>(AskQuestionController.new);

/// The sheet's conversation: Ask's own rules (record answers free on the phone, the budget guard
/// for the rest, the retry that reuses the request id so it is never charged twice), with the
/// sheet's question and the reply mode its context asks for.
class AskSheetController extends AskController {
  @override
  AskState build() {
    ref.watch(askSheetScopeProvider.select((s) => s.turn));
    return super.build();
  }

  @override
  String get replyMode => ref.read(askSheetScopeProvider).effective.mode;

  @override
  AskQuestionHand? readHand() => ref.read(askSheetQuestionProvider);
}

final askSheetControllerProvider = NotifierProvider<AskSheetController, AskState>(AskSheetController.new);

/// The wallet the sheet shows: the newer of its last reply's report and the credits read.
final askSheetWalletProvider = Provider<AskWallet?>((ref) {
  final (fromAsk, askAt) = ref.watch(askSheetControllerProvider.select((s) => (s.wallet, s.walletAt)));
  return freshestAskWallet(ref, fromAsk, askAt);
});
