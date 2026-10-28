// A reservation belongs to exactly its saved candidate or calibration fixture.
// Concurrent later cohorts must not be charged again to an earlier campaign.
export function campaignReceipts(rows,metadata,{candidateIds,calibrationIds}){
 return rows.filter(row=>{const saved=metadata.get(row.id)||{},receipt=row.receipt||{};
  const purpose=receipt.purpose||saved.purpose,id=receipt.candidate_id||saved.candidate_id;
  return purpose==='candidate'&&candidateIds.has(id)||purpose==='calibration'&&calibrationIds.has(id);
 });
}
