-- =====================================================================
-- FIX: refills.photo_url estava NOT NULL (sem default), o que impedia
-- qualquer importação em lote de abastecimento (Central → Importar →
-- "Abastecimento em lote") de funcionar — reposições feitas no app têm
-- foto, mas as importadas em massa via CSV não têm.
-- 100% ADITIVO e NÃO DESTRUTIVO: apenas relaxa a constraint, não apaga
-- nem altera nenhum dado existente. Reposições feitas pela tela do app
-- continuam exigindo foto no fluxo normal (validação fica no front-end).
-- =====================================================================
ALTER TABLE public.refills ALTER COLUMN photo_url DROP NOT NULL;
