DO $$
DECLARE
  m        RECORD;
  v_bar    uuid;
  v_rota   uuid;
  faltando text := '';
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('Fundo arquibancada',        'Rota 1',   6,  6),
      ('Meio arquibancada',         'Rota 1',   6,  6),
      ('Entrada arquibancada',      'Rota 2',  10, 10),
      ('Nova arquibancada',         'Rota 2',   6,  6),
      ('Villa 1 autoatendimento',   'Rota 3',  20, 20),
      ('Chopperia 1 andar',         'Rota 3',   6,  6),
      ('Chopperia 2 andar',         'Rota 3',   6,  6),
      ('Villa 2 autoatendimento',   'Rota 4',  20, 20),
      ('Villa 2 menor',             'Rota 4',   6,  6),
      ('Vila 3 maior',              'Rota 4',  10, 10),
      ('Villa 3 menor',             'Rota 4',   6,  6),
      ('Nucleos',                   'Rota 5',  10, 10),
      ('Churrascaria liberdade',    'Rota 5',   6,  6)
    ) AS t(nome, rota, ph, pa)
  LOOP
    SELECT id INTO v_bar FROM public.bars
      WHERE btrim(lower(name)) = btrim(lower(m.nome)) LIMIT 1;

    IF v_bar IS NULL THEN
      faltando := faltando || m.nome || ', ';
      RAISE NOTICE 'BAR NAO ENCONTRADO: %', m.nome;
      CONTINUE;
    END IF;

    SELECT id INTO v_rota FROM public.rotas WHERE nome = m.rota;
    UPDATE public.bars SET rota_id = v_rota WHERE id = v_bar;

    INSERT INTO public.bar_stock_standard (bar_id, brand, barris_padrao)
      VALUES (v_bar, 'heineken', m.ph)
      ON CONFLICT (bar_id, brand) DO UPDATE SET barris_padrao = EXCLUDED.barris_padrao;
    INSERT INTO public.bar_stock_standard (bar_id, brand, barris_padrao)
      VALUES (v_bar, 'amstel', m.pa)
      ON CONFLICT (bar_id, brand) DO UPDATE SET barris_padrao = EXCLUDED.barris_padrao;
  END LOOP;

  IF faltando <> '' THEN
    RAISE NOTICE '>>> Revise estes nomes: %', faltando;
  END IF;
END $$;