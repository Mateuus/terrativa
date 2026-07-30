# Fase 8 — mapa real, tabuleiro 3D e HUD

Status: iniciada em 26 de julho de 2026.

## Decisão visual

A visão regional usa MapLibre GL JS com cartografia vetorial baseada em
OpenStreetMap e estilo hospedado pelo OpenFreeMap. Ela mostra cidades reais,
permite inclinação e rotação da câmera e desenha o percurso do módulo sobre o
território.

Essa camada não é fotografia de satélite. Imagens aéreas poderão ser adicionadas
depois por um provedor separado, desde que haja cobertura, licença e capacidade
de serviço compatíveis com produção.

O tabuleiro procedural em Babylon.js continua disponível no botão
`Tabuleiro 3D`. Os personagens e construções estilizados serão adicionados nessa
camada e, quando útil, poderão ser combinados com o mapa por uma custom layer.

## Contrato modular

Nenhum renderer conhece `Baixada Santista` diretamente.

- `TerrativaModule.boards` contém as regras e o conteúdo dos tabuleiros.
- `TerrativaModule.mapViews` contém zero ou um mapa para cada `boardSlug`.
- `TerrativaModuleRegistry.getMap(boardSlug)` resolve a apresentação geográfica.
- `TerritoryMap` recebe uma `TerritoryMapDefinition`.
- `GameCanvas` recebe um `BoardContent` e calcula casas e cores a partir dele.
- O cliente lê o catálogo do registro. Quando houver mais de um módulo, o
  seletor de módulos aparece automaticamente.

Cada `TerritoryMapDefinition` declara:

- `boardSlug`;
- centro, zoom, inclinação, rotação e limites;
- cidades com coordenadas;
- percurso em coordenadas geográficas.

O schema rejeita limites invertidos, pontos fora da área, cidades duplicadas e
mapas que referenciam tabuleiros ou cidades inexistentes.

## Como incluir outro módulo

Um módulo comunitário, como `baixada-fluminense`, fornece seu próprio
`BoardContent` e sua própria definição de mapa. Depois ele é adicionado ao
catálogo de módulos; nenhum componente React ou renderer precisa ser alterado.

O percurso atual é editorial e estilizado, definido pelo autor do módulo. Uma
fase posterior poderá aceitar GeoJSON calculado por um motor de rotas, sem mudar
o contrato público do renderer.

## Atribuição e operação

A atribuição visível a OpenStreetMap e OpenFreeMap permanece no controle do mapa.
O cliente não faz download em massa nem pré-carregamento de tiles. Antes de
produção, a equipe deve revisar limites de uso, disponibilidade e estratégia de
cache do provedor escolhido.

## Entregue no primeiro marco jogável

- a partida iniciada troca o lobby por um canvas Babylon.js em tela cheia;
- tela de carregamento mantém o jogador informado enquanto o renderer é preparado;
- casas, cidades, propriedades, proprietários e níveis vêm do módulo e do estado
  autoritativo, sem conteúdo regional fixo no componente;
- os 11 personagens masculinos Quaternius foram versionados com licença e hashes,
  carregados pelo `pawnKey` e animados com os clipes `Idle` e `Walk`;
- peões multiplayer percorrem o caminho casa por casa com ciclo de caminhada;
- dados 3D respondem ao evento oficial `DICE_ROLLED`;
- HUD mostra jogadores, turno, cronômetro, saldo, fase, cartas e eventos;
- picking permite inspecionar cada casa e seu conteúdo educativo;
- ações são contextuais à fase oficial da partida;
- a sessão da partida é persistida para reconexão após recarregar a página.

## Próximas entregas da fase

1. importar e versionar o pacote feminino Quaternius;
2. otimizar os glTF já integrados e criar miniaturas para a seleção no lobby;
3. associar cada casa do tabuleiro a um ponto do percurso geográfico;
4. completar negociação, cartas e administração avançada no HUD;
5. medir desempenho em Android intermediário;
6. avaliar uma camada aérea opcional, sem torná-la dependência do gameplay.
