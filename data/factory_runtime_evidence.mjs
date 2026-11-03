import {v73RuntimeEvidenceCurrent} from './v73_runtime_evidence.mjs';
import {runtimeBindingV74} from './v74_runtime_contract.mjs';
import {currentCuetCalibrationReadyVNext} from '../scripts/pipeline/lib/currentCuetCalibrationGateVNext.mjs';
import {runtimeBindingV713} from './v713_runtime_contract.mjs';

export function factoryRuntimeEvidenceCurrent(record,{manifest,registry,readBindingV74=runtimeBindingV74,readBindingV713=runtimeBindingV713}={}) {
 if(record?.verifier_version==='cuet-fit-validator-v7.13-compact-demand') {
  const binding=readBindingV713();
  return Boolean(record.validation_contract_hash===binding.validation_contract_hash&&
   currentCuetCalibrationReadyVNext({manifest,registry,binding}));
 }
 if(record?.verifier_version!=='cuet-fit-validator-v7.4')return v73RuntimeEvidenceCurrent(record,{manifest,registry});
 const binding=readBindingV74();
 return Boolean(record.validation_contract_hash===binding.validation_contract_hash&&
  currentCuetCalibrationReadyVNext({manifest,registry,binding}));
}
