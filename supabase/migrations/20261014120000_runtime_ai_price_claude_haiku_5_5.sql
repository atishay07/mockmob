-- Owner decision D2, 14 October 2026: when GPT-6 Luna fails (quota or rate limit, timeout, 5xx, rejected parameter),
-- Mistake Repair retries once on Anthropic claude-haiku-5-5. The owner chose Haiku 5.5 over 4.5 because it costs less.
--
-- NOT APPLIED. Save, review and apply on staging first, then production (docs/brain/LEARNING-DEPLOYMENT.md).
-- Until this row exists the runtime budget guard refuses the model ("verified model price required"), so the
-- fallback simply does not run and a Luna failure ends as a released credit, never as a charge.
--
-- Price: input USD 0.10 and output USD 0.50 per million tokens, for prompts up to 100K tokens (above that Anthropic
-- lists USD 0.50 / 2.50; a repair prompt is a few thousand tokens). Source: Anthropic pricing page, owner instruction
-- of 14 October 2026, and the claude-api model table cached 6 October 2026. Config row only; no student data.
-- Re-verify within 90 days or the budget guard refuses the model.
-- Rollback: delete from public.runtime_ai_prices where provider='anthropic' and model='claude-haiku-5-5';
insert into public.runtime_ai_prices(provider,model,input_per_million,output_per_million,source_url,verified_at) values
 ('anthropic','claude-haiku-5-5',0.10,0.50,'https://platform.claude.com/docs/en/about-claude/pricing',now())
on conflict(provider,model) do update set input_per_million=excluded.input_per_million,output_per_million=excluded.output_per_million,
 source_url=excluded.source_url,verified_at=excluded.verified_at;
