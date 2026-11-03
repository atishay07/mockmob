// Production wiring for the pilot engine: v7.5 authoring policy, v7.5 validation (dual_blind) and the single targeted repair.
// Every call receives the guarded transport; nothing here reaches a provider on its own.
import {authorOriginal,repairFactoryCandidate} from './factoryCore.mjs';
import {constrainedAuthoring} from './constrainedAuthoring.mjs';
import {authoringAddendumV7,tolerantQuoteIntegrity,normalizeOptionLabels} from './authorIntegrityV7.mjs';
import {normalizeStatementSelectionOptions,guardRepairRoute} from './candidateFormatVNext.mjs';
import {authorFormatC} from '../../../artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline/lib/authorFormatC.mjs';
import {authorOriginalV75} from './originalAuthorPolicyV75.mjs';
import {validateFactoryCandidateV75} from './verifyV75.mjs';
import {TOPOLOGIES} from './factoryEvidenceV75.mjs';

export function composeAuthorTransport(transport,job){
  return authorFormatC(constrainedAuthoring(authoringAddendumV7(transport,job),job),job);
}

export function buildPilotDeps({registry,ledger,transport,topology=TOPOLOGIES.dual_blind}){
  if(topology.id!=='dual_blind')throw Error('pilot_topology_must_be_dual_blind');
  return {
    // Cosmetic label normalization and exact-quote integrity are free and run before any paid validation.
    prepare(candidate){
      const notes=[],statement=normalizeStatementSelectionOptions(candidate);
      if(statement.changed)notes.push('statement_display_normalized');
      const labels=normalizeOptionLabels(statement.candidate);if(labels.changed)notes.push('label_normalized');
      return {candidate:labels.candidate,notes,quote:tolerantQuoteIntegrity(labels.candidate,registry)};
    },
    author:job=>authorOriginalV75(authorOriginal,job,{registry,transport:composeAuthorTransport(transport,job)}),
    validate:candidate=>validateFactoryCandidateV75(candidate,{registry,ledger,transport,topology,seen:new Set()}),
    async repair(candidate,reasons){
      const repaired=await repairFactoryCandidate(candidate,reasons,{registry,ledger,transport});
      const proposed=normalizeOptionLabels(normalizeStatementSelectionOptions(repaired).candidate).candidate;
      const gate=guardRepairRoute(candidate,proposed,{passageGroupId:candidate.passage_group_id});
      if(!gate.allowed)throw Error(gate.reason);
      return proposed;
    },
  };
}
