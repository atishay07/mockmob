import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';

/// The rig table, exported for the website. `docs/brain/MOBI-RIG.v2.json` is the app's copy and
/// the website keeps the same bytes at `data/mobi_rig.v2.json`; this test fails when the table and
/// the export drift.
///
/// Regenerate after an intended change (from flutter_app):
/// `MOCKMOB_WRITE_RIG=1 bash tool/flutter_locked.sh test -j 1 test/unit/mascot/mobi_rig_spec_test.dart`
/// It also writes the website's copy when the web worktree sits beside this one
/// (`../../wt-mobi/data/mobi_rig.v2.json`), or wherever `MOCKMOB_RIG_WEB_COPY` points.
const String _appCopy = '../docs/brain/MOBI-RIG.v2.json';
const String _webCopy = '../../wt-mobi/data/mobi_rig.v2.json';

String exportRig() => '${const JsonEncoder.withIndent('  ').convert(MobiBook.instance.spec)}\n';

void main() {
  test('MOBI-RIG.v2.json is the rig table, byte for byte', () {
    final text = exportRig();
    if (Platform.environment['MOCKMOB_WRITE_RIG'] == '1') {
      File(_appCopy)
        ..parent.createSync(recursive: true)
        ..writeAsStringSync(text);
      final web = Platform.environment['MOCKMOB_RIG_WEB_COPY'] ?? _webCopy;
      if (Directory(File(web).parent.path).existsSync()) File(web).writeAsStringSync(text);
    }
    final file = File(_appCopy);
    expect(file.existsSync(), isTrue, reason: 'generate it with MOCKMOB_WRITE_RIG=1 (see the file header)');
    expect(file.readAsStringSync(), text, reason: 'the rig table and docs/brain/MOBI-RIG.v2.json have drifted; regenerate and tell the web builder');
  });

  test('the export round-trips: the website reads the same numbers the app plays', () {
    final back = jsonDecode(exportRig()) as Map<String, Object?>;
    expect(jsonEncode(back), jsonEncode(MobiBook.instance.spec));
  });

  test('every act is in the table, with its length and the stance it leaves', () {
    final acts = MobiBook.instance.section('acts');
    expect(acts.keys, MobiAct.values.map((a) => a.name));
    for (final a in MobiAct.values) {
      final spec = acts[a.name]! as Map<String, Object?>;
      expect(spec['seconds'], isA<num>(), reason: a.name);
      expect(spec.containsKey('stance'), isTrue, reason: '${a.name} says what stance it leaves');
      expect(MobiMoves.reactions.contains(a), spec['reaction'] == true, reason: '${a.name}: the reactions set and the table agree');
    }
  });

  test('every stance and mood is in the table', () {
    expect(MobiBook.instance.section('stances').keys.toSet(), MobiStance.values.map((s) => s.name).toSet());
    expect(MobiBook.instance.section('stanceBlends').keys.toSet(), MobiStance.values.map((s) => s.name).toSet());
    expect(MobiBook.instance.section('moods').keys.toSet(), MobiMood.values.map((m) => m.name).toSet());
  });

  test('the idle numbers the choreography spec quotes come from the table', () {
    expect((MobiBook.instance.section('idle')['loadingScanSeconds']! as num).toDouble(), MobiSim.loadingScanFor);
    expect(MobiMoods.blend, const Duration(milliseconds: 300));
  });

  test('every expression in the table compiles (a typo fails here, not on a screen)', () {
    for (final a in MobiAct.values) {
      final p = MobiBook.instance.act(a.name);
      if (p == null) continue;
      for (var t = 0.0; t <= MobiMoves.duration(a); t += 0.05) {
        final r = p.run(t, const MobiRig());
        for (final v in [r.x, r.y, r.tilt, r.squash, r.lookX, r.lookY, r.glow, r.armL.angle, r.armR.angle, r.eyeL.open, r.eyeR.open]) {
          expect(v.isFinite, isTrue, reason: '${a.name} at $t');
        }
      }
    }
  });
}
