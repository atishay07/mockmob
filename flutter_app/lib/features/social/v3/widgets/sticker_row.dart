// The preset sticker row (spec 5.3 D3, L1, R8; M12). Owner: DEN agent. Used by the den, the podium
// and Everyone's moment. Sends through mobV3ActionsProvider.sticker (spaced 3 s apart).
// STUB from the foundation commit: the owning agent replaces the body, keeping this signature.

import 'package:flutter/material.dart';

import '../data/mob_v3_models.dart';

class StickerRow extends StatelessWidget {
  const StickerRow({super.key, this.kinds = StickerKind.results, this.gameId, this.label});

  final List<StickerKind> kinds;
  final String? gameId;

  /// A caption above the row ("Send your Mob a sticker"), or none.
  final String? label;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
