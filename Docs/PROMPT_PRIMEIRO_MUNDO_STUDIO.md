# Vamos criar o 1º Mundo do nosso Studio

## Prompt principal para o agente

Quero desenvolver o sistema responsável pela criação do primeiro mundo 3D do nosso studio. Leia todo este documento antes de começar, analise a estrutura atual do projeto e produza primeiro um plano técnico detalhado.

O projeto já possui boa parte do sistema de **Landscape**. Portanto, antes de criar qualquer sistema novo relacionado a terreno, relevo, heightmap, divisão do mundo, materiais ou streaming, localize e analise tudo que já existe.

> **Não reconstrua o sistema de Landscape do zero.** Reaproveite, amplie e integre o sistema atual. Somente desenvolva uma ferramenta nova quando comprovar que a capacidade necessária realmente não existe.

Tudo deve ser modular, funcional, otimizado e compatível com multiplayer. Caso alguma ferramenta essencial ainda não exista, desenvolva-a como parte do projeto, seguindo a arquitetura e os padrões já utilizados.

---

## 1. Visão geral

Estamos criando um jogo 3D de estratégia, negócios, compra de terrenos e desenvolvimento urbano, inspirado na dinâmica clássica dos jogos de propriedades, mas com identidade, nomes, regras, personagens e elementos visuais próprios.

O mundo será uma cidade viva gerada a partir de uma região real selecionada pelo usuário no OpenStreetMap.

O usuário poderá:

1. Abrir um mapa interativo;
2. Pesquisar uma cidade, bairro ou endereço;
3. Marcar vários pontos no mapa;
4. Formar um polígono delimitando a região;
5. Confirmar a seleção;
6. Gerar uma versão reduzida e jogável dessa região;
7. Utilizar a cidade gerada como o mundo de uma partida.

A região real servirá como referência para:

- Formato geral do terreno;
- Elevação e relevo;
- Ruas e avenidas;
- Rios, canais e lagos;
- Praias e litoral;
- Florestas e áreas verdes;
- Parques;
- Quadras;
- Construções existentes;
- Divisão aproximada dos bairros;
- Pontos urbanos importantes.

O resultado não precisa ser uma cópia exata da cidade. Deve ser uma interpretação procedural, estilizada, reduzida, reconhecível e otimizada para o gameplay.

---

## 2. Exemplo de seleção

No exemplo, foi selecionada uma parte do bairro Tupiry, em Praia Grande, São Paulo.

```json
{
  "id": 24398,
  "attributes": {},
  "calendarId": 0,
  "name": "Teste",
  "description": "",
  "area": "POLYGON ((-24.007580694723107 -46.47883724629323, -24.015930621793103 -46.471800463716995, -24.012892565525604 -46.4643989698487, -24.007365079098534 -46.468754051748036, -24.005620539391035 -46.47431053555061, -24.005444123946237 -46.47724967949249))"
}
```

### Validação obrigatória das coordenadas

Em WKT geográfico convencional, a ordem normalmente é:

```text
LONGITUDE LATITUDE
```

O exemplo parece utilizar:

```text
LATITUDE LONGITUDE
```

Para Praia Grande, a forma convencional seria aproximadamente:

```text
-46.478837 -24.007580
```

O sistema não pode assumir silenciosamente a ordem. Ele deverá:

- Detectar e validar a ordem recebida;
- Validar latitude entre `-90` e `90`;
- Validar longitude entre `-180` e `180`;
- Identificar valores provavelmente invertidos;
- Normalizar internamente para um único padrão;
- Armazenar o CRS utilizado;
- Mostrar uma prévia antes da geração;
- Impedir a geração de polígonos inválidos.

Utilizar preferencialmente GeoJSON internamente, no padrão:

```json
[longitude, latitude]
```

O WKT poderá continuar sendo aceito como entrada, mas deverá ser convertido e validado.

---

## 3. Ferramenta de seleção geográfica

Criar uma ferramenta na qual o usuário possa:

- Pesquisar cidade, bairro ou endereço;
- Aproximar e afastar o mapa;
- Adicionar pontos;
- Arrastar pontos existentes;
- Remover pontos;
- Fechar automaticamente o polígono;
- Visualizar o contorno e a área interna;
- Consultar coordenadas;
- Ver área em km²;
- Ver largura e comprimento aproximados;
- Visualizar escala original e escala final;
- Salvar e editar a seleção;
- Cancelar ou confirmar a geração.

A interface deverá mostrar:

- Área total selecionada;
- Dimensão máxima;
- Tamanho previsto do mundo;
- Fator de redução;
- Quantidade estimada de ruas e construções;
- Avisos de limite;
- Estimativa de processamento;
- Erros de geometria.

### Limites configuráveis

Definir limites máximos para impedir a geração de mundos excessivamente grandes:

```text
MaxSelectionAreaKm2
MaxSelectionWidthKm
MaxSelectionHeightKm
MaxPolygonPoints
MaxRoadSegments
MaxGeneratedBuildings
TargetWorldWidth
TargetWorldHeight
WorldScaleFactor
```

Esses valores devem ficar centralizados em uma configuração, e não espalhados pelo código.

---

## 4. Redução da região real

A região selecionada poderá ser grande demais para o jogo. O sistema deverá gerar uma versão reduzida preservando os elementos mais importantes.

Ordem de prioridade:

1. Formato do litoral;
2. Vias principais;
3. Rios e canais;
4. Grandes áreas verdes;
5. Organização dos bairros;
6. Quadras;
7. Pontos urbanos importantes;
8. Ruas secundárias;
9. Construções individuais.

O sistema poderá:

- Encurtar ruas muito longas;
- Remover ruas secundárias sem importância;
- Unir segmentos próximos;
- Simplificar polígonos;
- Reduzir a quantidade de quadras;
- Agrupar construções;
- Reposicionar elementos secundários;
- Preservar as características reconhecíveis da região.

A redução não deve quebrar cruzamentos, acesso aos lotes, rios, litoral ou continuidade das avenidas.

---

## 5. Fontes geográficas

Utilizar o OpenStreetMap para obter, quando disponíveis:

- Ruas, rodovias e caminhos;
- Ferrovias;
- Construções mapeadas;
- Uso do solo;
- Florestas, parques e praças;
- Rios, canais e lagos;
- Linha costeira e praias;
- Pontes e túneis;
- Pontos de interesse.

O OpenStreetMap não deve ser tratado como a única fonte de elevação. O relevo poderá precisar de um provedor DEM separado.

A arquitetura deverá separar:

```text
OSMDataProvider
ElevationDataProvider
ImageryReferenceProvider
GeographicNormalizer
ExistingLandscapeIntegration
WorldGenerator
```

Antes de integrar qualquer provedor, verificar:

- Licença;
- Atribuição obrigatória;
- Permissão de uso comercial;
- Limites de requisição;
- Política de armazenamento e cache;
- Resolução disponível.

Não realizar uso abusivo de servidores públicos de tiles. Implementar cache e processamento adequados.

---

## 6. Pipeline geral

```text
Seleção do polígono
→ validação das coordenadas
→ normalização geográfica
→ cálculo da área
→ obtenção dos dados permitidos
→ obtenção do relevo
→ recorte pelo polígono
→ simplificação geográfica
→ redução para a escala do jogo
→ integração com o Landscape existente
→ geração de água e litoral
→ geração das ruas
→ criação das quadras
→ identificação dos lotes
→ reserva do parque central
→ posicionamento do tabuleiro
→ seleção dos terrenos compráveis
→ geração dos prédios decorativos
→ geração da vegetação
→ configuração das câmeras
→ criação dos dados multiplayer
→ validação
→ salvamento do mundo
```

Cada etapa precisa informar status, progresso, erros e possibilidade de cancelamento. Uma falha não pode corromper o projeto ou um mundo já salvo.

---

## 7. Integração com o Landscape que já existe

Boa parte do sistema de Landscape já foi desenvolvida. A primeira tarefa do agente será localizar e documentar:

- Classes e componentes existentes;
- Ferramentas de geração;
- Importação de heightmap;
- Sistema de chunks, tiles ou células;
- World Partition ou solução equivalente;
- Materiais automáticos;
- Biomas;
- Água;
- Vegetação;
- Streaming;
- Salvamento;
- Dados de configuração;
- Integrações multiplayer já existentes.

Depois da análise, apresentar uma tabela:

| Requisito | Já existe | Precisa adaptar | Precisa criar |
|---|---:|---:|---:|
| Importação de relevo |  |  |  |
| Recorte por polígono |  |  |  |
| Redução de escala |  |  |  |
| Geração de ruas |  |  |  |
| Água e litoral |  |  |  |
| Floresta e vegetação |  |  |  |
| Streaming |  |  |  |
| Persistência |  |  |  |

Não duplicar funcionalidades. Novos módulos devem se conectar às interfaces existentes.

O sistema atual deverá receber, quando necessário:

- Heightmap recortado;
- Limites da seleção;
- Escala final;
- Máscaras de água;
- Máscaras de vegetação;
- Curvas das ruas;
- Áreas reservadas para construções;
- Área central do parque;
- Metadados geográficos.

Preservar morros, vales e inclinações relevantes, mas adaptar as alturas à escala reduzida. Ruas e construções não podem ficar flutuando, enterradas ou excessivamente inclinadas.

O parque central poderá exigir nivelamento controlado, com transição suave nas bordas.

---

## 8. Ruas procedurais

Gerar ruas a partir dos dados do OpenStreetMap.

Categorias iniciais:

- Avenida principal;
- Avenida secundária;
- Rua local;
- Via costeira;
- Caminho;
- Ponte;
- Túnel;
- Ciclovia;
- Calçada.

Cada categoria deverá controlar largura, faixas, material, calçada, meio-fio, sinalização, iluminação, vegetação e possibilidade de tráfego.

As ruas devem:

- Acompanhar o relevo;
- Possuir cruzamentos coerentes;
- Formar quadras utilizáveis;
- Conectar-se corretamente;
- Evitar sobreposições;
- Permitir navegação e tráfego futuro;
- Ser editáveis depois da geração.

Se ainda não existir, criar uma ferramenta para corrigir manualmente ruas, interseções, alturas e conexões.

---

## 9. Água, praia e vegetação

Identificar e gerar:

- Mar;
- Linha costeira;
- Praia;
- Rios;
- Canais;
- Lagos;
- Áreas alagadas;
- Florestas;
- Parques;
- Gramados;
- Vegetação costeira;
- Árvores urbanas.

Quando existir praia:

- Preservar o formato aproximado do litoral;
- Criar faixa de areia;
- Criar transição natural entre areia e vegetação;
- Criar calçadão ou avenida costeira quando indicado;
- Reservar áreas para hotéis, restaurantes, marina, píer e pontos turísticos.

Antes de criar novos sistemas de água ou vegetação, verificar o que já está integrado ao Landscape atual.

---

## 10. Parque e tabuleiro central

Independentemente da região escolhida, o tabuleiro deverá ficar próximo ao centro jogável do mundo.

O sistema deverá:

1. Calcular uma região central adequada;
2. Procurar uma área de menor impacto;
3. Reservar espaço para o parque;
4. Reorganizar ruas secundárias conflitantes;
5. Preservar vias principais sempre que possível;
6. Nivelar suavemente o terreno;
7. Criar acessos ao parque;
8. Posicionar o tabuleiro;
9. Configurar câmeras e iluminação;
10. Conectar as casas do tabuleiro aos terrenos da cidade.

O parque poderá conter árvores, jardins, caminhos, fontes, bancos, monumentos, iluminação e pontos de câmera.

O tabuleiro é o centro lógico da partida. A cidade ao redor representa fisicamente os investimentos dos jogadores.

---

## 11. Casas do tabuleiro e terrenos

Cada casa de propriedade deverá apontar para um lote real.

```text
BoardTile
- TileId
- TileType
- DisplayName
- PropertyId
- WorldLotId
- CameraTargetId
- PurchasePrice
- UpgradeRules
- CurrentOwner
- CurrentLevel
```

```text
WorldLot
- LotId
- Polygon
- CenterPosition
- RegionId
- RoadAccess
- PropertyCategory
- AllowedBuildingSet
- CurrentBuildingLevel
- OwnerPlayerId
- CameraAnchor
- ConstructionAnchor
- ReplicationState
```

Alguns lotes deverão ser reservados como propriedades compráveis e começar vazios, contendo somente elementos como vegetação, placa, cerca ou fundação.

Esses lotes não podem receber prédios decorativos permanentes durante a geração inicial.

---

## 12. Fluxo da jogada

1. O Game Server calcula e valida os dados;
2. A peça se movimenta;
3. O servidor determina a casa de destino;
4. A casa é destacada;
5. O terreno associado é localizado;
6. O setor de destino é carregado;
7. A câmera sai do tabuleiro;
8. A câmera percorre a cidade;
9. O terreno é enquadrado;
10. A interface mostra os dados da propriedade;
11. O jogador escolhe comprar, melhorar ou recusar;
12. O Game Server valida a ação;
13. O terreno é atualizado;
14. A construção é apresentada;
15. Todos os clientes recebem o novo estado;
16. A câmera retorna ao tabuleiro;
17. A partida continua.

A transição deve ser suave e cinematográfica. Cada lote deverá possuir pontos de aproximação, enquadramento, construção e retorno.

---

## 13. Prédios procedurais

Utilizaremos os assets do **Downtown City MegaKit, do Quaternius**, respeitando sua licença.

Os prédios serão gerados conforme:

- Tamanho e formato do lote;
- Categoria da região;
- Distância do centro;
- Proximidade da praia;
- Tipo da rua;
- Densidade urbana;
- Altura permitida;
- Função do imóvel;
- Nível de evolução.

O sistema poderá combinar base, fachada, andares, telhado, portas, janelas, letreiros, estacionamentos, jardins e objetos urbanos.

Não alterar destrutivamente os assets originais. Criar assets derivados em pastas próprias.

---

## 14. Progressão dos imóveis

```text
Nível 0: terreno vazio
Nível 1: construção pequena
Nível 2: casa ou pequeno comércio
Nível 3: prédio de médio porte
Nível 4: empreendimento avançado
Nível 5: edifício importante ou construção de luxo
```

Exemplos:

- Residencial: lote → casa → sobrado → condomínio → torre;
- Comercial: loja → comércio ampliado → galeria → centro comercial;
- Turismo: pousada → hotel → hotel de luxo → resort;
- Corporativo: escritório → edifício → torre empresarial.

Cada nível deverá possuir asset, custo, requisitos, dados de gameplay, estado visual, colisão, navegação e dados replicados.

---

## 15. Construção visual

Ao comprar ou melhorar uma propriedade, apresentar uma construção visual usando, quando adequado:

- Limpeza do terreno;
- Fundação;
- Estrutura;
- Andaimes;
- Guindaste;
- Materiais;
- Montagem por partes;
- Finalização;
- Ativação das luzes.

A apresentação poderá ser acelerada ou pulada sem alterar o estado oficial.

A animação do cliente é apenas visual. Propriedade, nível, custo e tempo devem ser controlados pelo Game Server.

---

## 16. Sistema de scripts

Analise o sistema de scripts existente antes de propor alterações:

- Linguagem;
- Formato;
- Ciclo de vida;
- Eventos;
- Permissões;
- API;
- Carregamento;
- Versionamento;
- Compatibilidade com o servidor;
- Replicação;
- Persistência.

Eventos esperados:

```text
OnDiceRolled
OnPlayerMoved
OnTileReached
OnPropertyOffered
OnPropertyPurchased
OnUpgradeRequested
OnUpgradeCompleted
OnRentCalculated
OnTurnStarted
OnTurnEnded
OnWorldLoaded
```

Fluxo obrigatório:

```text
Cliente solicita
→ Game Server valida
→ script autorizado executa no servidor
→ estado oficial é alterado
→ resultado é replicado
→ clientes apresentam a mudança
```

Scripts executados somente no cliente não podem dar dinheiro, mudar proprietário, comprar imóveis, mudar níveis, definir dados, controlar turnos ou salvar o mundo oficial.

---

## 17. Multiplayer e Game Server

Todo o sistema deverá usar servidor autoritativo.

O Game Server controlará:

- Ordem dos turnos;
- Resultado dos dados;
- Movimento das peças;
- Dinheiro;
- Compra e propriedade;
- Evolução dos prédios;
- Custos e regras econômicas;
- Construções;
- Salvamento;
- Entrada, saída e reconexão;
- Sincronização tardia.

Um jogador que entrar durante a partida deverá receber:

- Seed;
- Versão do gerador;
- Identificação do mundo;
- Propriedades e proprietários;
- Níveis;
- Turno atual;
- Estado das peças;
- Construções em andamento;
- Alterações posteriores à geração.

Elementos decorativos reproduzíveis não precisam ser replicados individualmente. Replicar seed, versão, decisões importantes e alterações de estado.

---

## 18. Salvamento

Separar definição do mundo e estado da partida.

### Definição do mundo

```text
WorldId
WorldVersion
GeneratorVersion
Seed
SourcePolygon
CoordinateSystem
ScaleFactor
GeographicMetadata
RoadGraph
LotDefinitions
BoardDefinition
NaturalFeatures
```

### Estado da partida

```text
MatchId
Players
TurnState
PlayerBalances
PropertyOwners
PropertyLevels
ActiveConstructions
CompletedEvents
WorldOverrides
SaveVersion
```

Criar migração de versões para preservar partidas antigas após atualizações do gerador.

---

## 19. Blender MCP

Caso os assets não estejam no formato correto, o Blender está aberto e poderá ser acessado pelo MCP:

```json
{
  "mcp": {
    "blender-mcp": {
      "type": "local",
      "command": ["uvx", "blender-mcp"],
      "enabled": true,
      "environment": {
        "BLENDER_HOST": "localhost",
        "BLENDER_PORT": "9876"
      }
    }
  }
}
```

Utilizar o Blender quando necessário para:

- Corrigir escala, orientação, origem e pivô;
- Separar módulos;
- Corrigir UVs e materiais;
- Gerar ou ajustar colisões;
- Produzir LODs;
- Padronizar nomes;
- Preparar encaixes;
- Exportar para o formato utilizado pelo projeto.

Antes de alterar:

1. Verifique se o MCP está conectado;
2. Inspecione o asset original;
3. Preserve o original;
4. Crie uma versão processada;
5. Registre as alterações;
6. Teste o resultado dentro do jogo.

Se o MCP não estiver disponível, informe o bloqueio e continue com tarefas independentes do Blender.

---

## 20. Ferramentas que podem ser necessárias

Somente criar uma ferramenta após verificar que ela ainda não existe:

- **Geographic Selection Tool:** seleção e validação do polígono;
- **Geographic Importer:** importação e normalização;
- **Existing Landscape Adapter:** conexão dos dados geográficos ao Landscape atual;
- **Road Generator:** ruas, cruzamentos, pontes e calçadas;
- **Natural Feature Generator:** água, praia, floresta e vegetação;
- **Lot Generator:** quadras e lotes;
- **Board Placement Tool:** parque e tabuleiro;
- **Board-to-World Linker:** associação entre casas e terrenos;
- **Procedural Building Generator:** montagem dos edifícios;
- **Building Progression Editor:** níveis de evolução;
- **Camera Route Editor:** rotas cinematográficas;
- **World Validation Tool:** validações;
- **Multiplayer World State Module:** mundo, scripts e servidor.

Todas devem ser reutilizáveis nos próximos mundos do studio.

---

## 21. Otimização

Reaproveitar os recursos existentes e considerar:

- World Partition ou solução atual;
- Streaming por regiões;
- LOD e HLOD;
- Instanced Static Mesh;
- Hierarchical Instanced Static Mesh;
- Occlusion Culling;
- Nanite quando adequado;
- Vegetação otimizada;
- Colisões simplificadas;
- Tráfego e pedestres com níveis de simulação;
- Desativação de efeitos fora da câmera;
- Carregamento antecipado do destino.

Antes de a câmera viajar até um lote, seu setor deverá estar carregado. Se ainda não estiver pronto, a transição deve aguardar de maneira elegante.

---

## 22. Edição e overrides

Depois da geração, um desenvolvedor deverá conseguir:

- Mover uma rua;
- Corrigir uma interseção;
- Alterar um lote;
- Trocar um prédio;
- Mudar vegetação;
- Ajustar o relevo;
- Reposicionar o tabuleiro;
- Trocar a associação entre casa e terreno;
- Ajustar câmeras;
- Bloquear uma região contra regeneração.

Alterações manuais deverão ser salvas como overrides para que uma nova geração não destrua o trabalho.

---

## 23. Validações obrigatórias

- Polígono válido e sem auto-interseções;
- Ordem correta das coordenadas;
- Área dentro do limite;
- Integração correta com o Landscape existente;
- Ruas conectadas;
- Construções apoiadas no terreno;
- Ausência de prédios sobre ruas;
- Lotes acessíveis;
- Terrenos compráveis livres;
- Parque central válido;
- Tabuleiro posicionado;
- Casas associadas aos lotes;
- Pontos de câmera válidos;
- Navegação funcionando;
- Seed reproduzível;
- Multiplayer sincronizado;
- Salvamento, carregamento e reconexão funcionando;
- Licenças e atribuições registradas.

Gerar um relatório ao final.

---

## 24. Primeira prova de conceito

Não construir tudo de uma vez. A primeira prova deverá conter:

1. Análise do Landscape existente;
2. Ferramenta para desenhar um polígono;
3. Importação de uma área pequena;
4. Validação das coordenadas;
5. Integração do relevo com o sistema atual;
6. Geração das ruas principais;
7. Água e vegetação básicas;
8. Redução para a escala do jogo;
9. Parque central;
10. Tabuleiro;
11. Algumas quadras;
12. Um terreno comprável;
13. Uma casa ligada ao terreno;
14. Três níveis de construção;
15. Uso inicial do Downtown City MegaKit;
16. Câmera viajando até o terreno;
17. Compra validada pelo Game Server;
18. Atualização para todos os jogadores;
19. Salvamento, carregamento e reconexão.

Ciclo mínimo:

```text
Selecionar região
→ gerar versão reduzida
→ iniciar partida multiplayer
→ jogar os dados
→ mover a peça
→ cair em uma propriedade
→ viajar até o terreno
→ comprar
→ construir
→ replicar
→ salvar
→ retornar ao tabuleiro
```

---

## 25. Forma de trabalho do agente

Antes de modificar o projeto:

1. Analise o repositório;
2. Leia os arquivos de orientação do projeto;
3. Identifique engine, linguagem e versões;
4. Localize o Landscape já implementado;
5. Localize o Game Server;
6. Localize o sistema de scripts;
7. Identifique a arquitetura multiplayer;
8. Verifique os assets;
9. Liste as ferramentas existentes;
10. Compare o que existe com este documento;
11. Apresente um plano por etapas.

Regras:

- Não invente APIs sem verificar o código;
- Não reconstrua sistemas funcionais;
- Não substitua o Landscape atual sem autorização;
- Preserve alterações não relacionadas;
- Trabalhe em componentes pequenos;
- Teste cada etapa;
- Registre decisões;
- Use configurações centralizadas;
- Não deixe autoridade econômica no cliente;
- Documente como gerar o próximo mundo.

Se faltar uma ferramenta essencial, desenvolva-a de forma modular e reutilizável.

---

## 26. Entregáveis

1. Análise da arquitetura existente;
2. Levantamento completo do sistema de Landscape atual;
3. Tabela do que será reaproveitado, adaptado ou criado;
4. Plano técnico por fases;
5. Diagrama do pipeline;
6. Modelo dos dados geográficos;
7. Modelo do mundo;
8. Modelo multiplayer;
9. Estratégia de redução;
10. Estratégia de geração determinística;
11. Integração com o Game Server;
12. Integração com os scripts;
13. Prova de conceito funcional;
14. Testes;
15. Relatório de desempenho;
16. Relatório de validação;
17. Documentação para os próximos mundos.

---

## Resultado esperado

O jogador poderá selecionar no mapa uma região real, como parte do bairro Tupiry, e transformá-la em uma cidade 3D reduzida e estilizada.

O jogo preservará as características mais importantes da região — relevo, ruas, praia, rios, florestas e organização urbana — integrando os dados ao sistema de Landscape que já existe.

No centro da cidade ficará o tabuleiro. Ao cair em uma propriedade, a câmera viajará até o lote correspondente. O jogador poderá comprar o terreno e acompanhar sua evolução visual, começando como lote vazio e avançando para casa, comércio, prédio ou grande empreendimento.

Todo o sistema deverá funcionar em multiplayer, com o Game Server como autoridade, geração reproduzível por seed, salvamento persistente e ferramentas reutilizáveis para os próximos mundos do nosso studio.
