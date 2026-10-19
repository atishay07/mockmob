import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/moment_test_kit.dart';


void main() {
  // setUpGoldenFonts();
  testWidgets('debug', (tester) async {
    final server = v3Server(scenario: 'questdone');
    // ignore: avoid_print
    print('A');
    final which = await pumpMomentHost(tester, server: server);
    // ignore: avoid_print
    print('B');
    which.value = questKey(server);
    await tester.pump();
    // ignore: avoid_print
    print('B1');
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 120)));
    // ignore: avoid_print
    print('B2');
    await tester.pump();
    // ignore: avoid_print
    print('B3');
    await tester.pump(const Duration(milliseconds: 16));
    // ignore: avoid_print
    print('B4');
    // ignore: avoid_print
    print('C');
    await pumpTo(tester, 2200);
    // ignore: avoid_print
    print('D');
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/zz.png'));
    // ignore: avoid_print
    print('E');
  }, timeout: const Timeout(Duration(seconds: 40)));
}
