-- Undo for the wave-3 authored question publish (source claude-authored-2026-10-17-w3), 17 Oct 2026.
-- NOT a migration: it lives outside supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Run it only on the project the publish was applied to, and only if the owner decides the rows must go.
--
-- What the publish inserted (scripts/question-publish-authored.mjs --mode=apply, plan docs/brain/reports/authored-w3/plans/wave3-publish-plan-production-2026-10-17.json):
--   153 rows in public.questions, source = 'claude-authored-2026-10-17-w3', status live / verified / active
--   (gat 56, chemistry 48, physics 49). No passage_groups rows (wave 3 publishes no passage sets; Hindi is out).
--   Nothing else in the database is touched by the publish except the nta_question_index rows of gat, chemistry and physics (rebuilt right after the insert).
--
-- The preferred undo is the tool itself, which writes a restore file before the first insert and only touches rows that are still from this source:
--   node --use-system-ca scripts/question-publish-authored.mjs --mode=restore --restore=docs/brain/reports/authored-publish/authored-publish-restore-<stamp>.json --expect-project=isrxrxzjocewrdureyhp
--   (add --hard-delete to delete instead of hide; hard delete skips a row someone edited after the publish)
-- This file does the same thing by hand, for the SQL editor. Both guards are in every statement: the source tag AND the id list.

-- 0. Preflight: expect 153.
select subject, count(*) as rows_from_wave3
from public.questions
where source = 'claude-authored-2026-10-17-w3'
group by subject
order by subject;

-- 1. HIDE (reversible; the same withheld state as scripts/question-hold.mjs, plus is_deleted). Students stop seeing the rows at once.
update public.questions
set status = 'pending', verification_state = 'disputed', exploration_state = 'pending_review', is_deleted = true, updated_at = now()
where source = 'claude-authored-2026-10-17-w3'
  and id in (
    '06fb3fe8-7f7f-463d-a602-1a5953423084'
  , '0731d7d3-671e-4714-8b36-65d0a388117c'
  , '0a5e8c3d-6f14-4b72-8d9a-e3b7c1f06a48'
  , '0ac2e9bd-113f-4e47-bbb4-becf5cfbd80d'
  , '0e2ae512-b283-4e41-80ef-31ef6ac18fd1'
  , '0f01b716-922a-4b3f-9b32-ed8ab40dc7e8'
  , '0f2b8121-9083-4961-a25f-ac0878f9a15a'
  , '118b1495-3889-49b3-8002-f805c6ca1e57'
  , '12f5a5e7-81db-4ac3-97f7-3132d0850f9d'
  , '12fbdaab-5d8a-4b16-978b-55747e7b0529'
  , '13acff28-0d34-4e66-9f98-c2db0415b060'
  , '14640fcc-4496-4528-84bb-930a5d17bbae'
  , '15079cee-dbc7-4b31-9fc5-782e04f607ec'
  , '19c49938-f37a-419f-975a-03e609b82cdc'
  , '1c8f4b7d-2e90-4a5f-b1c6-7d3e9a0f2b84'
  , '1d013847-e124-44e4-b400-a5a55ad558cb'
  , '1de140e3-81b2-467b-af74-6705474ba41f'
  , '1f660152-f757-4ce1-8e8b-08e78037c1ef'
  , '22940911-16a7-4f7e-be0f-515fa516f89f'
  , '22bb7974-074f-4e40-a1b4-5d3b55052192'
  , '255e305e-85cc-4d30-a824-239c53989517'
  , '27a22460-7b41-4d9e-bfa1-d1423c8ddeb4'
  , '27e0b6f4-9a1c-4e3d-8f72-6b4d0a9c1e58'
  , '29d9c92f-3fce-40f7-b1ea-c4c56f07ab15'
  , '2b8ad4d9-5b84-4089-ba12-bb46cb8fe0d9'
  , '2be3fcb0-30ce-427f-ae83-14e5d868f7d0'
  , '2c39441e-d740-4186-869a-98f8013dca61'
  , '2f6e9c85-b1d4-4a37-8f0e-d5a2c7b1e963'
  , '3031f426-b0a1-41c2-95d3-bd80f195ae2f'
  , '307b8146-2141-49c9-abb2-cdc2e2c42bb9'
  , '310ed34a-d49c-40d1-8e25-31332657a600'
  , '3238f380-53b1-4775-b76b-5576a417e983'
  , '340a6c47-3d6f-42c8-a1a5-af3a9bb0830f'
  , '352e7338-650c-45f2-a195-74266a9fa337'
  , '3840357a-d19c-49f6-aa10-173701a99c42'
  , '39a9f1f5-675b-4aa4-961e-56b0b6be1145'
  , '3a02b025-c5f6-4fce-b1ea-065b95c32dbd'
  , '3d3a5b97-0249-4275-9f58-5fd7ab90a3d3'
  , '3e145f1e-c334-4a36-9480-c00b019ed495'
  , '3f9a2c17-8b4e-4d61-9a2f-5c7e1b0d4a63'
  , '405b35f7-e06b-4e4f-a3c7-fd61928658d4'
  , '4650a47a-f12a-4916-975a-1e2bbd999de5'
  , '48b434ae-1e86-41b4-aae0-aae582c8a520'
  , '48c754fd-ca11-4ac5-befa-c26c2d651416'
  , '4ac72883-303e-4876-81ab-9e68dadf5eee'
  , '4b294509-bfcb-4828-a8cd-d2513aa29da3'
  , '4b97458d-a381-4f1a-a2b7-fcceb8a3cd94'
  , '4c4837c1-e4d1-4788-af4a-ba9ddac78419'
  , '4d609f5a-fe44-4fbc-b574-688115b283c0'
  , '4e2730f5-b6b5-4784-8ad4-fb9b909398de'
  , '4e338fa8-83d5-427e-83be-2c4b18735148'
  , '4e6a1b9c-8f2d-4c03-9e7b-a5d1f3c8e620'
  , '50a574d4-8098-483b-bac5-a7d1b5bd6741'
  , '5202c447-997b-416b-9bee-314fa03afe31'
  , '52a1adba-4ac2-48f0-9803-5f519207dc97'
  , '53f31015-3913-4213-a0b1-fad4126639d6'
  , '58e99246-9e9e-45b8-a31c-31662eb1f502'
  , '58f0d4c2-a9e6-4b17-8c3f-1e5a7d2b9c40'
  , '59a100d2-d92b-48ae-8b1c-773b76b35021'
  , '5c5ecfa2-89c2-4360-ae66-4d20bc0a5239'
  , '5d4111c6-388a-4181-9870-48f2433614c7'
  , '60786e7a-49b8-49ee-91fc-afd1448ed480'
  , '62c2ce5f-251f-4b6b-a2c2-be45de07dfc3'
  , '63dbe2f6-beff-4336-a8e9-435a3e28fe04'
  , '645bed97-917e-45b9-a975-d2fa08619ddd'
  , '68e3c2d7-242d-4736-b989-93d19ef92835'
  , '6a4e7b4f-47b5-425d-8887-7778fc06e6ee'
  , '6bbde2ac-85d2-4b61-a2e7-25ad64d121d3'
  , '6c9e8e40-c2e3-4240-946d-3e669d70a831'
  , '6d3c9a1f-7e28-4b06-a1d5-9f4c0e8b2a73'
  , '6e38970a-7eca-45b6-80f6-ebf5c9125a91'
  , '70fa0d92-2494-40f8-83af-cb4649685922'
  , '7156b397-65f5-4272-aad7-2444451f0d72'
  , '72c5b422-6100-4243-87c5-e6da84a6f8c7'
  , '75299146-fa6b-4a36-a45e-8d012723a4ec'
  , '76a4ec3a-0bfe-43ae-8afb-855d89439611'
  , '78eb3759-1464-4e8b-bc15-a4c44426e185'
  , '7edd9bb1-56a1-431d-b322-59c335b4c8a0'
  , '7fc9c9ea-2cc0-43af-91bf-099821f07bff'
  , '80ca588c-3c3a-415f-ab76-b6b5a5cd4ec8'
  , '8172d9b4-c41c-413a-a5c2-70ea7df2adf0'
  , '839dd482-8e96-4b1e-8db6-c26e551ba4bb'
  , '89809a17-0fba-4ab6-8195-07e43d6a51f8'
  , '89b11133-4e7e-4f99-8cb2-d2d84288ccc6'
  , '8b780340-7494-4816-b7a4-370acc255ad6'
  , '8d00f227-84a2-4ed5-8e30-a13421089559'
  , '8e7f15cc-e80f-455f-81f0-fbbd13ee56b3'
  , '8ead33c1-64fa-464c-a683-af9dafe41340'
  , '8ed9bbe9-5c6f-4785-84d1-6d8d6625e7c6'
  , '90eccf23-4148-4c31-b430-b3d4ab676ad3'
  , '91ad1938-d1fc-4ea4-a0d3-95d96326e2ef'
  , '95b3813f-8e6c-46a2-9d87-159dae9088db'
  , '97fb26ff-9b4f-4e06-9282-e26477186a35'
  , '9891beba-0610-4b37-9d91-7185798e2470'
  , '9bc6d44a-b09b-4b8c-8e22-919b7fe6928b'
  , '9bf44c6e-60a3-4d29-90b1-afcdbf800ab4'
  , '9c407b8f-146d-407d-8f8c-7d09d4ce18c9'
  , '9ef7bafe-2ca1-4e14-a12a-08890c27374c'
  , 'a405bec0-826f-44c5-9f84-2e908a39344b'
  , 'a4538d76-6c2a-4f95-82b7-eb792559e888'
  , 'a81ff47e-8241-4c92-9afe-2ac6106b901f'
  , 'a8352fba-9650-44d2-b07b-c049b1d5a9f1'
  , 'ab6c6117-e474-4b8c-907a-59951e5ceb37'
  , 'abb95356-5484-457f-87c3-9668cd683b07'
  , 'ac790a10-fd25-4723-8101-0ef4ac18fde3'
  , 'ad4b7e13-2c60-4f9a-9e85-6c1b3f0d8a72'
  , 'aea26296-5917-40a2-9a7c-d9cf913a5363'
  , 'aed34b71-fcf1-4bb3-bd90-b76d3b0ce52a'
  , 'b4b8360e-d316-4b1a-b9b1-183816cbecc8'
  , 'b62f8e0d-7c4a-4e95-a3d1-9e5b2f6c0d81'
  , 'b99f8b77-0523-4011-8194-f9f00c0c1ecb'
  , 'bbb5fa0d-3c8b-4595-81bd-15d88f61ff99'
  , 'bd7ed369-d22b-4366-a731-45bd7dce9242'
  , 'c1e4cf45-80e1-46e1-93d0-c86e37752d8b'
  , 'c2041ae3-9c59-4149-bdbc-3b863ca761f5'
  , 'c37ac200-ac31-42a5-b383-c0a8150a1771'
  , 'c397d567-7836-4f84-a2ff-2e3913967ac9'
  , 'c3f08d6a-1e4b-4927-b5a8-0f9e2d7c6a31'
  , 'c53fecad-2f57-4258-be11-13c1ba1da7bb'
  , 'c59ca92c-e396-4036-822d-1ef3fecdeda2'
  , 'c62678e0-eb15-4186-811e-45a6452e528e'
  , 'c6f4c6ab-0a24-49a8-ba45-23a3104b8826'
  , 'c7164d89-271f-4f8d-8340-124aa636b7a2'
  , 'c8b13a7f-4e92-4d10-a6c5-0f8e2b9d7a14'
  , 'cc5ce6c8-e0fe-4cc4-afbd-1c9d4b8ee681'
  , 'cc704589-53b7-4f63-8da8-e2a3d2d05712'
  , 'd06e022d-f926-4494-9d39-1a979e20b2e5'
  , 'd1014b9a-bb78-438f-ae1c-c711299f60ca'
  , 'd4c71a9e-3f25-4b8d-a6e0-1e8b5c2f9d47'
  , 'd72339f5-bbbc-48ea-9e57-12b89e48e029'
  , 'd862ff6c-f6be-4dfd-8dc3-ff22bb40da51'
  , 'd8db492b-6214-4323-88f7-e2a41b266896'
  , 'd9f17d54-ca5e-4301-88f7-9ea53cbbf264'
  , 'dc8c1ef9-3c6c-4ae0-ba28-3caf30b0c5fe'
  , 'e09818d8-3a95-4c58-bddd-a28479403f5d'
  , 'e0c08075-b58b-4d3f-af73-dd797c293080'
  , 'e0d5a92c-18b7-4f3e-9c64-3a8f1d7e2b05'
  , 'e1479500-60ec-4884-ae31-679f70d3eb8b'
  , 'e4bffc63-34a2-454c-a824-04a67523ea3c'
  , 'e4daafaf-3af8-4cad-a9d2-a1f41b1826ea'
  , 'e8db991e-fd05-4e8d-9157-36a719ad405d'
  , 'e993c092-300c-4155-8a22-2b5228c43b87'
  , 'ec1be2ad-e341-40cf-a70c-d057c972d3d5'
  , 'ef23884f-5078-44c2-9b85-99f1e94374d7'
  , 'f05bce07-08b2-491b-937f-d70bca9926c5'
  , 'f19a4dec-edf5-46f4-ba35-f0f0e4485de9'
  , 'f3677c62-dac9-4fbd-9c40-f3874e49b06c'
  , 'f36e1b45-5688-42fc-9a5a-9b5f39be20a2'
  , 'f526f37e-b6e4-4ffb-afeb-da6369a0a985'
  , 'f6ac091e-cd92-418c-99f8-bf273c9fec50'
  , 'fb045322-08ef-4936-ba8a-3be3190bc89e'
  , 'fc6098bd-ef63-4d76-8a35-0568d11957ae'
  , 'ff1c150d-b69e-4daf-8ea1-753dcc7ca034'
  );
-- expect: UPDATE 153

-- 2. HARD DELETE (irreversible; only after step 1 was checked and the owner wants the rows gone). Uncomment to run.
-- delete from public.questions
-- where source = 'claude-authored-2026-10-17-w3'
--   and id in (select id from public.questions where source = 'claude-authored-2026-10-17-w3' and is_deleted = true);
-- expect: DELETE 153

-- 3. Afterwards: no live row of the source is left (expect 0), and the pool index of the three subjects must be rebuilt
--    (docs/brain/RUNBOOK-NTA-QUESTION-INDEX-2026-10-15.md; until it is, the NTA pool falls back to the full read, so nothing breaks).
select count(*) as still_live
from public.questions
where source = 'claude-authored-2026-10-17-w3' and status = 'live' and is_deleted = false;

-- The score tables in data/nta_agent_scores and data/nta_fit_scores keep their wave-3 entries: an entry for a question that is not in the bank is never read.
