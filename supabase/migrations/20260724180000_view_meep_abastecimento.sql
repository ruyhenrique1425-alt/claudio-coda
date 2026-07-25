-- =====================================================================
-- NOME ENGANOSO: meep_vendas_bar guarda ABASTECIMENTO, não venda
--
-- Achado da auditoria (docs/AUDITORIA-DADOS.md). A tabela registra os
-- barris ENTREGUES a cada bar pelo evento de ESTOQUE da MEEP. O consumo
-- de venda real mora em `meep_consumo_bar`. Quem consulta o banco direto
-- lê "vendas" e soma a coisa errada.
--
-- SOLUÇÃO NÃO DESTRUTIVA: cria a view `meep_abastecimento_bar` com o nome
-- correto. A tabela original continua existindo e funcionando, então
-- nenhum código quebra. A view é atualizável (é um SELECT simples de uma
-- tabela só), então serve para leitura e escrita.
--
-- Migração futura sugerida (fora do evento, sem pressa): apontar o app
-- para a view, e só então renomear a tabela.
-- =====================================================================

CREATE OR REPLACE VIEW public.meep_abastecimento_bar AS
  SELECT
    id,
    bar_id,
    cartao,
    data,
    categoria,
    produto,
    quantidade,   -- barris ENTREGUES ao bar (não vendidos ao consumidor)
    valor,
    is_chopp,
    created_at
  FROM public.meep_vendas_bar;

COMMENT ON VIEW public.meep_abastecimento_bar IS
  'Barris de chopp ENTREGUES a cada bar (evento de ESTOQUE da MEEP). '
  'Nome correto para a tabela meep_vendas_bar, cujo nome sugere venda mas '
  'guarda abastecimento. Consumo real de venda: meep_consumo_bar.';

COMMENT ON TABLE public.meep_vendas_bar IS
  'ABASTECIMENTO por bar (barris entregues) — apesar do nome. Mantida por '
  'compatibilidade; prefira a view meep_abastecimento_bar.';

COMMENT ON TABLE public.meep_consumo_bar IS
  'CONSUMO real de venda por bar/dia/marca, do evento de vendas da MEEP.';

GRANT SELECT, INSERT, UPDATE ON public.meep_abastecimento_bar TO authenticated;
GRANT ALL ON public.meep_abastecimento_bar TO service_role;
