-- Owner, 5 October 2026: Mistake Repair runs on GPT-6 Luna (low effort; high for the blind second opinion).
-- Official standard price, read 5 October 2026 from https://developers.openai.com/api/docs/pricing.
-- Config row only; no student data. Re-verify within 90 days or the budget guard refuses the model.
insert into public.runtime_ai_prices(provider,model,input_per_million,output_per_million,source_url,verified_at) values
 ('openai','gpt-6-luna',0.10,0.50,'https://developers.openai.com/api/docs/pricing',now())
on conflict(provider,model) do update set input_per_million=excluded.input_per_million,output_per_million=excluded.output_per_million,
 source_url=excluded.source_url,verified_at=excluded.verified_at;
