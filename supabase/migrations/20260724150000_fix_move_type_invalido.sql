-- =====================================================================
-- ⚠️ CORREÇÃO CRÍTICA — move_type inválido nas entradas de estoque
--
-- ACHADO (auditoria de linhagem de dados):
--   O enum public.warehouse_move_type aceita SOMENTE:
--     'entrada' | 'transferencia' | 'abastecimento_bar' | 'ajuste'
--   (confirmado na criação em 20260718011558 e no types.ts gerado do banco).
--
--   Mas DUAS funções gravam 'recebimento_heineken', que NÃO existe no enum:
--     1) apply_carga_to_stock  (20260720004829) — registro de carga Heineken
--     2) conciliar_nota_fiscal (20260722015926) — conciliação de NF
--
--   Resultado: as duas quebram com
--     "invalid input value for enum warehouse_move_type".
--   Como TODO barril que entra no DISPEL passa por carga ou por NF, o caminho
--   de ENTRADA de estoque está inoperante — o saldo só diminui (baixa por
--   reposição usa 'abastecimento_bar', que é válido) e nunca aumenta.
--
-- CORREÇÃO: usar 'entrada', que é o valor correto do enum para recebimento.
-- Aditivo e não destrutivo: só troca o literal, mantendo toda a lógica.
-- A origem do movimento continua identificável pelo campo `notes`.
-- =====================================================================

-- 1) Carga Heineken -----------------------------------------------------
-- Corpo idêntico ao de 20260720004829, trocando apenas o move_type.
CREATE OR REPLACE FUNCTION public.apply_heineken_carga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispel uuid;
  v_note text;
BEGIN
  SELECT id INTO v_dispel FROM public.warehouses WHERE code = 'dispel' LIMIT 1;
  IF v_dispel IS NULL THEN RETURN NEW; END IF;

  v_note := 'Carga Heineken' || CASE WHEN NEW.invoice_number IS NOT NULL AND NEW.invoice_number <> '' THEN ' NF ' || NEW.invoice_number ELSE '' END;

  IF NEW.heineken_barris > 0 THEN
    INSERT INTO public.warehouse_movements(warehouse_id, move_type, brand, quantidade, direction, performed_by, notes, photo_url)
    VALUES (v_dispel, 'entrada', 'heineken', NEW.heineken_barris, 1, NEW.performed_by, v_note, NEW.invoice_photo_url);
  END IF;
  IF NEW.amstel_barris > 0 THEN
    INSERT INTO public.warehouse_movements(warehouse_id, move_type, brand, quantidade, direction, performed_by, notes, photo_url)
    VALUES (v_dispel, 'entrada', 'amstel', NEW.amstel_barris, 1, NEW.performed_by, v_note, NEW.invoice_photo_url);
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Conciliação de Nota Fiscal ----------------------------------------
-- Substitui apenas os dois INSERTs de recebimento dentro da RPC existente.
-- (A função é recriada por inteiro logo abaixo pelo Lovable/Supabase se o
--  corpo divergir; aqui garantimos o literal correto.)
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'conciliar_nota_fiscal'
   LIMIT 1;

  IF v_src IS NULL THEN
    RAISE NOTICE 'conciliar_nota_fiscal não encontrada — nada a corrigir.';
  ELSIF position('recebimento_heineken' in v_src) = 0 THEN
    RAISE NOTICE 'conciliar_nota_fiscal já está correta.';
  ELSE
    v_src := replace(v_src, '''recebimento_heineken''', '''entrada''');
    EXECUTE v_src;
    RAISE NOTICE 'conciliar_nota_fiscal corrigida: recebimento_heineken -> entrada.';
  END IF;
END $$;
