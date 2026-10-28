// Production wiring for a V7.10 pilot: the V7.10 decisive-distractor author layer over the V7.6 original-author policy (learning objective, decisive statuses, misconception
// distractors, honest demand labels) composed over the same C-format author transport, V7.10 dual_blind validation, and the
// single targeted repair with full revalidation. Every call receives the guarded transport; nothing here reaches a provider alone.
// The pilot engine (runPilot in cuetPilotV75Run.mjs) is version-neutral and is reused unchanged.
import { authorOriginal, repairFactoryCandidate } from './factoryCore.mjs';
import { normalizeOptionLabels, tolerantQuoteIntegrity } from './authorIntegrityV7.mjs';
import { normalizeStatementSelectionOptions, guardRepairRoute } from './candidateFormatVNext.mjs';
import { composeAuthorTransport } from './cuetPilotV75Deps.mjs';
import { authorOriginalV79 } from './originalAuthorPolicyV79.mjs';
import { validateFactoryCandidateV710 } from './verifyV710.mjs';
import { TOPOLOGIES } from './factoryEvidenceV710.mjs';

export function buildPilotDepsV710({ registry, ledger, transport, topology = TOPOLOGIES.dual_blind }) {
  if (topology.id !== 'dual_blind') throw Error('pilot_topology_must_be_dual_blind');
  return {
    prepare(candidate) {
      const notes = [], statement = normalizeStatementSelectionOptions(candidate);
      if (statement.changed) notes.push('statement_display_normalized');
      const labels = normalizeOptionLabels(statement.candidate); if (labels.changed) notes.push('label_normalized');
      return { candidate: labels.candidate, notes, quote: tolerantQuoteIntegrity(labels.candidate, registry) };
    },
    author: job => authorOriginalV79(authorOriginal, job, { registry, transport: composeAuthorTransport(transport, job) }),
    validate: candidate => validateFactoryCandidateV710(candidate, { registry, ledger, transport, topology, seen: new Set() }),
    async repair(candidate, reasons) {
      const repaired = await repairFactoryCandidate(candidate, reasons, { registry, ledger, transport });
      const proposed = normalizeOptionLabels(normalizeStatementSelectionOptions(repaired).candidate).candidate;
      const gate = guardRepairRoute(candidate, proposed, { passageGroupId: candidate.passage_group_id });
      if (!gate.allowed) throw Error(gate.reason);
      return proposed;
    },
  };
}
