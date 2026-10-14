import 'package:flutter/material.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/lab/lab_materials.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import 'night_support.dart';

Widget _subjects() {
  return Builder(
    builder: (context) => SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const LabSubjects(),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: MmRadius.panelAll,
            child: SizedBox(height: 120, child: Grain(opacity: context.mmColors.grain * 4)),
          ),
        ],
      ),
    ),
  );
}

void main() {
  nightGolden(
    'glass',
    () => const SingleChildScrollView(physics: NeverScrollableScrollPhysics(), padding: EdgeInsets.all(16), child: LabMaterials()),
  );
  nightGolden('subjects', _subjects);
}
