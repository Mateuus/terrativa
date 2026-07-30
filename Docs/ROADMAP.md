Roadmap

Fase 1 — Descoberta e arquitetura

Entregas:

inspeção do repositório;

arquitetura e limites;

ADRs;

modelo de domínio;

esquema inicial;

protocolo;

wireflow de telas;

plano de testes;

riscos e dúvidas bloqueantes.

Critério: documentação aprovada. Não produzir implementação completa.

Fase 2 — Fundação do monorepo

pnpm e Turborepo;

Vite/React;

Babylon bootstrap;

Fastify/Colyseus;

packages compartilhados;

Prisma/MySQL;

Docker Compose;

Biome, Vitest e CI.

Critério: cliente abre cena vazia, servidor responde health, banco migra, typecheck/lint/test/build passam.

Fase 3 — Conta e segurança

cadastro;

login;

logout;

refresh rotation;

perfil;

guards HTTP/room;

rate limits;

testes de abuso básico.

Critério: fluxo completo testado sem exposição de tokens.

Fase 4 — Lobby e salas

criar/listar/entrar/sair;

pública/privada;

senha e código;

reserva;

host;

pronto;

peão/cor;

chat;

expiração.

Critério: dois navegadores chegam ao lobby e recebem estado coerente.

Fase 5 — Game engine

modelo de estado;

máquina de turnos;

RNG determinístico;

movimento;

propriedades;

aluguel;

melhorias;

hipoteca;

cartas;

dívida;

falência;

vitória;

negociações.

Critério: cobertura de regras críticas e simulações completas sem UI.

Fase 6 — Conteúdo Baixada Santista

Status: concluída. Consulte `PHASE_6_CONTENT.md`.

schema de conteúdo;

validador;

36 casas;

grupos;

cartas;

preços iniciais;

simulador de balanceamento;

import/export.

Critério: seed válido e partidas simuladas sem estados impossíveis.

Fase 7 — Integração multiplayer

Status: concluída. Consulte `PHASE_7_MULTIPLAYER.md`.

GameRoom;

fila por partida;

comandos;

idempotência;

state version;

snapshots;

eventos privados;

timeout;

reconexão;

recuperação após reinício.

Critério: testes com queda de conexão e comandos duplicados.

Fase 8 — Tabuleiro 3D e HUD

Status: iniciada em 26 de julho de 2026. A base modular de mapas reais,
tabuleiro procedural e seleção automática de módulos está implementada; consulte
`PHASE_8_MAP_AND_RENDERER.md`.

board renderer;

câmera;

picking;

peões;

dados;

construções;

animações;

HUD;

modais;

chat;

negociação;

perfis gráficos.

Critério: jogável em desktop e Android intermediário.

Fase 9 — PWA e Capacitor

PWA;

Android;

iOS;

safe areas;

back button;

deep links;

resume/reconnect;

orientação;

testes em dispositivos.

Critério: link de convite abre navegador/app e permite retomar sala.

Fase 10 — Administração

usuários;

temas;

boards;

casas;

cartas;

auditoria;

salas ativas;

encerramento operacional.

Critério: conteúdo pode ser editado sem alterar código e com histórico.

Fase 11 — Produção

E2E;

carga;

segurança;

acessibilidade;

observabilidade;

backup;

staging;

CI/CD;

release.

Critério: checklist de produção aprovado e restauração testada.

Pós-MVP

espectadores;

bots;

leilão opcional;

ranking sazonal sem prêmio financeiro;

amigos e convites;

replay por eventos;

novos temas;

cosméticos;

modo assíncrono;

localização;

torneios recreativos sem aposta ou recompensa financeira.

Riscos principais

Risco

Mitigação

Escopo grande

Fases e critérios rígidos

Trapaça

Servidor autoritativo

Duplicação de ação

commandId, fila e transação

Reconexão inconsistente

snapshot e stateVersion

Mobile fraco

perfis e orçamento de assets

Regra impossível

máquina de estados e testes

Conteúdo desbalanceado

simulador e telemetria

Problema de marca

identidade e conteúdo originais

Room perdida no reinício

snapshots e recuperação

Decisões que o responsável deverá confirmar

Nome final do jogo.

Visual 3D estilizado ou 2.5D.

Duração desejada: 30, 60 ou 90 minutos.

Recusa de compra deixa livre ou abre leilão.

Política de jogador desconectado.

Se negociações são permitidas durante dívida.

Lista final das 36 casas.

Prioridade inicial: navegador ou Android.

Hospedagem pretendida.

Necessidade de e-mail no MVP.

