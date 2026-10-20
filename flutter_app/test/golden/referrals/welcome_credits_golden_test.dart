// Goldens for the welcome-credits sheet (owner, 20 Oct 11:20 pm): with invites live, with invites off, and while the
// invite status loads; Night and Day, 360 dp, text 1.0 and 1.3. Pictures: goldens/welcome_<state>_<scale>_<night|day>.png.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/credits/data/credit_figures.dart';
import 'package:mockmob/features/referrals/referral_data.dart';
import 'package:mockmob/features/referrals/welcome_credits_sheet.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core/night_support.dart';

const _openerKey = ValueKey('golden-opener');

const _live = ReferralStatus(live: true, code: 'K7P2M9X', link: 'https://www.mockmob.in/r/K7P2M9X');

Widget _opener() => GoldenRoom(
      child: Builder(
        builder: (context) => Align(
          alignment: const Alignment(0, -0.2),
          child: GestureDetector(
            key: _openerKey,
            behavior: HitTestBehavior.opaque,
            onTap: () => showWelcomeCreditsSheet(context),
            child: const SizedBox(width: 120, height: 48),
          ),
        ),
      ),
    );

void _golden(String name, Future<ReferralStatus> Function() status) {
  for (final scale in [1.0, 1.3]) {
    for (final brightness in [Brightness.dark, Brightness.light]) {
      final tag = brightness == Brightness.dark ? 'night' : 'day';
      testWidgets('welcome $name, ${scale}x, $tag', (tester) async {
        await pumpMockmob(
          tester,
          _opener(),
          brightness: brightness,
          size: const Size(360, 780),
          textScale: scale,
          disableAnimations: true,
          overrides: [
            referralStatusProvider.overrideWith((ref) => status()),
            creditFiguresProvider.overrideWithValue(const CreditFigures(mode: CreditsMode.oneBalance, total: 50, practice: 50, ai: 50)),
          ],
        );
        await tester.tap(find.byKey(_openerKey));
        for (var i = 0; i < 12; i++) {
          await tester.pump(const Duration(milliseconds: 60));
        }
        expect(tester.takeException(), isNull);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/welcome_${name}_${scale}_$tag.png'));
      });
    }
  }
}

void main() {
  setUpAll(loadAppFonts);

  _golden('live', () async => _live);
  _golden('off', () async => ReferralStatus.off);
  _golden('loading', () => Completer<ReferralStatus>().future);
}
