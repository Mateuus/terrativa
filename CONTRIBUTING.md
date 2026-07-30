# Contribuindo com a Terrativa

Obrigado por ajudar a construir a Terrativa. Este guia define o fluxo esperado para código, documentação, assets e módulos regionais.

## Antes de começar

- Leia o [Código de Conduta](./CODE_OF_CONDUCT.md).
- Pesquise as [issues existentes](https://github.com/Mateuus/terrativa/issues).
- Para mudanças grandes, abra primeiro uma discussão ou issue descrevendo objetivo, escopo e alternativas.
- Nunca publique segredos, dados pessoais, tokens, arquivos `.env` ou conteúdo sem licença compatível.

Correções pequenas, testes e documentação podem seguir diretamente para um Pull Request.

## Ambiente de desenvolvimento

```bash
git clone https://github.com/Mateuus/terrativa.git
cd terrativa
corepack enable
corepack pnpm install
```

Copie `.env.example` para `.env`, preencha valores locais e consulte o [README](./README.md#-começando) para preparar banco e serviços.

## Branches

Crie sua branch a partir de `main` e mantenha o escopo claro:

```text
feat/nome-curto
fix/nome-curto
docs/nome-curto
test/nome-curto
refactor/nome-curto
```

Atualize sua branch antes de pedir revisão. Não inclua formatações ou refatorações sem relação com a mudança.

## Commits

Prefira mensagens no padrão Conventional Commits:

```text
feat(studio): adiciona ferramenta de rios
fix(client): corrige orientação do personagem
docs: documenta criação de módulos regionais
test(engine): cobre falência durante negociação
```

Tipos recomendados: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci` e `chore`.

Commits devem ser compreensíveis, não conter código gerado desnecessário e não misturar mudanças independentes.

## Regras de código

- Preserve o modo estrito do TypeScript.
- Valide entradas externas com os schemas existentes.
- Regras de jogo devem permanecer puras e determinísticas em `packages/game-engine`.
- O servidor é a autoridade para dados, turnos, movimento, saldo e estado da partida.
- Não introduza dependência entre pacotes que viole os limites descritos em `Docs/ARCHITECTURE.md`.
- Mudanças de comportamento precisam de testes.
- Mudanças públicas precisam de documentação.
- Evite APIs inseguras, credenciais hardcoded e logs com dados sensíveis.

## Banco de dados

- Nunca edite uma migration já publicada.
- Crie uma nova migration para cada mudança de schema.
- Verifique compatibilidade com dados existentes.
- Documente estratégia de implantação e reversão quando houver risco.
- Não use dados pessoais reais em seeds ou testes.

## UI e World Studio

Pull Requests visuais devem incluir capturas ou gravações antes/depois. Verifique:

- estados vazio, carregando, erro e sucesso;
- navegação por teclado e foco visível;
- tamanhos de tela relevantes;
- ausência de regressões no viewport 3D;
- atalhos já reservados pelo Studio;
- desempenho com cenas maiores.

## Assets, áudio e módulos regionais

Todo asset deve informar:

- autor e origem;
- URL original;
- licença e versão;
- alterações ou conversões realizadas;
- tamanho e formato;
- pasta de destino adequada.

Não envie material extraído de jogos, filmes, marcas ou pacotes sem permissão. Dê preferência a CC0, domínio público ou conteúdo original. A licença deve acompanhar o asset no repositório.

Módulos regionais devem seguir [Docs/COMMUNITY_MODULES.md](./Docs/COMMUNITY_MODULES.md) e não podem depender de alteração no núcleo para funcionar.

## Verificação obrigatória

Execute antes do Pull Request:

```bash
corepack pnpm validate
```

O CI deve concluir typecheck, lint, testes, validação Prisma e build. Se algum teste não puder ser executado localmente, explique o motivo no Pull Request.

## Regras de Pull Request

- Um Pull Request deve resolver um problema principal.
- Use um título claro, de preferência no padrão dos commits.
- Relacione a issue com `Closes #123` quando aplicável.
- Descreva contexto, solução, testes, riscos e impacto de migração.
- Marque como Draft enquanto estiver incompleto.
- Não force revisão de código quebrado ou com CI falhando.
- Responda aos comentários de revisão ou explique tecnicamente por que não se aplicam.
- Não resolva conversas de revisão sem tratar o ponto discutido.
- Pelo menos uma aprovação de mantenedor é necessária.
- O CI deve estar verde e as conversas precisam estar resolvidas antes do merge.
- O mantenedor pode solicitar squash ou reorganização dos commits.

Pull Requests podem ser encerrados quando estiverem abandonados, fugirem do escopo do projeto, violarem licenças ou não responderem às revisões após tentativas razoáveis de contato.

## Licença das contribuições

Ao enviar uma contribuição, você declara ter direito de fazê-lo e concorda que ela seja distribuída sob a [Licença MIT](./LICENSE). Assets de terceiros continuam sujeitos às próprias licenças.

