# Fase 9 — Administração e World Studio 3D

Status: primeiro marco implementado em 29 de julho de 2026.

## Objetivo

O `admin-web` é o sistema administrativo geral da Terrativa. O World Studio é
uma ferramenta interna desse sistema, não uma aplicação administrativa
separada.

O primeiro marco permite:

- criar mundos a partir de uma ilha procedural, cidade costeira ou base plana;
- listar, abrir, duplicar, excluir, importar, exportar e publicar mundos;
- editar terreno, mar, lagos, rios, construções, cenário e veículos;
- visualizar e manipular o mundo em perspectiva ou vista superior;
- selecionar, mover, girar e redimensionar elementos em uma cena Babylon.js;
- configurar cada trecho do percurso como caminhada, carro ou barco;
- escolher o veículo padrão e a velocidade de um trecho;
- salvar o trabalho localmente e publicar um pacote versionável em JSON.

## Marco 2 — fluxo inspirado no Unreal Editor

O Studio passou a seguir a organização que o autor já conhece no Unreal:

- barra de menus e toolbar do viewport;
- viewport central;
- Organizador hierárquico dos atores da cena;
- painel de Detalhes/Inspetor;
- Gaveta de Conteúdo com arquivos e pastas do mundo;
- editor de JavaScript integrado;
- configurações multiplayer no Inspetor.

O layout é ajustável como em um editor desktop:

- a borda superior da Gaveta de Conteúdo altera sua altura;
- a divisão entre Organizador e Inspetor altera a altura do Organizador;
- a borda esquerda dos painéis laterais altera a largura dos dois painéis;
- o menu `Janela` mostra ou oculta Organizador, Inspetor e Gaveta de Conteúdo;
- `Janela → Restaurar layout padrão` recupera a organização inicial;
- tamanhos e visibilidade são persistidos separadamente para cada mundo.

Os divisores também aceitam as setas do teclado quando recebem foco. `Shift`
aumenta o passo do redimensionamento.

### Salvamento do mundo

O Studio mantém alterações em memória até uma operação de salvamento. O usuário
pode salvar o mundo atual pelo botão superior `Salvar`, por
`Arquivo → Salvar mundo atual` ou pelo atalho `Ctrl+S`.

Enquanto houver alterações pendentes, o indicador superior fica âmbar e mostra
`não salvo`. A cada 30 segundos o Studio verifica o mundo atual e executa um
salvamento automático quando houver mudanças. O mesmo indicador informa o
horário do último salvamento manual ou automático.

Não se trata de uma cópia visual literal do Unreal. A hierarquia e os comandos
foram adaptados para o domínio da Terrativa e para execução no navegador.

### Controles do viewport

- clique esquerdo seleciona um ator ou uma alça do gizmo;
- `Ctrl` + clique adiciona ou remove objetos da seleção múltipla;
- seleções múltiplas usam um pivô no centro do grupo e movem, giram ou escalam
  todos os objetos juntos, preservando suas posições relativas;
- o gizmo move, gira ou escala nos eixos X, Y e Z;
- botão direito + movimento do mouse controla a direção da câmera;
- botão esquerdo arrastado no fundo também gira a câmera;
- `WASD` move a câmera;
- `Q/E` move a câmera para baixo/cima;
- roda do mouse com o botão direito altera a velocidade de voo;
- `1`, `2` e `3` selecionam mover, girar e escalar;
- a alça central do gizmo move livremente no plano da câmera;
- `F` enquadra o objeto selecionado;
- `Delete` ou `Backspace` remove o objeto selecionado;
- `Ctrl+C` copia e `Ctrl+V` cola o objeto armazenado na área de transferência do Studio;
- `Ctrl+D` duplica o objeto;
- `Ctrl+Z` desfaz a última alteração do mundo;
- `Ctrl+Y` ou `Ctrl+Shift+Z` refaz a alteração desfeita;
- `Esc` limpa a seleção;
- `G` alterna a grade.

Casas e rotas oficiais são protegidas contra `Delete`, pois fazem parte do
contrato autoritativo do jogo. Elas podem ser alteradas pelo Inspetor.
O histórico mantém até 100 alterações por sessão. Dentro de campos de texto,
`Ctrl+Z` continua usando o desfazer nativo do navegador.

### Landscape

Cada mundo pode possuir um ator `Landscape`, listado no Organizador e persistido
no pacote exportado. O botão `Landscape` da barra superior abre o modo de
escultura; quando o mundo não possui terreno, o mesmo botão permite criá-lo.

- `Elevar` e `Abaixar` alteram a altura enquanto o botão esquerdo é arrastado;
- `Suavizar` reduz transições abruptas entre os vértices;
- `Achatar` aproxima a área pintada da altura inicial do pincel;
- `Raio` controla a área da pincelada e `Força` controla sua intensidade;
- largura e profundidade aumentam ou diminuem o tamanho físico do terreno;
- resolução controla a densidade da grade, entre 8 e 64 segmentos;
- `Restaurar relevo` remove somente as esculturas, preservando o terreno procedural;
- `Delete` ou `Remover Landscape` exclui o ator, e `Ctrl+Z` recupera a operação.

Construções, veículos e malhas estáticas acompanham automaticamente a altura do
solo ao alterar tamanho, elevação, relevo, nível da água, semente ou escultura.
O Studio aplica somente a diferença entre a superfície antiga e a nova em cada
posição, preservando qualquer distância vertical configurada manualmente no objeto.

Cada pincelada concluída gera uma entrada própria no histórico. `Ctrl+Z` e
`Ctrl+Y` desfazem/refazem a geometria sem fechar o modo Landscape ou retirar o
ator do Inspetor. Os mesmos comandos ficam disponíveis dentro do painel de
escultura pelos botões `Desfazer` e `Refazer`.

As alturas esculpidas são armazenadas no próprio mundo. O manifesto de servidor
versão 3 informa dimensões, resolução e quantidade de vértices do Landscape.

### Organizador

O Organizador representa os atores existentes na cena e permite organizar mundos
maiores sem alterar a lógica ou o identificador de cada objeto.

- o mundo, os grupos padrão e as pastas podem ser expandidos ou recolhidos;
- `+ Pasta` cria uma pasta na raiz do mundo;
- o botão `+` de uma pasta cria uma subpasta dentro dela;
- uma pasta selecionada recebe os atores atuais por meio de `Mover aqui`;
- a ação `Retirar` devolve a seleção aos grupos padrão;
- a seleção múltipla com `Ctrl` permite mover vários atores de uma vez;
- a busca mostra correspondências dentro de grupos e pastas recolhidas;
- nomes e tipos possuem colunas independentes para evitar compressão excessiva;
- ciclos e referências a pastas inexistentes são normalizados na importação.

Pastas, subpastas e associações são persistidas no próprio mundo e fazem parte do
pacote exportado para o servidor. Criar pastas ou mover atores usa o histórico
normal do Studio e pode ser desfeito com `Ctrl+Z`.

### Gaveta de Conteúdo

Cada mundo possui uma árvore própria com pastas para ambiente, construções,
veículos, personagens, áudio, texturas, scripts e uploads.

Os assets empacotados guardam URL, tipo, origem, licença e escala padrão. O
catálogo inicial inclui os modelos costeiros Kenney e os personagens Quaternius
já versionados no projeto. Arquivos 3D exibem uma miniatura renderizada da
malha, em vez de um ícone genérico.

Todo modelo colocado no mundo é tratado como uma **Malha Estática**, com
mobilidade estática, transformação, colisão e configuração de sombras. Um duplo
clique abre o Editor de Malha Estática; o botão `+ Cena` ou a ação dentro do
editor cria a instância no mundo.

O editor de malha oferece:

- visualização 3D orbitável e enquadramento automático;
- contagem de malhas, vértices, triângulos e materiais;
- colisão desativada, por caixa simples ou pela malha;
- substituição de cor base, metálico, rugosidade, emissivo e textura;
- restauração dos materiais originais;
- assets de `Engine` protegidos contra edição;
- duplicação de uma malha da `Engine` para o `Conteúdo` do mundo.

As alterações feitas no editor são refletidas nas instâncias da cena e entram
no manifesto exportado para que o servidor conheça o tipo da malha, colisão,
sombras, material e textura.

O upload aceita GLB/glTF, imagens, áudio e JSON, com limite de 25 MB por arquivo.
Para modelos web autocontidos, GLB é o formato recomendado. Packs antigos em
FBX/OBJ precisam ser convertidos e validados antes de entrar no catálogo.

### Scripts

O editor permite criar, organizar e editar arquivos `.js` dentro do mundo.
Scripts começam desativados.

Código de usuário nunca deve ser executado com `eval`, importado diretamente
pelo processo principal ou receber APIs de Node.js. O pacote publicado marca
cada script como `sandbox-required`. A próxima camada do runtime deverá executar
scripts em workers/processos isolados, com:

- API explícita e versionada;
- limite de CPU e memória;
- timers controlados;
- acesso apenas a objetos autorizados;
- sem rede, filesystem ou variáveis de ambiente;
- log, cancelamento e auditoria por mundo.

O exemplo de elevador demonstra o contrato desejado de movimento e eventos, mas
permanece desativado até a sandbox existir.

### Integração multiserver

Exportar ou publicar gera um pacote `schemaVersion: 2` com:

- mundo completo;
- manifesto de assets e licenças;
- rotas e modos de transporte;
- autoridade e versão do protocolo;
- tipo de sala, região, tick rate e limite de jogadores;
- estratégia de shard por sala;
- lista de scripts que exigem sandbox.

O `game-server` valida o mesmo contrato compartilhado em
`@terrativa/protocol`. A publicação HTTP exige uma conta `ADMIN`, grava o pacote
de modo atômico e disponibiliza a versão pública sem enviar o código-fonte dos
scripts ao cliente.

## Estudo do Snowflow

O repositório `Noniv/snowflow_demo` foi estudado como referência de terreno 3D.
Ele usa Babylon.js, WebGPU, heightfield procedural na GPU, anéis de clipmap,
câmera em terceira pessoa com spring arm e parâmetros ajustáveis em tempo real.

Conceitos adotados:

- separação entre geração do terreno e conteúdo colocado sobre ele;
- parâmetros de terreno editáveis com resposta imediata;
- câmera independente do modelo de mundo;
- aquecimento e carregamento assíncrono da cena;
- geometria do terreno determinada por seed, elevação e rugosidade.

Conceitos não copiados neste marco:

- dependência exclusiva de WebGPU;
- heightfield de 4096 × 4096;
- oito anéis de clipmap;
- deformação de neve e sistema de pegadas.

Esses recursos atendem bem ao demonstrador de neve, mas aumentariam o custo de
memória e restringiriam a compatibilidade do editor. O Studio usa terreno
procedural subdividido, compatível com WebGL e WebGPU. Clipmap e edição por
pincel podem ser adicionados depois, quando houver medição em máquinas e
celulares-alvo.

## Arquitetura

O fluxo principal é:

`Admin → Catálogo de mundos → World Studio → Pacote do mundo → Runtime do jogo`

O Admin controla metadados e ciclo de vida. O Studio modifica o conteúdo 3D. O
publicador grava o pacote completo em:

`apps/admin-web/data/worlds/<slug>.json`

Para manter o jogo atual funcionando durante a migração, publicar o mundo
`baixada-santista` também atualiza a cena oficial consumida pelo pacote
`@terrativa/board-content`.

O canvas Babylon.js é carregado sob demanda. Assim, o painel administrativo não
baixa o motor 3D antes de o usuário abrir o Studio.

## Modelo de mundo

Cada `StudioWorld` possui:

- identidade, descrição, template e estado de publicação;
- `terrain`: seed, dimensões, elevação, rugosidade e cores;
- `scene`: superfície, casas do tabuleiro e objetos 3D;
- `waterBodies`: mar, lago ou rio, com posição, tamanho, rotação e cor;
- `routes`: ligações entre pontos, modo de viagem, velocidade e veículo;
- `vehicles`: instâncias de carros com asset e transformação;
- datas de criação e atualização.

As casas da cena são os pontos oficiais do jogo. Ao criar um mundo, o editor
também cria uma ligação de cada casa para a próxima, fechando o percurso.

## Água e rios

O mar é parte da superfície base do mundo. Lagos e rios são objetos próprios,
selecionáveis no canvas e editáveis pelo inspetor.

No primeiro marco, um rio é representado por uma superfície de água
redimensionável e rotacionável. A evolução prevista é um editor por spline:
o autor marca pontos de controle e o Studio gera as margens, a malha da água e
as pontes necessárias.

## Percurso e transporte

Cada trecho entre dois pontos declara:

- `walk`: o personagem percorre o trecho a pé;
- `car`: o personagem embarca no veículo escolhido e viaja até o destino;
- `boat`: o personagem usa transporte aquático;
- velocidade de deslocamento;
- asset de veículo quando aplicável.

O Studio já cria e edita esses dados. O próximo marco do runtime do jogo deve
consumir o pacote completo e executar a máquina de estados:

`parado → caminhar/embarcar → viajar → desembarcar → chegar`

O resultado do dado continua sendo autoritativo no servidor. O cliente apenas
anima a sequência de pontos determinada pelo estado oficial da partida. Uma
viagem automática para um destino usa a mesma rota, mas recebe do servidor a
lista completa de trechos que deve percorrer.

## Veículos e licença

O primeiro catálogo usa cinco modelos GLB do Kenney Car Kit:

- sedan;
- táxi;
- SUV;
- van;
- ambulância.

Os arquivos estão versionados em
`apps/game-client/public/assets/vendor/kenney/car-kit/3.1/`, acompanhados da
licença e de um manifesto de origem. O pacote é CC0.

## Desempenho e evolução

Antes de ampliar o terreno, devem ser medidos:

- tempo para abrir o Studio;
- uso de memória da GPU;
- quantidade de draw calls;
- custo de sombras e transparência da água;
- desempenho em notebook sem GPU dedicada e Android intermediário.

Próximas entregas recomendadas:

1. fazer o runtime carregar o pacote completo do mundo publicado;
2. executar caminhada, embarque, carro e barco durante a partida;
3. criar editor de rios e estradas por spline;
4. adicionar colisão, navegação e validação de rotas desconectadas;
5. gerar versões publicadas imutáveis e cache persistente das miniaturas;
6. usar instâncias, LOD e carregamento por setores em mundos maiores;
7. sincronizar mundos publicados com API e banco de dados.

## Critérios de validação do marco

- o Admin abre sem inicializar Babylon.js;
- um novo mundo recebe pontos e rotas válidas;
- água, props, rotas e veículos podem ser adicionados e selecionados;
- transformações alteram o modelo persistido;
- exportar e importar preservam o pacote completo;
- publicar grava o mundo e mantém compatibilidade com a Baixada Santista;
- testes de modelo, interface, typecheck e build passam.
