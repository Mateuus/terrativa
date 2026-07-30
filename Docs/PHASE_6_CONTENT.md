# Fase 6 — Conteúdo Baixada Santista

Status: implementada, persistida e validada.

## Resultado

O pacote `Terrativa: Baixada Santista` passou da fundação de metadados para um
conteúdo jogável e versionado:

- schema Zod estrito com `schemaVersion: 1`;
- mapa na versão 2;
- 36 casas contínuas;
- nove cidades com quatro casas cada;
- 11 grupos;
- 23 propriedades compráveis;
- dois baralhos e 16 cartas;
- preços, hipotecas, quitações, aluguéis e melhorias;
- textos educativos curtos;
- asset principal e fallback obrigatório em todas as casas;
- conversão validada para `BoardDefinition` da engine;
- importação e exportação JSON canônica com checksum SHA-256;
- simulador determinístico de balanceamento.

Todos os valores econômicos são fictícios. Eles não representam preço de
imóvel, aluguel, serviço público ou custo de vida real.

## Distribuição das 36 casas

| Posições | Cidade | Conteúdo |
| --- | --- | --- |
| 0–3 | Santos | Portal da Baixada, Canais de Santos, Maré Regional, Monte Serrat |
| 4–7 | São Vicente | Ponte Pênsil, Praça Comunitária, Ilha Porchat, Travessia Vicentina |
| 8–11 | Praia Grande | Fortaleza de Itaipu, Portinho, Manutenção da Orla, Circuito de Ciclovias |
| 12–15 | Guarujá | Forte dos Andradas, Pitangueiras, Mudança de Maré, Travessia do Estuário |
| 16–19 | Cubatão | Serra do Mar, Fiscalização Regional, Parque Anilinas, Centro de Gestão Ambiental |
| 20–23 | Bertioga | Forte São João, Encontro das Águas, Restinga de Itaguaré, Travessia do Canal |
| 24–27 | Mongaguá | Poço das Antas, Plataforma de Pesca, Parque Ecológico, Pausa na Orla |
| 28–31 | Itanhaém | Cama de Anchieta, Convento da Conceição, Conservação Histórica, Rota Cultural |
| 32–35 | Peruíbe | Ruínas do Abarebebê, Centro de Conservação Costeira, Guaraú e Jureia, Mirante da Rota |

Há nove grupos territoriais, um grupo de mobilidade regional e um grupo de
conservação costeira. Cada grupo possui cor, custo de melhoria, nível máximo e
referências verificadas.

## Economia inicial

O saldo inicial permanece em 1.500 créditos e o bônus de volta em 200.
Propriedades territoriais custam entre 120 e 360 créditos. As travessias custam
200 e os serviços de conservação custam 170.

Cada propriedade contém cinco valores de aluguel, correspondentes aos níveis
0–4. A hipoteca equivale a 50% do preço e a quitação equivale a 55%, criando uma
taxa interna de 10% sobre o valor hipotecado.

Esses números são um baseline de jogo. O checksum do conteúdo aplicado no banco
é:

```text
845d12745a7e4e69c62dee1f96e21df78d136d9b4a74112be95ff2fd723c0670
```

## Validação

O schema rejeita:

- IDs, posições, cidades, grupos, propriedades, cartas ou baralhos duplicados;
- posições descontínuas;
- ausência ou duplicidade da casa inicial;
- fiscalização apontando para casa incorreta;
- propriedade sem grupo;
- grupo sem propriedade;
- tabela de aluguel incompatível com o nível máximo;
- preço, hipoteca ou quitação incoerentes;
- taxa sem valor;
- movimento para posição inexistente;
- baralho sem carta ativa;
- asset sem fallback.

Depois do Zod, o adaptador executa também `validateBoardDefinition` da engine.
Assim, um pacote aceito pelo editor respeita as mesmas invariantes usadas numa
partida.

## Importação e exportação

```ts
import {
  baixadaSantistaContent,
  exportBoardContent,
  importBoardContent,
} from "@terrativa/board-content";

const exported = exportBoardContent(baixadaSantistaContent);
const imported = importBoardContent(exported.json, exported.checksum);
```

A exportação ordena as chaves de forma determinística e termina com quebra de
linha. A importação pode exigir o checksum esperado e sempre revalida o schema.

## Persistência

O comando abaixo é explícito e idempotente:

```bash
corepack pnpm db:seed-foundation
```

O seed ativa tema e board, mantém os IDs estáveis e grava:

```text
36 casas / 11 grupos / 23 propriedades / 2 baralhos / 16 cartas
```

O modelo Prisma criado nas fases anteriores já suportava todo o pacote. Portanto,
a Fase 6 não exigiu nova migration. As três migrations existentes permanecem
aplicadas, sem pendências.

## Simulação de balanceamento

Foram executadas 500 partidas com quatro jogadores, seed determinística e bots
que compram, constroem, vendem melhorias, hipotecam e declaram falência quando
necessário.

| Métrica | Resultado |
| --- | ---: |
| Partidas concluídas | 500/500 |
| Estados impossíveis | 0 |
| Rodadas médias | 61 |
| Compras médias | 22,986 |
| Melhorias médias | 15,674 |
| Falências médias | 0,316 |
| Maior participação de uma posição inicial nas vitórias | 29% |

O limite configurado é de 60 rodadas; a engine encerra na transição seguinte,
por isso o relatório registra média de 61. A distribuição de vitórias por ordem
inicial foi 145, 121, 129 e 105.

O simulador é um instrumento de regressão, não prova de balanceamento final.
Telemetria de jogadores reais será necessária para ajustar decisão de compra,
aluguel, frequência das cartas e duração.

## Referências regionais

Os nomes e textos curtos foram inspirados em fontes institucionais. Por exemplo,
Santos apresenta orla, centro histórico e Monte Serrat em seu portal
[Conheça Santos](https://www.santos.sp.gov.br/?q=hotsite%2Fconheca-santos);
Praia Grande documenta orla, ciclovias, Portinho e Fortaleza de Itaipu em seu
[portal de turismo](https://turismo.praiagrande.sp.gov.br/); Mongaguá lista
Poço das Antas e Plataforma de Pesca em
[Turismo Mongaguá](https://mongagua.sp.gov.br/turismo); Itanhaém descreve a
[Cama de Anchieta](https://www2.itanhaem.sp.gov.br/turismo/cama-de-anchieta/);
e Peruíbe apresenta Guaraú, Jureia e seu patrimônio em
[Cidade de Peruíbe](https://www.peruibe.sp.gov.br/cidade-de-peruibe/).

O conteúdo não copia mapas, brasões, fotografias, logotipos ou modelos oficiais.
Os nomes geográficos servem como inspiração para uma rota estilizada e
ficcional.

## Limite da fase

A Fase 6 entrega o primeiro módulo oficial, não um mapa fixo no núcleo. O
contrato, registry e fluxo de contribuição estão em `COMMUNITY_MODULES.md`.

A fase entrega conteúdo e balanceamento sem interface administrativa. A
`GameRoom`, snapshots, reconexão e fila oficial continuam na Fase 7. O renderer
3D orientado pelo pacote entra na Fase 8.
