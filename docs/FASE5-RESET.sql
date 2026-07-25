-- =====================================================================
-- ⚠️⚠️ FASE 5 — RESET DE ESTOQUE E CONTAGEM  ⚠️⚠️
--
-- ESTE ARQUIVO NÃO É UMA MIGRATION. Ele está em docs/ DE PROPÓSITO, para
-- NÃO rodar sozinho junto com as demais. Rode manualmente, colando no SQL
-- Editor do Supabase, e SOMENTE depois de cumprir o checklist abaixo.
--
-- O gestor autorizou (2026-07-24): "pode realizar o backup depois e só
-- depois siga com a fase 5". A ordem importa.
--
-- ---------------------------------------------------------------------
-- CHECKLIST OBRIGATÓRIO ANTES DE RODAR
-- ---------------------------------------------------------------------
--   [ ] 1. Backup feito na tela BACKUPS do app.
--   [ ] 2. Backup BAIXADO e ABERTO para conferir que não está vazio.
--          (backup que ninguém abriu não é backup)
--   [ ] 3. TODAS as migrations de docs/APLICACAO.md já aplicadas — senão o
--          reset recria os mesmos problemas.
--   [ ] 4. Confirme que o backup incluiu `notas_fiscais`,
--          `controle_comodato_global` e as tabelas de vasilhames. Até
--          2026-07-24 a lista de backup NÃO as continha: se o seu backup for
--          anterior à correção em `src/routes/api/public/backup.daily.ts`,
--          ele NÃO protege o que este script apaga. Gere um novo.
--   [ ] 4. Ninguém operando o app neste momento.
--
-- ---------------------------------------------------------------------
-- O QUE ESTE SCRIPT FAZ
-- ---------------------------------------------------------------------
--   ZERA (contagem de barris):
--     • warehouse_stock            → saldo dos armazéns a zero
--     • inventories/inventory_items→ contagens antigas
--     • refills/refill_items       → reposições
--     • empties_removed            → vazios recolhidos
--     • warehouse_movements        → fluxo de estoque
--     • movimentacoes_barris       → auditoria espelho
--     • controle_comodato_global   → acumulados do comodato a zero
--     • heineken_cargas            → cargas
--     • notas_fiscais              → notas
--     • bar_transfers/_items       → transferências entre bares
--
--   PRESERVA (configuração — nada disto é tocado):
--     • bars (nomes, tipo, coordenadas, rota, cartão MEEP)
--     • bar_stock_standard (os PADRÕES por bar)
--     • rotas
--     • user_roles, profiles (usuários e permissões)
--     • bar_machines, bar_installations, bar_card_readers, qr_tokens
--     • bar_temperature_checks, bar_organization_checks (histórico de
--       qualidade — não é contagem de barril)
--     • meep_consumo_bar / meep_vendas_bar (histórico importado da MEEP)
--
-- ⚠️ Se quiser que algo desta segunda lista TAMBÉM seja zerado, descomente
--    explicitamente na seção OPCIONAIS no fim do arquivo. Por padrão, não.
--
-- Tudo roda dentro de UMA transação: ou vai tudo, ou não vai nada.
-- =====================================================================

BEGIN;

-- Trava de segurança: descomente a linha abaixo para liberar a execução.
-- Enquanto ela estiver comentada, o script aborta sem alterar nada.
-- Isso evita rodar o arquivo por engano ao abrir e apertar "Run".
DO $$
BEGIN
  IF current_setting('dispel.reset_autorizado', true) IS DISTINCT FROM 'sim' THEN
    RAISE EXCEPTION
      'RESET NÃO AUTORIZADO. Rode antes:  SET LOCAL dispel.reset_autorizado = ''sim'';  na MESMA execução, após conferir o backup.';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1) Fluxo de estoque e contagens
-- ---------------------------------------------------------------------
DELETE FROM public.bar_transfer_items;
DELETE FROM public.bar_transfers;

DELETE FROM public.refill_items;
DELETE FROM public.refills;

DELETE FROM public.empties_removed;

DELETE FROM public.inventory_items;
DELETE FROM public.inventories;

DELETE FROM public.movimentacoes_barris;
DELETE FROM public.warehouse_movements;

DELETE FROM public.notas_fiscais;
DELETE FROM public.heineken_cargas;

-- Fluxo do barril vazio (tabelas criadas em 20260724190000 e 210000).
-- ⚠️ SEM ISTO o reset deixa saldo órfão: `empties_removed` é apagada acima,
-- mas o vasilhame que veio dela continuaria no estoque, e o balanço nunca
-- mais fecharia.
DELETE FROM public.empty_movements;

-- ---------------------------------------------------------------------
-- 2) Saldos a zero (mantendo as linhas, para o app não quebrar)
-- ---------------------------------------------------------------------
UPDATE public.warehouse_stock
   SET barrels = 0,
       updated_at = now();

UPDATE public.controle_comodato_global
   SET vazios_disponiveis = 0,
       cheios_recebidos_acumulados = 0,
       vazios_devolvidos_acumulados = 0,
       updated_at = now();

-- Vasilhames e vazios por armazém a zero (mantendo as linhas)
UPDATE public.warehouse_vasilhames  SET barrels = 0, updated_at = now();
UPDATE public.warehouse_empty_stock SET barrels = 0, updated_at = now();

-- Declaração da Allstar: o que estava nos pontos dela também zera
DELETE FROM public.allstar_pontos_declaracao;

-- ---------------------------------------------------------------------
-- 3) Conferência antes de confirmar
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_bars    int;
  v_padroes int;
  v_rotas   int;
  v_stock   int;
BEGIN
  SELECT count(*) INTO v_bars    FROM public.bars;
  SELECT count(*) INTO v_padroes FROM public.bar_stock_standard;
  SELECT count(*) INTO v_rotas   FROM public.rotas;
  SELECT COALESCE(sum(barrels),0) INTO v_stock FROM public.warehouse_stock;

  RAISE NOTICE '--- PÓS-RESET ---';
  RAISE NOTICE 'bares preservados ............ %', v_bars;
  RAISE NOTICE 'padrões preservados .......... %', v_padroes;
  RAISE NOTICE 'rotas preservadas ............ %', v_rotas;
  RAISE NOTICE 'saldo total em estoque ....... % (deve ser 0)', v_stock;

  IF v_bars = 0 OR v_padroes = 0 THEN
    RAISE EXCEPTION 'ABORTADO: a configuração sumiu (bares=% padrões=%). Nada foi salvo.',
      v_bars, v_padroes;
  END IF;
  IF v_stock <> 0 THEN
    RAISE EXCEPTION 'ABORTADO: estoque não zerou (%). Nada foi salvo.', v_stock;
  END IF;

  -- vasilhames também precisam ter zerado, senão o balanço nasce quebrado
  DECLARE v_vas int; BEGIN
    SELECT COALESCE(sum(barrels),0) INTO v_vas FROM public.warehouse_vasilhames;
    RAISE NOTICE 'vasilhames em estoque ........ % (deve ser 0)', v_vas;
    IF v_vas <> 0 THEN
      RAISE EXCEPTION 'ABORTADO: vasilhames não zeraram (%). Nada foi salvo.', v_vas;
    END IF;
  END;
END $$;

COMMIT;

-- =====================================================================
-- COMO RODAR (cole tudo de uma vez no SQL Editor):
--
--   SET LOCAL dispel.reset_autorizado = 'sim';
--   <e então todo o bloco BEGIN...COMMIT acima>
--
-- DEPOIS DO RESET:
--   1. Lance as entradas de estoque reais (Central → Entradas ou NF).
--      Confira que o saldo do DISPEL SOBE — se não subir, a migration
--      20260724150000 não foi aplicada.
--   2. Faça o primeiro inventário de cada bar.
--   3. Confira na tela inicial que "Carregar agora" faz sentido.
-- =====================================================================

-- ---------------------------------------------------------------------
-- OPCIONAIS — descomente SÓ se o gestor pedir explicitamente
-- ---------------------------------------------------------------------
-- Apagar o histórico importado da MEEP (consumo e abastecimento):
--   DELETE FROM public.meep_consumo_bar;
--   DELETE FROM public.meep_vendas_bar;
--
-- Apagar histórico de qualidade (temperatura e organização):
--   DELETE FROM public.bar_temperature_checks;
--   DELETE FROM public.bar_organization_checks;
