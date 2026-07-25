-- =====================================================================
-- ⚠️ CORREÇÃO DE CARTÃO MEEP (evento de estoque / abastecimento)
-- Dois cartões estavam cadastrados como "choperia". O cartão B5abb8897 na
-- verdade é da CHURRASCARIA (não da choperia). Para evitar erro, o gestor
-- trocou o cartão da churrascaria para "ab253e8e" — este passa a ser o
-- cartão oficial da churrascaria a partir de 25/07.
-- Aditivo/não destrutivo: só ajusta bars.cartao_meep.
-- =====================================================================

-- Churrascaria passa a ter o cartão novo e correto.
UPDATE public.bars
   SET cartao_meep = 'ab253e8e'
 WHERE translate(lower(btrim(name)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
       IN ('churrascaria liberdade','churrascaria');

-- Remove o cartão antigo mal atribuído (era churrascaria, estava como choperia).
UPDATE public.bars
   SET cartao_meep = NULL
 WHERE lower(btrim(cartao_meep)) = lower('B5abb8897');
