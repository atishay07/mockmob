import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/result/model/answer_items.dart';

import '../../../helpers/golden_harness.dart' show FileAssetBundle;

/// One of the website's lab contracts (`ready`, `basic`, `none`), copied byte for byte from
/// `data/tests/fixtures/mistake_lab/`.
Map<String, dynamic> labContract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

MistakeLab labOf(String name) => MistakeLab.tryParse(labContract(name))!;

/// A key around whatever [pumpLabHost] shows, for goldens.
const labGoldenKey = ValueKey('lab-golden');

/// Pumps [child] in a scrolling page of the app theme, [size] wide and tall, at DPR 2.
Future<void> pumpLabHost(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.dark,
  Size size = const Size(360, 780),
  bool reduced = false,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
          home: Builder(
            builder: (context) => Scaffold(
              backgroundColor: context.mmColors.ground,
              body: SingleChildScrollView(
                child: RepaintBoundary(
                  key: labGoldenKey,
                  child: ColoredBox(
                    color: context.mmColors.ground,
                    child: Padding(padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, MmSpace.s24), child: child),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/// Question 17 of the ready contract's paper: the student picked B, the key is D.
AnswerItem q17Item() => AnswerItem(
      number: 17,
      question: SnapshotQuestion.fromJson(const {
        'id': 'q17',
        'chapter': 'Accounting for share capital',
        'question': 'On forfeiture of 100 shares of 10 rupees each, 8 rupees called up, on which 5 rupees a share was paid, the Share Forfeiture account is credited with',
        'options': ['300 rupees', '800 rupees', '1,000 rupees', '500 rupees'],
        'correctIndex': 3,
      }),
      verdict: Verdict.wrong,
      given: 1,
      keyIndex: 3,
      repairable: true,
    );
