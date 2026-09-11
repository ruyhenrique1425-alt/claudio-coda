# Melhorias — backlog para o Lovable

Prompts prontos para colar no chat do Lovable, em ordem de utilidade.

## Já aplicado neste código

- Compatibilidade do `/match` agora usa os cinco diagnósticos (0–100%), com
  barra, rótulo por faixa e desempate por diagnósticos idênticos. Antes só
  comparava dois atributos e nunca passava de duas estrelas.
- Mural e lista de pacientes atualizam sozinhos (15s e 20s) e ao voltar o foco
  para a aba — durante a festa ninguém vai apertar F5.
- Telas de erro e 404 em português, no tom do app.
- `.env` fora do versionamento, com `.env.example` no lugar.

## Próximos passos

**1. Limite de envio no mural e na galeria**

> Adicione rate limiting no mural e no upload de fotos: no máximo 5 mensagens
> por minuto por paciente. Guarde a contagem no banco por `paciente_id` e
> devolva um erro amigável quando estourar.

**2. Placar dos minigames**

> Crie uma tabela `partidas` (paciente_id, jogo, pontuação, created_at) e grave
> o resultado do Genius do Manicômio e do Detector de Mentiras. Mostre um
> ranking top 10 na tela do arcade, atualizando em tempo real.

**3. Moderação do mural**

> Adicione um botão de denúncia em cada recado e uma coluna `oculto` na tabela
> `mural`. Recados com 3 denúncias somem do feed automaticamente.

**4. Galeria em tempo real**

> Use Supabase Realtime na tabela `fotos` para novas fotos aparecerem na
> galeria sem recarregar, com uma animação de entrada.

**5. PWA**

> Transforme o app em PWA instalável: manifest, ícones e service worker, para
> os convidados abrirem direto da tela inicial do celular sem barra do browser.

**6. Compartilhar a ficha**

> Gere uma imagem da ficha de admissão (avatar + diagnósticos) para o paciente
> compartilhar no story, usando canvas no cliente.

**7. Endurecer o RLS depois da festa**

> Revise as políticas de RLS: hoje `anon` insere em todas as tabelas sem
> restrição. Amarre inserção ao `paciente_id` salvo no dispositivo e bloqueie
> escrita quando a festa terminar.
