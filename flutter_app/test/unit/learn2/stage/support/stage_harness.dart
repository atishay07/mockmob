// A harness for the study stage's widget tests: the app's theme and type, a recording haptics driver, reduced motion
// and text scale on demand, a phone-sized view, and real Key cards from the display parity fixture.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';

/// Records every haptic the stage asks for.
class StageHaptics implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

final Map<Brightness, ThemeData> _themes = {for (final b in Brightness.values) b: buildTheme(b)};

/// Pumps [child] in the app's theme on a [size] phone (360 x 800 by default). [reduced] asks for less motion;
/// [textScale] scales text; [haptics] records the haptics.
Future<void> pumpStage(
  WidgetTester tester,
  Widget child, {
  Size size = const Size(360, 800),
  Brightness brightness = Brightness.dark,
  bool reduced = false,
  double textScale = 1,
  StageHaptics? haptics,
  EdgeInsets padding = EdgeInsets.zero,
}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  // Never the phone's channel in a test: a recorder always stands in for it.
  final driver = haptics ?? StageHaptics();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver))],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: _themes[brightness],
        builder: (context, app) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            disableAnimations: reduced,
            textScaler: TextScaler.linear(textScale),
            padding: padding,
            viewPadding: padding,
          ),
          child: app!,
        ),
        home: Scaffold(body: child),
      ),
    ),
  );
}

/// Real Key cards (NCERT's own words) from the Key cards display parity fixture, by id.
Map<String, KeyCard> realCards() {
  final data = jsonDecode(File('test/unit/keycards/support/display_parity.json').readAsStringSync()) as Map<String, dynamic>;
  final out = <String, KeyCard>{};
  for (final c in (data['cards'] as List).cast<Map<String, dynamic>>()) {
    final card = KeyCard.tryParse(c['card']);
    if (card != null) out[card.id] = card;
  }
  return out;
}

/// The Learn preview's real questions (the web's fixture), as the parity fixture holds their stems and options.
List<({String id, String stem, List<({String key, String text})> options})> realQuestions() {
  final data = jsonDecode(File('test/fixtures/learn2/parity/stage_text.json').readAsStringSync()) as Map<String, dynamic>;
  final stems = (data['stems'] as List).cast<Map<String, dynamic>>().where((s) => !(s['id'] as String).startsWith('edge-')).toList();
  final options = (data['options'] as List).cast<Map<String, dynamic>>().take(stems.length).toList();
  return [
    for (final (i, s) in stems.indexed)
      (
        id: s['id'] as String,
        stem: s['stem'] as String,
        options: [
          for (final o in (options[i]['options'] as List).cast<Map<String, dynamic>>()) (key: o['key'] as String, text: o['text'] as String),
        ],
      ),
  ];
}

/// Captures what the stage says to a screen reader (`SemanticsService.sendAnnouncement`).
List<String> captureAnnouncements(WidgetTester tester) {
  final said = <String>[];
  tester.binding.defaultBinaryMessenger.setMockDecodedMessageHandler<dynamic>(SystemChannels.accessibility, (message) async {
    final map = message as Map<Object?, Object?>;
    if (map['type'] == 'announce') said.add(((map['data'] as Map<Object?, Object?>)['message']) as String);
    return null;
  });
  addTearDown(() => tester.binding.defaultBinaryMessenger.setMockDecodedMessageHandler<dynamic>(SystemChannels.accessibility, null));
  return said;
}
