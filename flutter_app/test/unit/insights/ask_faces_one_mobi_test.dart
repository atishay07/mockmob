import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/widgets/ask_messages.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

void _noop() {}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('one Mobi at a time in a thread: only the newest reply keeps a living face', (tester) async {
    await pumpMockmob(
      tester,
      const Column(children: [
        AskMessageView(message: AskMessage.reply('You lost 35 marks in Partnership.', origin: AskOrigin.phone), onRetry: _noop, newest: false),
        AskMessageView(message: AskMessage.reply('Try the cash flow chapter next.', origin: AskOrigin.phone), onRetry: _noop, animate: true),
      ]),
      brightness: Brightness.dark,
    );
    final faces = tester.widgetList<MobiFace>(find.byType(MobiFace)).toList();
    expect(faces, hasLength(2));
    expect(faces.map((f) => f.still), [true, false]);
    expect(faces.map((f) => f.entrance), [MobiAct.idle, MobiAct.correct]);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('an older reply never nods as it lands, even when it is marked as arriving', (tester) async {
    await pumpMockmob(
      tester,
      const AskMessageView(message: AskMessage.reply('Done.', origin: AskOrigin.phone), onRetry: _noop, animate: true, newest: false),
      brightness: Brightness.dark,
      disableAnimations: true,
    );
    final face = tester.widget<MobiFace>(find.byType(MobiFace));
    expect(face.entrance, MobiAct.idle);
    expect(face.still, isTrue);
  });

  testWidgets('a face that becomes still stops ticking, and wakes if it is newest again', (tester) async {
    Widget face({required bool still}) => Center(child: MobiFace(size: 32, watchTaps: false, still: still, seed: 3));
    await pumpMockmob(tester, face(still: false));
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: face(still: true))));
    await tester.pump(const Duration(seconds: 2));
    expect(tester.hasRunningAnimations, isFalse, reason: 'a still face has no ticker running');
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
