-- =====================================================================
-- DEFINITIVO — consumo da CHOPPERIA (reexport limpo, cartões corretos).
-- Confirmado: um dos "Chopperia" antigos era a churrascaria (agora Liberdade,
-- já corrigida em 20260725160000). A Chopperia real (1º+2º andar, cartão único)
-- = 43 H / 44 A. Substitui o valor antigo inflado. Idempotente.
-- =====================================================================
DELETE FROM public.meep_consumo_bar
 WHERE translate(lower(btrim(bar_nome)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
       IN ('chopperia (1+2)','chopperia','choperia');

INSERT INTO public.meep_consumo_bar (bar_id, bar_nome, data, marca, barris)
VALUES
  (NULL,'Chopperia (1+2)','2026-07-18','heineken',5),
  (NULL,'Chopperia (1+2)','2026-07-18','amstel',4),
  (NULL,'Chopperia (1+2)','2026-07-19','heineken',5),
  (NULL,'Chopperia (1+2)','2026-07-19','amstel',5),
  (NULL,'Chopperia (1+2)','2026-07-20','heineken',1),
  (NULL,'Chopperia (1+2)','2026-07-20','amstel',1),
  (NULL,'Chopperia (1+2)','2026-07-21','heineken',2),
  (NULL,'Chopperia (1+2)','2026-07-21','amstel',3),
  (NULL,'Chopperia (1+2)','2026-07-22','heineken',6),
  (NULL,'Chopperia (1+2)','2026-07-22','amstel',6),
  (NULL,'Chopperia (1+2)','2026-07-23','heineken',17),
  (NULL,'Chopperia (1+2)','2026-07-23','amstel',17),
  (NULL,'Chopperia (1+2)','2026-07-24','heineken',7),
  (NULL,'Chopperia (1+2)','2026-07-24','amstel',8)
ON CONFLICT (bar_nome,data,marca) DO UPDATE SET barris = EXCLUDED.barris;
