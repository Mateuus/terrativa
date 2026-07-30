# Módulos comunitários do Terrativa

## Princípio

`Terrativa` é o núcleo do jogo. Regiões são módulos de conteúdo independentes:

```text
Terrativa
├── Terrativa: Baixada Santista
├── Terrativa: Baixada Fluminense
├── Terrativa: Vale do Paraíba
└── módulos criados pela comunidade
```

O núcleo fornece engine, multiplayer, contas, salas, ranking, renderização e
ferramentas. Um módulo fornece manifesto, tabuleiros, cidades, casas, grupos,
economia fictícia, cartas, textos, referências e assets.

Um módulo pode conter mais de um tabuleiro. Nenhuma regra do núcleo depende do
slug `baixada-santista`.

## Contrato

O formato `TerrativaModule` possui:

```ts
interface TerrativaModule {
  moduleApiVersion: 1;
  slug: string;
  name: string;
  summary: string;
  version: string;
  engineCompatibility: string;
  locale: string;
  territory: {
    countryCode: string;
    subdivisionCodes: string[];
    regionName: string;
  };
  authors: Array<{ name: string; url?: string }>;
  license: {
    code: string;
    content: string;
    assets: string;
  };
  repositoryUrl?: string;
  homepageUrl?: string;
  attribution: string;
  boards: BoardContent[];
}
```

Versão, licenças e compatibilidade são parte do manifesto. Módulos comunitários
registrados precisam obrigatoriamente informar `repositoryUrl`. O módulo oficial
local pode ser desenvolvido antes da publicação do repositório.

## Segurança

Módulos são pacotes de dados, não plugins de código.

Não são aceitos:

- funções de inicialização;
- scripts;
- acesso ao sistema de arquivos;
- código para servidor ou cliente;
- HTML executável;
- URLs usadas para carregar JavaScript;
- regras que substituam validações autoritativas da engine.

O schema Zod é estrito e rejeita campos desconhecidos. A importação lê JSON,
valida checksum SHA-256, valida o manifesto, valida cada tabuleiro e executa as
invariantes da engine antes da publicação.

Essa separação permite conteúdo comunitário sem dar execução arbitrária ao
autor do módulo.

## Registry

```ts
import {
  createModuleRegistry,
  terrativaModuleRegistry,
} from "@terrativa/board-content";

const official = terrativaModuleRegistry.list();
const board = terrativaModuleRegistry.getBoard("baixada-santista");

const registry = createModuleRegistry(
  [officialModule, communityModule],
  ["baixada-santista"],
);
```

O registry impede:

- slug de módulo duplicado;
- ID ou slug de tabuleiro duplicado;
- módulo comunitário sem repositório;
- referência a módulo oficial não registrado.

O campo `official` é calculado pelo registry e não pode ser autodeclarado por um
módulo comunitário.

## Criando um módulo

1. Faça um fork do projeto.
2. Crie uma pasta própria em `packages/board-content/src/modules/<slug>`.
3. Defina o manifesto e ao menos um `BoardContent`.
4. Use UUIDs estáveis e slugs exclusivos.
5. Declare autores, repositório e licenças SPDX.
6. Use apenas valores econômicos fictícios.
7. Registre fontes de geografia, história e cultura.
8. Inclua licença e origem de cada asset.
9. Exporte o módulo e registre o checksum.
10. Execute validação, testes e simulações.
11. Abra um pull request para inclusão no catálogo comunitário.

Comandos obrigatórios:

```bash
corepack pnpm --filter @terrativa/board-content test
corepack pnpm validate
```

## Exemplo de manifesto

```ts
import {
  terrativaModuleSchema,
  type TerrativaModule,
} from "@terrativa/board-content";

export const baixadaFluminenseModule: TerrativaModule =
  terrativaModuleSchema.parse({
    moduleApiVersion: 1,
    slug: "baixada-fluminense",
    name: "Terrativa: Baixada Fluminense",
    summary: "Rota comunitária original inspirada na Baixada Fluminense.",
    version: "1.0.0",
    engineCompatibility: "^0.1.0",
    locale: "pt-BR",
    territory: {
      countryCode: "BR",
      subdivisionCodes: ["BR-RJ"],
      regionName: "Baixada Fluminense",
    },
    authors: [{ name: "Nome da comunidade" }],
    license: {
      code: "MIT",
      content: "CC-BY-4.0",
      assets: "CC0-1.0",
    },
    repositoryUrl:
      "https://provedor.example/comunidade/terrativa-baixada-fluminense",
    attribution: "Conteúdo original criado pela comunidade.",
    boards: [baixadaFluminenseBoard],
  });
```

O endereço do exemplo é ilustrativo. Uma contribuição real deve apontar para o
repositório público verdadeiro.

## Importação e exportação

```ts
const artifact = exportTerrativaModule(module);
const imported = importTerrativaModule(artifact.json, artifact.checksum);
```

A serialização é canônica: o mesmo conteúdo e a mesma versão produzem o mesmo
checksum. Alterações exigem nova versão e novo checksum.

## Curadoria

Um módulo comunitário não se torna oficial automaticamente. O catálogo deverá
distinguir:

- `official`: mantido pelo projeto Terrativa;
- `community`: publicado por terceiros e aprovado no catálogo;
- `local`: importado pelo operador para testes;
- `disabled`: incompatível, removido ou aguardando revisão.

A inclusão deve revisar:

- originalidade;
- licenças;
- segurança;
- qualidade dos textos;
- acessibilidade;
- consistência geográfica;
- ausência de marcas ou imagens não autorizadas;
- economia claramente fictícia;
- resultado das simulações;
- compatibilidade de engine.

Rankings oficiais devem informar o módulo e a versão permitidos. Uma partida
com módulo local ou modificado não entra no ranking oficial.

## Mapa regional opcional

Um módulo pode declarar `mapViews`, com no máximo uma visão por `boardSlug`.
Centro, limites, cidades e percurso ficam no pacote do próprio módulo. O cliente
resolve esse conteúdo pelo registro e não exige alterações no renderer para cada
nova região. O mapa é opcional: módulos sem `mapViews` continuam funcionando no
tabuleiro 3D.
