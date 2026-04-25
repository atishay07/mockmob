-- ============================================================
-- MockMob migration 0018 — units layer for Physics
-- CUET 2026 syllabus (subject code 322)
-- ============================================================
-- CUET structure: 9 units (exact wording from PDF)
--
-- Gap analysis vs existing 15 chapters:
--   MATCH  (13): Electric Charges & Fields, Electrostatic Potential &
--                Capacitance, Current Electricity, Moving Charges &
--                Magnetism, Magnetism & Matter, Electromagnetic Induction,
--                Alternating Current, Electromagnetic Waves,
--                Ray Optics & Optical Instruments, Wave Optics,
--                Dual Nature of Radiation & Matter, Atoms, Nuclei
--   RENAME (1):  "Semiconductor Electronics" → "Electronic Devices"
--                (CUET Unit 9 name)
--   INVALID(1):  "Communication Systems" — removed from CUET 2026
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Insert units
-- ------------------------------------------------------------
insert into public.units (id, subject_id, name, sort_order) values
  ('physics__u1', 'physics', 'Electrostatics',                                 0),
  ('physics__u2', 'physics', 'Current Electricity',                            1),
  ('physics__u3', 'physics', 'Magnetic Effects of Current and Magnetism',      2),
  ('physics__u4', 'physics', 'Electromagnetic Induction and Alternating Currents', 3),
  ('physics__u5', 'physics', 'Electromagnetic Waves',                          4),
  ('physics__u6', 'physics', 'Optics',                                         5),
  ('physics__u7', 'physics', 'Dual Nature of Matter and Radiation',            6),
  ('physics__u8', 'physics', 'Atoms and Nuclei',                               7),
  ('physics__u9', 'physics', 'Electronic Devices',                             8)
on conflict (id) do update
  set name = excluded.name, sort_order = excluded.sort_order;

-- ------------------------------------------------------------
-- 2. Rename: "Semiconductor Electronics" → "Electronic Devices"
-- ------------------------------------------------------------
update public.chapters
  set name = 'Electronic Devices'
where id = 'physics__semiconductor_electronics';

update public.questions
  set chapter = 'Electronic Devices'
where subject = 'physics'
  and chapter = 'Semiconductor Electronics';

-- ------------------------------------------------------------
-- 3. Map chapters to units
-- ------------------------------------------------------------

-- Unit 1 — Electrostatics
update public.chapters set unit_id = 'physics__u1'
where subject_id = 'physics'
  and name in ('Electric Charges & Fields', 'Electrostatic Potential & Capacitance');

-- Unit 2 — Current Electricity
update public.chapters set unit_id = 'physics__u2'
where subject_id = 'physics'
  and name = 'Current Electricity';

-- Unit 3 — Magnetic Effects of Current and Magnetism
update public.chapters set unit_id = 'physics__u3'
where subject_id = 'physics'
  and name in ('Moving Charges & Magnetism', 'Magnetism & Matter');

-- Unit 4 — Electromagnetic Induction and Alternating Currents
update public.chapters set unit_id = 'physics__u4'
where subject_id = 'physics'
  and name in ('Electromagnetic Induction', 'Alternating Current');

-- Unit 5 — Electromagnetic Waves
update public.chapters set unit_id = 'physics__u5'
where subject_id = 'physics'
  and name = 'Electromagnetic Waves';

-- Unit 6 — Optics
update public.chapters set unit_id = 'physics__u6'
where subject_id = 'physics'
  and name in ('Ray Optics & Optical Instruments', 'Wave Optics');

-- Unit 7 — Dual Nature of Matter and Radiation
update public.chapters set unit_id = 'physics__u7'
where subject_id = 'physics'
  and name = 'Dual Nature of Radiation & Matter';

-- Unit 8 — Atoms and Nuclei
update public.chapters set unit_id = 'physics__u8'
where subject_id = 'physics'
  and name in ('Atoms', 'Nuclei');

-- Unit 9 — Electronic Devices
update public.chapters set unit_id = 'physics__u9'
where subject_id = 'physics'
  and name = 'Electronic Devices';

-- "Communication Systems" left without unit_id
-- (not present in CUET 2026 Physics syllabus)

commit;
