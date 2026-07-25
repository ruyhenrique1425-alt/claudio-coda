-- Corrige nome do bar parceiro: "Zelda café" veio de tradução automática do
-- site; o nome real é "Zel café". Não destrutivo.
UPDATE public.bars SET name='Zel café' WHERE lower(btrim(name)) IN ('zelda café','zelda cafe');
