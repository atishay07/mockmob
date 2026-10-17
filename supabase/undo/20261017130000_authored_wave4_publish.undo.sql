-- Undo for the wave-4 authored question publish (source claude-authored-2026-10-17-w4), 17 Oct 2026.
-- NOT a migration: it lives outside supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Run it only on the project the publish was applied to, and only if the owner decides the rows must go.
--
-- What the publish inserts (scripts/question-publish-authored.mjs --mode=apply, plan docs/brain/reports/authored-w4/plans/wave4-publish-plan-production-2026-10-17.json, plan hash 813c724a6554f82a):
--   200 rows in public.questions, source = 'claude-authored-2026-10-17-w4', status live / verified / active
--   (biology 35, chemistry 42, gat 39, mathematics 51, physics 33), and 2 rows in public.passage_groups (the case sets w4-chem-02-set-1 and w4-gat-03-set-1), source = 'claude-authored-2026-10-17-w4'.
--   Nothing else in the database is touched by the publish except the nta_question_index rows of the five subjects (rebuilt right after the insert).
--
-- The preferred undo is the tool itself, which writes a restore file before the first insert and only touches rows that are still from this source:
--   node --use-system-ca scripts/question-publish-authored.mjs --mode=restore --restore=docs/brain/reports/authored-publish/authored-publish-restore-<stamp>.json --expect-project=isrxrxzjocewrdureyhp
--   (add --hard-delete to delete instead of hide; hard delete skips a row someone edited after the publish)
-- This file does the same thing by hand, for the SQL editor. Both guards are in every statement: the source tag AND the id list.

-- 0. Preflight: expect 200 (biology 35, chemistry 42, gat 39, mathematics 51, physics 33) and 2 groups.
select subject, count(*) as rows_from_wave4
from public.questions
where source = 'claude-authored-2026-10-17-w4'
group by subject
order by subject;

select count(*) as groups_from_wave4
from public.passage_groups
where source = 'claude-authored-2026-10-17-w4';

-- 1. HIDE (reversible; the same withheld state as scripts/question-hold.mjs, plus is_deleted; the groups leave discovery as in the tool's restore mode).
--    Students stop seeing the rows at once.
update public.questions
set status = 'pending', verification_state = 'disputed', exploration_state = 'pending_review', is_deleted = true, updated_at = now()
where source = 'claude-authored-2026-10-17-w4'
  and id in (
    '010e16c1-2fa7-45d3-9044-5ab7bbe31d75'
    , '011459c4-767b-4d22-a553-e53947ca2243'
    , '012b12f8-f665-4fac-87c8-1c3bbc85d59e'
    , '0140bbdf-feae-48b9-a3bd-5c6e16f61c30'
    , '0192976d-ce4d-4ed3-9672-8b0d1578ab19'
    , '01d16929-b579-401b-9a88-81ff84f82232'
    , '03468e44-24ac-4016-a28b-cdc361d9e934'
    , '03e23eee-ba91-4f2c-9307-a711a8aaf231'
    , '03f95952-f882-4150-acef-2ef0449a2aca'
    , '045b9853-199e-4a62-9fd7-fc740a9daf0b'
    , '05715cc3-5ce9-4a38-b4c3-18ce7e19913f'
    , '0588bad0-9280-44b9-bc61-2dc16a9f8eb1'
    , '09a87281-edba-4507-85d1-c3e313dd7071'
    , '0a76e5e8-c80c-42fe-8e89-05028b07cada'
    , '0dfb5b38-ed97-4c20-8199-41135c08395b'
    , '0e1790f3-7da1-462b-9088-8fd54ec251fd'
    , '0e4e6d2a-0b5f-45a4-8cdb-27515531620c'
    , '12158eee-8b40-46e8-a7c1-f41854ac32e2'
    , '1413fb21-57bd-4f2a-a970-c87ad9f10e22'
    , '19373bf0-535e-40e8-b7a0-41756d8d2981'
    , '1d3bd0b5-6b6e-4fd0-bd61-290ebfaf79ed'
    , '1e33bc13-6ec6-4b68-99d1-f906be55b319'
    , '1ed56924-fcf9-4015-8327-e71c2be3dbe5'
    , '2174cc38-ef8a-41be-9d52-6db3b89bf9a8'
    , '23a5438b-200a-465f-b39e-aed23d8c2dae'
    , '23fda7f6-04bb-43cf-8611-002db1847e7c'
    , '27227f87-6ced-4f0c-ba60-30484c8328e4'
    , '29021b9a-f0fc-4108-81fb-32e7a8034824'
    , '2c7eb3a9-5d8d-4c73-b5cf-89a0466e0d3f'
    , '2e4f3189-8abb-4e28-8c5b-13da81ddcbed'
    , '2e6341d0-3c9d-4b33-9d5f-44c898973dbe'
    , '300047ea-3dc7-4cf4-bc6f-abcb00cd5b7f'
    , '3434a96f-2ebc-45ae-932b-f5729c83538b'
    , '34a6cabf-0b12-4321-b746-76378dd8d946'
    , '34d1af78-a46f-4ece-af95-77767c117d69'
    , '35246480-bd79-48c2-b3f9-8d6128c2a14e'
    , '38dd3ed0-f042-4470-b5b8-90886167286c'
    , '3920888b-72d1-4cfd-ad56-301ef2e89c5f'
    , '3ad2e2ed-633e-48a0-bb67-00dda43613f7'
    , '3b05fd92-2355-4441-968e-ae9c92367483'
    , '43c048d0-4697-411f-9819-a9a56b1c234c'
    , '4413281e-b267-4c9e-b508-d943bdc632b7'
    , '449e1c7b-0d6d-4ea4-a7c2-85e2aa906779'
    , '46ac000e-cb0b-4df5-8edf-c811757f79cf'
    , '46dec6bb-4af6-40da-8a22-825f75dc52ce'
    , '47a09bf1-99f6-4a0d-bb3d-cd9177a65ba2'
    , '47b26e05-f8b5-44e7-a499-1078b4ff6bdd'
    , '47f1daf6-2e46-4659-80ba-53388a92114f'
    , '48be5953-0f97-438b-930b-ecac7c558cf2'
    , '49cdcfd3-2f1c-4d94-8905-0f9afc4ef316'
    , '4bb38a72-4019-47e5-bdc9-26fe5bcad9a5'
    , '4d5c33d3-dfc1-4b51-9295-fcce20d6674c'
    , '4d8fefa8-332e-4969-a17b-0cf0f8215738'
    , '4e3389a9-e5f6-464e-94da-097ecfa1b56a'
    , '4e623f32-98a2-4674-ae0b-c6fbac945b8c'
    , '4fced3ab-5807-43b8-8025-82d9859180a1'
    , '5069f737-db90-4b0d-83ff-4c19643ca9a1'
    , '5153b673-ed1c-49d8-b75c-9f0d16943838'
    , '52f17738-6e30-4fb6-9a77-21dbf32faded'
    , '5423cc50-4ae2-487d-94b9-6da3cf15a6dd'
    , '57d63f4c-db78-4fe2-9139-842ea2014063'
    , '59c65a4c-9cea-4a76-bbe3-dde064917db4'
    , '5a9bd18f-202f-4dec-a54e-b925fc90cc8a'
    , '5afc1dc3-d029-4d47-ab5c-9c7043cbd7a4'
    , '61165895-71ee-4a42-accb-05ee502b7960'
    , '61688b26-9f1d-4fe8-af95-fcb90ccff688'
    , '62c71845-ce4a-4284-8d4a-7a7e867a549a'
    , '65824eee-c3c0-48cf-a105-ecaefb1188cd'
    , '664b7a77-53bc-4c82-889a-5731832693ac'
    , '66a5caed-b85f-4f55-b455-26ff8f422d8c'
    , '68fa91db-5fc7-494a-848d-e39d802d467d'
    , '692b21ba-8a97-4c40-a18b-7e596ef70759'
    , '6998f236-be20-4857-8d0b-2a448825755c'
    , '6cdff47f-24b5-4a1a-9db2-057d41f22bd0'
    , '6fa18b54-8d1a-48ce-b3cb-8c451d1e3287'
    , '7128b424-83df-4243-b086-2d2e0c327928'
    , '73198264-8b92-4c57-a361-7cfdeef58e51'
    , '73fd584b-e7ae-410e-9954-92afabb63682'
    , '74583f6d-5b1e-4ab4-9c9c-7e816edd8f14'
    , '75bc29fb-5f94-405b-b6a4-9d121f46ff9e'
    , '787ef85b-5eb6-43a2-8f91-d91230268051'
    , '7da4d02e-7b39-468a-8c49-74a862dd16b8'
    , '7ded8cb6-0906-4e49-84fa-82130df4cf14'
    , '80d1f709-f1db-4e6a-86d3-426cef7fa59c'
    , '8199b343-e47e-40e5-acdd-8e458592a4d0'
    , '823433eb-4072-4493-833d-f53ea7ff8cf3'
    , '83d1ddf7-0c21-44f5-9572-f9d1822321bc'
    , '84a951f7-b80d-4981-b476-3e4be990ce39'
    , '8626d182-95fe-44ca-a70a-2a8203b4e55e'
    , '8653f8fb-63aa-4521-9771-c25fd61bb3ac'
    , '89e2254f-528c-499b-99db-452c534573b0'
    , '8ad575c4-7e7d-49e7-8364-51e79dd36658'
    , '8b76423d-f6c6-47ee-8c20-69a4cdf9adab'
    , '8e181c77-95ef-4e7c-8bf5-857cbba9f869'
    , '8eafb85b-a7b8-4a32-b9e1-6b8df01d35a5'
    , '8ee1facc-2274-4141-bba7-1389a5caee34'
    , '914f319b-fe73-4d95-ac69-112442cffdd4'
    , '9284a09e-a75f-4a93-89b2-7e5980be0446'
    , '93acdf0c-24cc-46b2-864e-99207aceac5b'
    , '93f0a684-7f2b-4742-81bd-b68eef0a280e'
    , '9567d87f-af20-4df4-afd1-8656a2b1edcd'
    , '969ec6f8-7e52-48ce-9832-299e478417ce'
    , '973877a8-423b-40dd-847e-6e0491b45a02'
    , '97690044-9d76-4aff-a84b-f9787fd3c100'
    , '978b5a0b-af20-4e18-a7cd-081298cce2a4'
    , '97c20f8d-1a42-4f39-aa50-3303ce3135e7'
    , '9879a378-c4e8-4fc9-adb2-8bf56840dc45'
    , '9a1edcea-056d-4e0a-9d68-a89e8a6061da'
    , '9afe3afa-ab58-487c-8b4a-7b04ef37c60a'
    , '9b3560f6-3b1c-4865-ac59-98027ad40a31'
    , '9cb149e1-92bd-451d-8cd8-f092d0d7e74a'
    , '9d7ba844-d9df-49d4-9bf5-1464df25413a'
    , '9e03f84e-da69-4b2c-b83f-12f0d834e6b9'
    , '9f114e98-a8ab-4a14-a9e6-2ddf5d0a2729'
    , 'a08beb87-d194-457a-81c5-2bf8b78436fe'
    , 'a123ad3b-9488-4b25-b787-98cf51e60a84'
    , 'a1762cac-8859-4104-b5b8-440a33eacf15'
    , 'a2b66f59-7b62-4b7c-9a2b-6e36fc09b9f7'
    , 'a5193f36-d325-4778-a34d-d84c80c9df12'
    , 'a525b67f-b222-4d47-b6dd-3f40ee01659a'
    , 'a5527d87-72c4-45bc-876b-a80050540ae1'
    , 'a58d364f-574c-424c-9ed2-0f6e4fdb5c3e'
    , 'a790d203-801b-4206-abd4-812c7135eb6a'
    , 'a8245687-1132-49a7-8ec4-306abf2aba8b'
    , 'a832f03c-904d-4957-827c-062a393b86d9'
    , 'a84dd64b-cdcf-4aa5-9fce-284f3872474e'
    , 'a901a9e5-50a3-43d6-9540-1e10fbe1e36f'
    , 'a925a1b9-ee41-494d-b328-df3810fbd5a8'
    , 'a9b977b3-1415-4db5-8488-268a83327316'
    , 'a9fcf18d-71e5-4e22-8a28-2668842a5f62'
    , 'aefd3af3-ae37-410a-b5a1-aa5da54926d3'
    , 'b00e6e59-df3f-43dc-80d5-338ccfb71dfa'
    , 'b01a98fe-7046-417d-b53a-52562cf973e6'
    , 'b0914cae-cd5b-4bc1-bd14-d56ad9b7ff6d'
    , 'b0e6bcaf-f295-4a35-b480-e6dd158bc133'
    , 'b1366004-d26e-490a-9191-a5fa84f02537'
    , 'b178248c-b160-48d6-a199-390201b13144'
    , 'b19fa8e5-08f3-47e4-8450-b40bc6631f53'
    , 'b4607a32-bd4a-49c6-8c8f-18241ba6a26d'
    , 'b5078728-0359-48b0-9ec0-947cc05d2988'
    , 'b52d4156-825a-4124-86e1-a4eba1f28fb5'
    , 'b833fc48-2bbc-4a6c-93b6-862a27d26db6'
    , 'b8374232-3875-4669-a6aa-d2a27190437b'
    , 'b8c38f43-06fc-4321-9e75-a99d5f40ac70'
    , 'bc99a237-d954-40cc-a95a-0320cf346f7f'
    , 'bdc87aa5-3aa5-4786-9440-5aa51f0bb35d'
    , 'bf760cfb-3f89-4233-8ec2-7d0588f8a8f1'
    , 'c0d61bdc-7072-4121-a1b0-be91ad4757b6'
    , 'c28582fc-eedd-4ea9-a907-b938f29248ab'
    , 'c448902e-cfe8-4f58-afca-25e26e7a5cc9'
    , 'c459a1d2-65e0-4cd0-b071-3ec287fe0efc'
    , 'c4a7ad38-8758-41ef-9095-d08d22ef8c74'
    , 'c4e0c49c-4d53-4ce3-a21f-e5a5d39da739'
    , 'c6aed432-8bcf-47f4-838d-0fcf91e6b87f'
    , 'c7147e61-c020-4ce4-9ca5-a48265b17d6e'
    , 'c7a6e607-a11b-4015-981a-dd1b3e7188c9'
    , 'c83bfc1b-51a8-4c9c-ba3a-4b1b3b077998'
    , 'c88795fc-93b2-4e55-979a-126712390857'
    , 'c88a4ac5-7a46-41a8-98f4-ee80e8c09247'
    , 'c8af2dc3-ec6e-43a1-b174-88e3969c1037'
    , 'ccbe9308-e3df-46c1-a7ec-6d9c25cf9073'
    , 'cded2e6e-6e9e-45b1-a65b-3575d15e57ea'
    , 'ce3ca84d-bf8b-44e6-a55b-d5c42ba29c2b'
    , 'ceb2f733-638d-4ca9-9e67-7cacc1c1cbf4'
    , 'cf3ce18f-6c8c-4264-8cf8-b8ebc95aee46'
    , 'd01eb790-0cf8-49f7-9eaa-eae3faeea1d5'
    , 'd027bc08-53d8-4205-a32b-58abd2110ed5'
    , 'd1c6ce3a-f7fe-480a-b211-4b242271ae06'
    , 'd5032300-ad44-4c93-a73b-a025bf921683'
    , 'd724586b-c52b-43c1-b3b1-ea045c7d032f'
    , 'd8b5523a-c238-437e-9304-f14c999ef06f'
    , 'd8c5c153-958e-43f3-83f9-1af6b137e1ce'
    , 'd927294f-a4a8-4886-b658-6ae4abbb96cc'
    , 'd97512d6-e8e1-4f10-bf26-da7b7f30b701'
    , 'da5af9e8-7676-41eb-9941-e2ef773bdf65'
    , 'dca1d6ab-a689-4b0d-aa17-43b888be3348'
    , 'dccaf7b2-9f8f-4112-88c7-f7850938c25a'
    , 'dd66dcf5-ca4a-4e15-9722-6292d102a490'
    , 'de6a00a2-8803-4417-a2b5-061d58f92d92'
    , 'df20c45d-ee4a-4663-bf36-621580f47bca'
    , 'df5ce74e-79ae-4a89-adf9-2b39c6e49a1b'
    , 'e3728829-e160-4205-abb4-b411b380a303'
    , 'e6056587-a51f-421d-a7eb-904e696e12af'
    , 'e6aaca54-9f5b-4217-86d5-a72ec3df7ec1'
    , 'e9f682c4-7b40-4470-a4ac-cca20e95419e'
    , 'ea0c3adb-a6ff-4438-a863-7f937512c34b'
    , 'eab7b9e0-c086-4422-8820-f49e7701fe40'
    , 'eb8cf251-1014-400f-bbbd-4c32aeca9482'
    , 'ef0f30c8-bde7-4adc-ab4a-0934d0197b63'
    , 'efce0722-5459-4073-8962-fe465fb5fa07'
    , 'f1fce836-0049-44b7-95a1-a2399fc7c66f'
    , 'f27d1fb8-9357-4012-859e-240380f07967'
    , 'f57d3a91-3ff8-4608-9ccf-8568eed19651'
    , 'f7f57f20-8388-4720-a1c1-f41ca3da3e22'
    , 'f80e1ebf-e7d6-422c-b65c-8f5df6ba0725'
    , 'f9edc91a-cf7d-4bc9-afe7-7fc485d72a76'
    , 'fabdd431-d76a-40f3-b6c3-1718f5b4a141'
    , 'fd963a54-4700-44b6-b8b5-07b491494bf2'
    , 'fe53af95-1c40-4ab0-ac4a-33300a6485f5'
    , 'fe67257f-25f9-46f8-911c-63ce57d6ed0c'
  );
-- expect: UPDATE 200

update public.passage_groups
set status = 'hidden', discoverable = false
where source = 'claude-authored-2026-10-17-w4'
  and id in (
    'pg_b7882a710c1211b3bc786ffe1f79a734'
    , 'pg_eab9d63caa017afe7b12f2dbbf1e8bdb'
  );
-- expect: UPDATE 2

-- 2. HARD DELETE (irreversible; only after step 1 was checked and the owner wants the rows gone). Uncomment to run. Questions first, then the groups no question points at.
-- delete from public.questions
-- where source = 'claude-authored-2026-10-17-w4'
--   and id in (select id from public.questions where source = 'claude-authored-2026-10-17-w4' and is_deleted = true);
-- expect: DELETE 200
-- delete from public.passage_groups
-- where source = 'claude-authored-2026-10-17-w4'
--   and id in (
--     'pg_b7882a710c1211b3bc786ffe1f79a734'
--     , 'pg_eab9d63caa017afe7b12f2dbbf1e8bdb'
--   )
--   and not exists (select 1 from public.questions q where q.passage_group_id = public.passage_groups.id);
-- expect: DELETE 2

-- 3. Afterwards: no live row of the source is left (expect 0), and the pool index of the five subjects (biology, chemistry, gat, mathematics, physics) must be rebuilt
--    (docs/brain/RUNBOOK-NTA-QUESTION-INDEX-2026-10-15.md; until it is, the NTA pool falls back to the full read, so nothing breaks).
select count(*) as still_live
from public.questions
where source = 'claude-authored-2026-10-17-w4' and status = 'live' and is_deleted = false;

-- The score tables in data/nta_agent_scores and data/nta_fit_scores keep their wave-4 entries: an entry for a question that is not in the bank is never read.
