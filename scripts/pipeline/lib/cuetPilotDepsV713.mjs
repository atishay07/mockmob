import { authorOriginal, repairFactoryCandidate } from './factoryCore.mjs';
import { normalizeOptionLabels, tolerantQuoteIntegrity } from './authorIntegrityV7.mjs';
import { normalizeStatementSelectionOptions, guardRepairRoute } from './candidateFormatVNext.mjs';
import { composeAuthorTransport } from './cuetPilotV75Deps.mjs';
import { authorOriginalV713 } from './originalAuthorPolicyV713.mjs';
import { validateFactoryCandidateV713 } from './verifyV713.mjs';
export function buildPilotDepsV713({ registry, ledger, transport }) {
  return {
    prepare(candidate) {
      const statement = normalizeStatementSelectionOptions(candidate), labels = normalizeOptionLabels(statement.candidate);
      return { candidate: labels.candidate, notes: [statement.changed && 'statement_display_normalized', labels.changed && 'label_normalized'].filter(Boolean),
        quote: tolerantQuoteIntegrity(labels.candidate, registry) };
    },
    author: job => authorOriginalV713(authorOriginal, job, { registry, transport: composeAuthorTransport(transport, job) }),
    validate: (candidate, job) => {
      if (job && candidate.difficulty !== job.difficulty) return { state: 'quarantined',
        reasons: ['failed:difficulty_target', 'registered_difficulty_mismatch'],
        failure_details: [`Registered demand is ${job.difficulty}; authored label ${candidate.difficulty} cannot replace it. Rewrite to the registered demand, preserving truth and scope.`] };
      return validateFactoryCandidateV713(candidate, { registry, ledger, transport, seen: new Set() });
    },
    async repair(candidate, reasons) {
      const result = await repairFactoryCandidate(candidate, reasons, { registry, ledger, transport });
      const repaired = normalizeOptionLabels(normalizeStatementSelectionOptions(result).candidate).candidate;
      const gate = guardRepairRoute(candidate, repaired, { passageGroupId: candidate.passage_group_id });
      if (!gate.allowed) throw Error(gate.reason);
      return repaired;
    },
  };
}
