// Ask Mobi option B (ASK-MOBI-1019; D112, D114; C-pick 2): Ask Mobi's own screen with its two big doors,
// "Ask now" and "Ask your record", at 360 and 412 dp, Night and Day, at 1x and 1.3x text, on a fresh
// account (the name the server stored is the email's first part, so Mobi says "Hi.") and a heavy
// one; the honest wait for a written reply; the Practice card; the labelled header keys.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/widgets/widgets.dart' show Mobi, MobiPose, TabRootHeader;
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';
import 'package:mockmob/features/insights/widgets/ask_mobi_button.dart';
import 'package:mockmob/features/insights/widgets/ask_mobi_card.dart';
import 'package:mockmob/features/today/logic/today_model.dart' show HeaderModel;
import 'package:mockmob/features/today/widgets/today_header.dart';
import 'package:mockmob/features/you/widgets/you_page.dart';

import '../../unit/insights/support/insights_fixtures.dart';
import 'insights_golden_support.dart';

/// Free's 50 a month, 38 left, renewing on 1 November (the wallet as the server sends it).
AiCredits _monthly({int total = 38}) => AiCredits.fromJson({
      'ok': true,
      'state': 'available',
      'isPaid': false,
      'wallet': {
        'state': 'available',
        'known': true,
        'spendable': true,
        'includedMonthlyCredits': 50,
        'includedRemaining': total,
        'bonusCredits': 0,
        'total': total,
        'resetAt': '2026-10-31T18:30:00.000Z',
      },
    });

/// A brand-new staging student: no papers, and the name the server stored is the email's first part.
List<Override> _fresh() => [
      ...insightsOverrides(insights: RemoteState(value: empty()), attempts: const [], credits: _monthly(total: 50))
          .where((o) => !identical(o.origin, authSnapshotProvider)),
      authSnapshotProvider.overrideWithBuild(
        (ref, n) => const AuthSnapshot(
          status: AuthStatus.signedIn,
          userId: 'u-fresh',
          email: 'g16-fresh-1019a@example.com',
          name: 'g16-fresh-1019a',
          subjects: ['accountancy', 'business_studies', 'economics', 'english'],
        ),
      ),
    ];

List<Override> _heavy() => insightsOverrides(credits: _monthly());

void main() {
  for (final (tag, size) in const [('360', Size(360, 800)), ('412', Size(412, 915))]) {
    insightsGolden('ask_b_fresh_$tag', () => const AskScreen(), size: size, overrides: _fresh);
    insightsGolden('ask_b_heavy_$tag', () => const AskScreen(), size: size, overrides: _heavy);
  }
  // The whole of each door, scrolled out: every row and the credit line.
  insightsGolden('ask_b_heavy_360_full', () => const AskScreen(), size: const Size(360, 1400), overrides: _heavy);
  insightsGolden('ask_b_fresh_360_text130', () => const AskScreen(), size: const Size(360, 1400), textScale: 1.3, overrides: _fresh);
  insightsGolden('ask_b_heavy_360_text130', () => const AskScreen(), size: const Size(360, 1600), textScale: 1.3, overrides: _heavy);

  // No credits left: the band says it once, in the credit line's place.
  insightsGolden('ask_b_heavy_360_no_credits', () => const AskScreen(), size: const Size(360, 800), overrides: () => insightsOverrides(credits: _monthly(total: 0)));

  // A written reply on its way: "Writing a reply", and what it uses, never a fake typewriter.
  insightsGolden(
    'ask_b_writing_360',
    () => const AskScreen(),
    size: const Size(360, 800),
    overrides: () => insightsOverrides(
      credits: _monthly(),
      ask: const AskState(messages: [AskMessage.student('Explain sacrificing ratio in simple words'), AskMessage.sending()]),
    ),
  );

  // Practice's card, in the old "Ask Mobi what to practise" row's slot.
  insightsGolden(
    'ask_b_practice_card_heavy_360',
    () => const Scaffold(body: Padding(padding: EdgeInsets.all(16), child: AskMobiCard())),
    size: const Size(360, 240),
    overrides: _heavy,
  );
  insightsGolden(
    'ask_b_practice_card_fresh_360',
    () => const Scaffold(body: Padding(padding: EdgeInsets.all(16), child: AskMobiCard())),
    size: const Size(360, 240),
    overrides: _fresh,
  );

  // The labelled key in each header: Today (with Mobi, "Ask" at 360), a tab root (Practice), Mob's page.
  for (final (tag, width) in const [('360', 360.0), ('412', 412.0)]) {
    insightsGolden(
      'ask_b_key_today_$tag',
      () => const Scaffold(
        body: Padding(
          padding: EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: TodayHeader(header: HeaderModel(dateLine: 'Monday, 13 October', greeting: 'Good evening, Riya')),
        ),
      ),
      size: Size(width, 96),
      overrides: _heavy,
    );
  }
  insightsGolden(
    'ask_b_key_practice_360',
    () => const Scaffold(
      body: Padding(
        padding: EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: TabRootHeader(title: 'Practice', trailing: AskMobiButton(figure: Mobi(pose: MobiPose.idle, size: 44))),
      ),
    ),
    size: const Size(360, 96),
    overrides: _heavy,
  );
  insightsGolden(
    'ask_b_key_mob_360',
    () => const YouPage(title: 'Mob', trailing: AskMobiButton(), children: [SizedBox(height: 40)]),
    size: const Size(360, 160),
    overrides: _heavy,
  );
}
