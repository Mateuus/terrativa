Prompt mestre — Terrativa

Você atuará como arquiteto de software, game designer técnico e desenvolvedor principal deste projeto. Leia integralmente todos os arquivos Markdown desta pasta antes de modificar o repositório.

1. Missão

Construir um jogo multiplayer online de compra, administração e negociação de propriedades para navegador, PWA, Android e iOS.

O jogo terá identidade própria. Não copie nomes, tabuleiro, textos, cartas, símbolos, modelos, imagens, sons, interface ou regras protegidas de Banco Imobiliário, Monopoly, World of ClaudeCraft ou qualquer outro produto. O projeto World of ClaudeCraft pode ser estudado somente como referência de arquitetura web-first, servidor autoritativo, cliente gráfico e empacotamento mobile.

Referência técnica:

https://github.com/levy-street/world-of-claudecraft

O primeiro tema será uma rota fictícia pela Baixada Santista, abrangendo Santos, São Vicente, Praia Grande, Guarujá, Cubatão, Bertioga, Mongaguá, Itanhaém e Peruíbe.

Todos os valores e propriedades são elementos fictícios de jogo. Não haverá aposta, saque, prêmio financeiro, token negociável ou conversão da moeda virtual.

2. Requisitos centrais

Cadastro, login, logout, renovação de sessão e perfil.

MySQL 8 com migrations, seeds e Prisma.

Salas públicas e privadas.

Entrada por código curto e link de convite.

De 2 a 6 jogadores por partida.

Comunicação em tempo real com Colyseus/WebSocket.

Lobby com configurações, chat, jogadores prontos e escolha de peão.

Tabuleiro 3D produzido em Babylon.js.

Interface React sobreposta ao canvas.

Servidor totalmente autoritativo.

Game engine isolada, determinística e testável.

Turnos, dados, movimento, propriedades, aluguel, melhorias e negociações.

Cartas de evento e benefício.

Falência, encerramento e vencedor.

Reconexão e recuperação por snapshot.

PWA e aplicativo com Capacitor.

Painel administrativo.

Logs, métricas, segurança e testes automatizados.

3. Stack obrigatória

Monorepo

pnpm workspaces.

Turborepo.

TypeScript com modo strict.

Biome para lint e formatação.

Cliente

React.

Vite.

Babylon.js.

Colyseus SDK.

Zustand.

TanStack Query.

Tailwind CSS.

Zod.

React Hook Form.

PWA.

Capacitor.

Não use Next.js para o cliente do jogo. Babylon.js controla o canvas; React controla páginas, HUD, menus, modais e chat.

Servidor

Node.js LTS atual.

Fastify para REST.

Colyseus para salas e estado multiplayer.

Prisma.

MySQL 8.

Redis preparado para escala horizontal.

Argon2id.

Access token de curta duração.

Refresh token com rotação.

Cookies HttpOnly, Secure e SameSite.

Pino.

Testes

Vitest.

Fastify inject ou Supertest.

Playwright.

Testcontainers quando adequado.

4. Princípios inegociáveis

O servidor decide todos os resultados.

O cliente envia intenções e nunca valores finais.

Regras não ficam em componentes React, renderizadores Babylon, rotas HTTP ou handlers WebSocket.

O game engine não depende de navegador, banco, framework ou rede.

Toda entrada externa é validada.

Comandos são idempotentes.

Cada partida processa comandos sequencialmente.

O estado possui versão crescente.

Conteúdo do tabuleiro é orientado a dados.

Uma queda de conexão não pode destruir a partida.

A experiência precisa funcionar por toque e em aparelhos modestos.

Nenhuma fase é concluída sem build, testes e documentação.

5. Estrutura esperada

apps/
  game-client/
  game-server/
  admin-web/
packages/
  game-engine/
  protocol/
  database/
  board-content/
  ui/
  config/
android/
ios/
docs/
docker/

Consulte ARCHITECTURE.md para a divisão interna.

6. Responsabilidade do cliente

Renderizar tabuleiro, peças, dados e efeitos.

Receber snapshots, patches e eventos.

Animar somente resultados confirmados.

Capturar clique, toque, zoom e rotação.

Mostrar apenas ações autorizadas pelo servidor.

Indicar perda de conexão e reconexão.

Adaptar qualidade gráfica.

O cliente não calcula saldo oficial, aluguel, movimento definitivo, propriedade, resultado dos dados ou vitória.

7. Responsabilidade do servidor

Autenticar e autorizar.

Criar, listar e encerrar salas.

Reservar vagas e controlar liderança.

Manter estado oficial.

Validar e enfileirar comandos.

Executar o game engine.

Sincronizar o estado permitido.

Proteger informações privadas.

Persistir snapshots e eventos importantes.

Recuperar partidas.

Resolver timeouts e desconexões.

8. Engine gráfica

Criar serviços independentes:

GameRenderer
SceneManager
BoardRenderer
PawnRenderer
DiceRenderer
BuildingRenderer
CameraController
InputManager
AnimationManager
AssetManager
AudioManager
PerformanceManager

Requisitos:

WebGPU quando suportado e estável.

WebGL 2 como fallback.

Perfis LOW, MEDIUM e HIGH.

GLB/GLTF.

KTX2/Basis quando adequado.

Draco ou Meshopt para compressão.

Instancing para objetos repetidos.

Carregamento progressivo.

Pausa ou redução de renderização em segundo plano.

Interface jogável em orientação horizontal no mobile.

9. Multiplayer

Criar:

LobbyRoom: espera, configurações, chat, pronto, peões e início.

GameRoom: partida autoritativa.

SpectatorRoom: somente numa fase futura.

Utilizar Colyseus Schema para o estado público e mensagens direcionadas para informações privadas.

Não transmitir estado em 20 ou 60 Hz sem necessidade. Este é um jogo de turnos: utilize patches e eventos quando houver alteração.

10. Persistência

Sala e partida possuem UUID.

Partida ativa pode ficar em memória no MVP.

Salvar snapshot no início, fim de turno, desconexão e ações críticas.

Salvar eventos relevantes com commandId único.

Restaurar a última versão consistente.

Preparar adapter Redis sem torná-lo obrigatório no MVP.

11. Conteúdo inicial

Criar seed do tema Baixada Santista com 36 casas iniciais, configuráveis. Os nomes geográficos são referências públicas; valores, cartas, descrições e dinâmica são originais.

As casas precisam incluir propriedades, transporte, serviços, tributos fictícios, eventos, benefícios, descanso, fiscalização temporária e início do circuito.

12. Documentos normativos

As decisões detalhadas estão em:

ARCHITECTURE.md

GAME_RULES.md

WEBSOCKET_PROTOCOL.md

DATABASE.md

SECURITY.md

DEPLOYMENT.md

ROADMAP.md

Se houver conflito, use esta prioridade:

Solicitação mais recente do usuário.

Segurança e integridade de dados.

MASTER_PROMPT.md.

Documentos especializados.

Convenções existentes do repositório.

Registre decisões novas em ADRs dentro de docs/adr/.

13. Método de execução

Antes de agir:

Inspecione o repositório.

Leia AGENTS.md, CLAUDE.md, README e configurações existentes.

Apresente o plano da fase.

Informe arquivos a criar ou alterar.

Preserve trabalho existente.

Durante:

Faça alterações pequenas e coerentes.

Não crie arquivos gigantes.

Não use any sem justificativa.

Não deixe stubs fingindo conclusão.

Não esconda erros.

Não adicione dependência sem explicar a finalidade.

Não altere o escopo silenciosamente.

Ao finalizar cada fase:

Rode typecheck.

Rode lint.

Rode testes.

Rode build.

Registre resultados reais.

Atualize documentação.

Liste pendências e riscos.

14. Primeira ordem

Execute somente a Fase 1 descrita em ROADMAP.md.

Entregue:

Diagnóstico do repositório.

Arquitetura final.

Diagrama de componentes.

Estrutura de pastas.

ADRs das decisões principais.

Fluxo de autenticação.

Fluxo de sala.

Fluxo de turno.

Estratégia de reconexão.

Esquema inicial do banco.

Contratos iniciais da rede.

Plano de testes.

Riscos.

Perguntas bloqueantes.

Não implemente a Fase 2 até receber autorização explícita.
