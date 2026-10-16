// Goldens for the Credits page at 384 by 853 logical px (taller where the page is long), DPR 2,
// Night and Day: the shared contract fixture, a Pro plan, the first spend still to come, and
// balances that did not load. The data is the contract fixture `contract_credits_v1.json`.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/credits/credits_screen.dart';
import 'package:mockmob/features/credits/data/credits_models.dart';

import '../../unit/you/you_test_support.dart';
import '../you/you_golden_kit.dart';

Map<String, dynamic> _fixture() =>
    jsonDecode(File('test/fixtures/credits/contract_credits_v1.json').readAsStringSync()) as Map<String, dynamic>;

RemoteState<CreditsOverview> _state(Map<String, dynamic> body) =>
    RemoteState(value: CreditsOverview.fromJson(body), fetchedAt: DateTime(2026, 10, 14, 19));

void main() {
  setUpGoldenFonts();
  final now = DateTime(2026, 10, 14, 20);

  sheetGolden(
    'credits',
    () => const CreditsScreen(),
    size: const Size(384, 1250),
    overrides: () => youOverrides(now: now, credits: _state(_fixture())),
  );

  // More pages behind it: the Show earlier key.
  sheetGolden(
    'credits_more',
    () => const CreditsScreen(),
    size: const Size(384, 1250),
    overrides: () => youOverrides(now: now, credits: _state(_fixture()..['nextCursor'] = 'c1')),
  );

  sheetGolden(
    'credits_pro',
    () => const CreditsScreen(),
    size: const Size(384, 1250),
    overrides: () => youOverrides(now: now, credits: _state(_fixture()..['plan'] = {'name': 'Pro', 'until': '2027-01-12'})),
  );

  sheetGolden(
    'credits_new',
    () => const CreditsScreen(),
    overrides: () => youOverrides(now: now, credits: _state(_fixture()..['history'] = <Object?>[])),
  );

  sheetGolden(
    'credits_failed',
    () => const CreditsScreen(),
    overrides: () => youOverrides(
      now: now,
      credits: const RemoteState<CreditsOverview>(error: ApiError(kind: ApiErrorKind.network, code: 'network')),
    ),
  );
}
