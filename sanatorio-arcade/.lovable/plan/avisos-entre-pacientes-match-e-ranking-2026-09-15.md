# Avisos entre pacientes: Match e Ranking

Hoje o sino já avisa curtida, match, prenda e desafio recebidos. O que falta é o
"o que aconteceu depois": resultado das apostas, fichas recebidas e, principalmente,
movimentação no placar.

## Novos avisos

**Ranking**

- Você entrou no pódio: "VOCÊ ENTROU NO TOP 3".
- Você foi ultrapassado: "NOME ROUBOU SEU 2º LUGAR".
- Você ultrapassou alguém do topo: "VOCÊ PASSOU NOME — AGORA 3º".
- Marcos de fichas ganhas (100, 250, 500, 1000): "500 FICHAS. DIAGNÓSTICO: SEM CURA".
- Alerta geral quando o pódio muda: "NOVO LÍDER DA ALA: NOME".

**Match / interações**

- Desafio resolvido: "VOCÊ GANHOU 50 FICHAS DE NOME" ou "NOME LEVOU SUAS 50 FICHAS".
- Desafio aceito ou recusado por quem você desafiou.
- Prenda respondida: "NOME CUMPRIU SUA PRENDA" / "NOME PASSOU A VEZ".
- Doação recebida: "NOME TE DOOU 25 FICHAS".

## Como o aviso aparece

- Entra na lista do sino, com contador de não lidos (já existe).
- Aparece também como faixa rápida na tela (toast) com vibração curta, para quem
  está com o celular na mão e não vai abrir o sino.
- Aviso de pódio/ultrapassagem destaca a sua linha no Ranking por alguns segundos.
- Continua tudo dentro do app: sem notificação de sistema com o app fechado.
  Se você quiser aviso de celular travado depois, isso é um passo separado
  (exige um serviço de push e permissão do navegador).

## Detalhes técnicos

- `src/lib/avisos.ts`: novos tipos de `Aviso` (`ultrapassado`, `podio`, `marco`,
  `resultado`, `doacao`) e assinaturas adicionais no mesmo canal realtime:
  - UPDATE em `desafios` onde eu sou `de_paciente` ou `para_paciente` (status
    aceito/recusado/resolvido, comparando `vencedor` com meu id);
  - UPDATE em `prendas` onde eu sou `de_paciente` (resposta da minha prenda);
  - INSERT em `transacoes` com `para_paciente = eu` e motivo `doacao`.
    Nomes continuam vindo da view `pacientes_publicos`.
- Novo `src/lib/avisos-ranking.ts`: recebe o resultado de `lerRanking()` e o último
  retrato guardado em `localStorage` (`ranking_visto`: posição minha, ganhos e os
  três primeiros) e devolve a lista de avisos gerados pela diferença. Marcos
  disparam uma vez só, guardando o maior marco já avisado.
- `SinoAvisos.tsx` passa a abrir também um canal de `transacoes` via
  `canalQuandoDerVerifica` (respeitando sinal fraco, com recarga espaçada),
  recarrega o ranking com throttle de ~10s e injeta os avisos derivados.
  Toast pelo `sonner` (já no projeto) + `navigator.vibrate` quando disponível.
- `ranking.tsx`: consome o mesmo utilitário para destacar a linha do usuário
  quando ele muda de posição.
- Sem mudança de banco: `transacoes`, `desafios` e `prendas` já estão publicados
  no realtime e com leitura pública.
- Nenhum minigame do Arcade é alterado.
