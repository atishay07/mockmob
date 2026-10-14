import 'package:flutter/material.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../core/night_support.dart';
import 'mascot_support.dart';

const _hello = "Hi, I'm Mobi. Let's find where your marks go.";

Widget _welcome() => const Center(child: MobiStage(size: 190, say: _hello, semanticLabel: 'Mobi waving hello'));

Widget _lines() => const Padding(
      padding: EdgeInsets.fromLTRB(16, 48, 16, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Mobi(pose: MobiPose.sleepy, size: 96, say: 'Late one tonight. Ten minutes, then sleep.'),
        SizedBox(height: 32),
        Mobi(pose: MobiPose.point, size: 96, say: 'Start with Accountancy. Ten questions.'),
        SizedBox(height: 32),
        Mobi(pose: MobiPose.think, size: 96, say: 'Hmm. Partnership keeps slipping.'),
      ]),
    );

void main() {
  // Still: what reduced motion shows (the whole line, the key pose).
  nightGolden('mobi_stage_still', _welcome);
  // Live: 640 ms in, mid-wave with the line typing.
  nightGolden('mobi_stage_live', _welcome, disableAnimations: false);
  // Live, settled: the same stage once the whole line has typed in (the bubble keeps the size
  // of the full line while it types, so nothing reflows, and this is the state it ends in).
  settledGolden('mobi_stage_live_settled', _welcome);
  nightGolden('mobi_lines', _lines);
}
