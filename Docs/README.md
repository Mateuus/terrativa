# Documentação da Terrativa

Este diretório reúne as decisões funcionais, técnicas e operacionais da plataforma Terrativa e do primeiro território oficial, **Baixada Santista**.

## Visão geral

| Documento | Conteúdo |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | arquitetura, limites e fluxo entre componentes |
| [GAME_RULES.md](./GAME_RULES.md) | regras, turnos, propriedades e vitória |
| [WEBSOCKET_PROTOCOL.md](./WEBSOCKET_PROTOCOL.md) | mensagens, versões e idempotência |
| [DATABASE.md](./DATABASE.md) | modelo e estratégia de persistência |
| [SECURITY.md](./SECURITY.md) | ameaças, controles e checklist técnico |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | ambientes e implantação |
| [ROADMAP.md](./ROADMAP.md) | fases e próximos marcos |
| [COMMUNITY_MODULES.md](./COMMUNITY_MODULES.md) | criação de territórios comunitários |
| [TERRATIVA_BRAND.md](./TERRATIVA_BRAND.md) | identidade e uso da marca |
| [ASSET_RESEARCH.md](./ASSET_RESEARCH.md) | pesquisa, origem e licenças de assets |

## Implementação por fases

| Fase | Documento | Situação |
| ---: | --- | --- |
| 1 | [Descoberta e arquitetura](./PHASE_1_ARCHITECTURE.md) | concluída |
| 2 | [Fundação do monorepo](./PHASE_2_FOUNDATION.md) | concluída |
| 3 | [Conta e segurança](./PHASE_3_AUTH.md) | implementada |
| 4 | [Lobby e salas](./PHASE_4_LOBBY.md) | implementada |
| 5 | [Game engine e ranking](./PHASE_5_ENGINE.md) | implementada |
| 6 | [Conteúdo Baixada Santista](./PHASE_6_CONTENT.md) | concluída |
| 7 | [Integração multiplayer](./PHASE_7_MULTIPLAYER.md) | concluída |
| 8 | [Mapa e renderer 3D](./PHASE_8_MAP_AND_RENDERER.md) | em evolução |
| 9 | [Administração e World Studio](./PHASE_9_WORLD_STUDIO.md) | em evolução |

O estudo de progressão contínua está em [CONTINUOUS_MANAGEMENT_GAMEPLAY.md](./CONTINUOUS_MANAGEMENT_GAMEPLAY.md).

## Decisões arquiteturais

Os ADRs registram decisões que não devem ser alteradas sem uma nova análise:

1. [Monorepo e limites](./adr/0001-monorepo-e-limites.md)
2. [Servidor autoritativo e engine determinística](./adr/0002-servidor-autoritativo-e-engine-deterministica.md)
3. [Concorrência, versão e idempotência](./adr/0003-concorrencia-versao-e-idempotencia.md)
4. [Persistência híbrida](./adr/0004-persistencia-hibrida.md)
5. [Autenticação e sessões](./adr/0005-autenticacao-e-sessoes.md)
6. [Identificadores e valores](./adr/0006-identificadores-e-valores.md)
7. [Assets e geografia](./adr/0007-assets-e-geografia.md)

## Princípios permanentes

- servidor autoritativo para toda ação relevante;
- regras puras e determinísticas no game engine;
- contratos compartilhados e validados;
- conteúdo regional separado do núcleo;
- valores fictícios, sem dinheiro real ou apostas;
- assets com origem e licença verificáveis;
- segurança, acessibilidade e desempenho tratados como requisitos;
- mudanças acompanhadas de testes e documentação.

## Contribuições

Leia [CONTRIBUTING.md](../CONTRIBUTING.md) antes de propor alterações. Mudanças de arquitetura devem atualizar o documento correspondente e, quando necessário, adicionar um novo ADR.

Vulnerabilidades seguem o processo privado definido em [SECURITY.md](../SECURITY.md).

