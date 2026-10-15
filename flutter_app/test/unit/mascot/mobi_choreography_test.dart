import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/next_move.dart' show lateNightEndHour, lateNightStartHour;
import 'package:mockmob/core/mascot/mascot.dart';

/// The choreography spec both surfaces share (the app and the website). `docs/brain/
/// MOBI-CHOREOGRAPHY.json` is generated from the code below and this test fails when the code
/// drifts from it. The web kit test reads the same file, so a change to a duration, a stance,
/// the event table or a rate limit is made in the app, written here, and picked up by the web.
///
/// Regenerate after an intended change (from flutter_app):
/// `MOCKMOB_WRITE_CHOREOGRAPHY=1 bash tool/flutter_locked.sh test -j 1 test/unit/mascot/mobi_choreography_test.dart`
const String _specPath = '../docs/brain/MOBI-CHOREOGRAPHY.json';

/// What the web reads. Order is stable: acts in enum order, events in enum order.
Map<String, Object?> buildChoreography() {
  final acts = <String, Object?>{};
  for (final act in MobiAct.values) {
    final stance = MobiMoves.stanceAfter(act);
    final celebrates = MobiRation.celebrations.contains(act);
    final stillPose = MobiMoves.showsStillPose(act);
    acts[act.name] = {
      'durationMs': (MobiMoves.duration(act) * 1000).round(),
      // The stance Mobi is left in; null means he returns to the stance he was in.
      'stance': stance?.name,
      // Held acts change the stance until the next act; the others play once.
      'held': MobiMoves.isHeld(act),
      'celebration': celebrates,
      // The act actually played under each Celebrations level (null: nothing plays). Under Quiet
      // a celebration is a nod; `held` is for a hero that stays on screen, which rests.
      'underQuiet': {'act': MobiRation.underLevel(act, MobiCelebrationLevel.quiet)!.name, 'held': MobiRation.underLevel(act, MobiCelebrationLevel.quiet, held: true)!.name},
      'underOff': MobiRation.underLevel(act, MobiCelebrationLevel.off)?.name,
      // Reduced motion: "still" shows the act's key pose with no travel for its duration and then
      // the stance; "stance" simply gives the stance the act leaves (a held act).
      'reducedMotion': stillPose ? 'still' : 'stance',
      'reaction': MobiMoves.reactions.contains(act),
    };
  }
  final events = <String, String>{for (final e in MobiEvent.values) e.name: MobiMoments.act(e).name};
  return {
    'version': 1,
    'source': 'flutter_app/lib/core/mascot (MobiMoves, MobiMoments, MobiRation, MobiTapCycle)',
    'acts': acts,
    'events': events,
    'celebrationLevels': {
      'full': 'every act as authored',
      'quiet': 'celebration acts become a nod; a held hero rests',
      'off': 'celebration acts play nothing, the stance stays',
    },
    'celebrationActs': MobiRation.celebrations.map((a) => a.name).toList()..sort(),
    'rateLimits': {
      'glanceGapMs': MobiRation.glanceGap.inMilliseconds,
      'nudgeAfterMs': MobiRation.nudgeAfter.inMilliseconds,
      'failureRunMs': MobiRation.failureRun.inMilliseconds,
      'reactNowDefaultGapMs': MobiRation.glanceGap.inMilliseconds,
      'helloPerDayPerScreen': 1,
      'nudgePerDayPerScreen': 1,
      'speakOncePerRunPerScreen': 1,
      'waitLongAfterMs': 2000,
      'loadingScanSeconds': MobiSim.loadingScanFor,
    },
    'lateNight': {
      'startHour': lateNightStartHour,
      'endHour': lateNightEndHour,
      'sleepFromHour': MobiMoments.sleepFromHour,
      'sleepyAct': MobiAct.sleepy.name,
      'sleepAct': MobiAct.sleep.name,
    },
    'tapCycle': {
      'acts': MobiTapCycle.standard.acts.map((a) => a.name).toList(),
      'resetAfterMs': MobiTapCycle.standard.resetAfter.inMilliseconds,
      'capPerVisit': MobiTapCycle.standard.cap,
      'neverSameActTwice': true,
      'sleepingWakesWith': MobiAct.wake.name,
      'withoutCycle': {'tap': 'squash', 'quickTapsForCheer': 3, 'quickTapWindowMs': MobiCharacter.quickTapWindow.inMilliseconds},
    },
    'followPointer': {
      'releaseAfterMs': MobiCharacter.followHold.inMilliseconds,
      'clampX': 0.85,
      'clampY': 0.8,
      'offUnderReducedMotion': true,
    },
  };
}

String _pretty(Object? value) => '${const JsonEncoder.withIndent('  ').convert(value)}\n';

void main() {
  test('MOBI-CHOREOGRAPHY.json matches the code that plays Mobi', () {
    final file = File(_specPath);
    final built = buildChoreography();
    if (Platform.environment['MOCKMOB_WRITE_CHOREOGRAPHY'] == '1') {
      file.parent.createSync(recursive: true);
      file.writeAsStringSync(_pretty(built));
    }
    expect(file.existsSync(), isTrue, reason: 'generate it with MOCKMOB_WRITE_CHOREOGRAPHY=1 (see the file header)');
    final onDisk = jsonDecode(file.readAsStringSync());
    // Compared as canonical JSON text so a drift reads as a diff of one line.
    expect(_pretty(onDisk), _pretty(jsonDecode(jsonEncode(built))), reason: 'the code and docs/brain/MOBI-CHOREOGRAPHY.json have drifted; regenerate and tell the web builder');
  });

  test('the spec is complete: every act and every event is in it', () {
    final built = buildChoreography();
    expect((built['acts']! as Map).keys, MobiAct.values.map((a) => a.name));
    expect((built['events']! as Map).keys, MobiEvent.values.map((e) => e.name));
  });

  test('the held list agrees with the stance table', () {
    for (final act in MobiAct.values) {
      final leaves = MobiMoves.stanceAfter(act);
      if (MobiMoves.isHeld(act)) expect(leaves, isNotNull, reason: '${act.name} is held, so it sets a stance');
    }
  });

  test('every celebration has a Quiet nod and an Off silence; nothing else is touched', () {
    for (final act in MobiAct.values) {
      final celebrates = MobiRation.celebrations.contains(act);
      expect(MobiRation.underLevel(act, MobiCelebrationLevel.full), act);
      expect(MobiRation.underLevel(act, MobiCelebrationLevel.quiet), celebrates ? MobiAct.nod : act);
      expect(MobiRation.underLevel(act, MobiCelebrationLevel.off), celebrates ? isNull : act);
    }
  });
}
