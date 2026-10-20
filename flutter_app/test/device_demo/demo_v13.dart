// Version 13 surfaces in the device demo (20 Oct walk): the Wallet, the Pro page on Google Play's fakes, Ask Mobi's
// Where you stand, a doubt thread with its 2 CUET questions, and Fix it for good with its 2 checks. Nothing here
// talks to an account: the server is a scripted adapter and the store is the billing tests' fake.
// The Mob runs from the in-app fixture server: build the demo with --dart-define=MOB_V3_FIXTURES=true.
// ignore_for_file: depend_on_referenced_packages
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/features/credits/data/credits_data.dart' show meCreditsProvider;
import 'package:mockmob/features/insights/data/mobi_api.dart' show mobiStandingProvider;
import 'package:mockmob/features/review/data/fix_api.dart' show fixCheckApiProvider;
import 'package:mockmob/features/review/data/repair_record_api.dart' show serverRepairsProvider;
import 'package:mockmob/features/wallet/data/wallet_data.dart';

import '../golden/insights/mobi_v13_golden_test.dart' as mobi;
import '../golden/review/fix_v13_golden_test.dart' as fix;
import '../unit/billing/billing_test_support.dart' as billing;
import '../unit/core_data/support/fakes.dart' as http;
import '../unit/wallet/wallet_test_support.dart' as wallet;
import '../unit/you/you_test_support.dart' as you;

const _demoWallet = {'state': 'available', 'known': true, 'total': 46, 'includedMonthlyCredits': 50, 'bonusCredits': 6, 'spendable': 46};

Map<String, Object?> _check(String id, String stem, List<String> options) => {
      'checkQuestionId': id,
      'subject': 'accountancy',
      'chapter': 'Partnership Fundamentals',
      'topic': 'Admission',
      'format': 'mcq',
      'question': stem,
      'passage': null,
      'options': [for (var i = 0; i < options.length; i++) {'index': i, 'text': options[i]}],
    };

int _chats = 0;

/// The server's answers for the routes the demo's own repositories do not cover.
http.FakeReply _serve(dynamic o) {
  final path = o.path as String;
  if (path.contains('/api/ai/mentor/chat')) {
    _chats++;
    final first = _chats.isOdd;
    return http.FakeReply(200, {
      'ok': true,
      'sessionId': 'demo-s1',
      'reply': first
          ? 'CUET asks this chapter in two ways: a ratio you have to rebuild, and a rule that applies only when there is no deed. '
              'For a ratio, write the old shares as fractions, take away what each partner gives up, and add the new partner. '
              'For the no-deed rules, remember the Act: no interest on capital, no salary, profits shared equally and 6% a year on a partner’s loan.'
          : 'Because the Partnership Act fixes it at 6% a year when the deed is silent. The bank rate never comes into it unless the partners agree to it.',
      'origin': 'model',
      'actions': <Object>[],
      'charge': {'creditUnits': first ? 1 : 0, 'amount': first ? 1 : 0, 'reference': 'demo'},
      'usageSnapshot': _demoWallet,
      'thread': {'id': 'demo-t$_chats', 'followUpsLeft': first ? 1 : 0, 'followUpsMax': 1, 'subject': 'accountancy', 'chapter': 'Partnership Fundamentals'},
      'checks': first
          ? [
              _check('c1', 'A and B share profits 3:2. C is admitted for a 1/5 share, taken from A and B equally. What is the new ratio?',
                  ['5:3:2', '13:7:5', '12:8:5', '3:2:1']),
              _check('c2', 'In the absence of a partnership deed, interest on a partner’s loan to the firm is allowed at',
                  ['6% a year', '12% a year', 'The bank rate', 'Nothing, unless agreed']),
            ]
          : <Object>[],
      'checksNote': null,
    });
  }
  // Today's name card saves through the profile route.
  if (path.contains('/api/users/') && '${o.method}'.toUpperCase() == 'PATCH') {
    final body = o.data is Map ? o.data as Map : const {};
    return http.FakeReply(200, {'ok': true, 'name': body['name']});
  }
  if (path.contains('/api/mobi/thread')) {
    final body = o.data is Map ? o.data as Map : const {};
    final id = body['checkQuestionId'];
    final pick = body['pick'] is int ? body['pick'] as int : -1;
    const key = 0;
    return http.FakeReply(200, {
      'ok': true,
      'replayed': false,
      'result': {
        'right': pick == key,
        'pick': pick,
        'key': {'index': key, 'text': id == 'c1' ? '5:3:2' : '6% a year'},
        'picked': {'index': pick, 'text': ''},
        'explanation': id == 'c1'
            ? 'A keeps 3/5 minus 1/10, which is 5/10. B keeps 2/5 minus 1/10, which is 3/10. C gets 2/10. So the new ratio is 5:3:2.'
            : 'The Partnership Act allows 6% a year on a partner’s loan when the deed says nothing.',
        'line': pick == key ? 'Right. That is the rule CUET tests.' : 'Not this time. Read why, then the next one.',
      },
    });
  }
  return const http.FakeReply(404, {'ok': false, 'error': 'not_found'});
}

/// Asha's AI credits as the server reports them: 46 to spend (40 of 50 this month and 6 bought).
final demoAiCredits = AiCredits.fromJson({'state': 'available', 'wallet': _demoWallet});

List<Override> demoV13Overrides() {
  final adapter = http.FakeHttpAdapter()..handler = _serve;
  final rig = billing.BillingRig(userId: 'u1', store: billing.FakePlayStore());
  return [
    apiClientProvider.overrideWithValue(http.newApiClient(adapter, now: DateTime.now)),
    ...rig.overrides,
    // The account sheet's credits tiles: the same 46 (40 of 50 free this month and 6 bought).
    meCreditsProvider.overrideWith(() => you.FakeMeCredits(you.oneBalanceState(total: 46, freeLeft: 40, held: 6))),
    walletRepositoryProvider.overrideWith(() => wallet.FakeWalletRepo(wallet.walletState(wallet.walletBody()))),
    mobiStandingProvider.overrideWith((ref) async => mobi.ready),
    serverRepairsProvider.overrideWith((ref) async => const <String, DateTime>{}),
    fixCheckApiProvider.overrideWithValue(fix.FakeFixChecks()),
  ];
}
