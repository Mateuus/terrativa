# Pesquisa de assets 3D e dados geográficos

Data da pesquisa: 2026-07-26  
Decisão: cenário low-poly estilizado no MVP, com geografia real usada como
referência e não como reprodução fotogramétrica.

## Fontes preferenciais de assets

| Fonte | Uso recomendado | Licença verificada | Observações |
|---|---|---|---|
| [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) | peões/personagens e animações | CC0 | glTF/FBX, rigged, atlas único e adequado a mobile |
| [Quaternius](https://quaternius.com/) | prédios, veículos, natureza e personagens | CC0 | catálogo amplo e coerente em low-poly |
| [Kenney](https://kenney.nl/assets) | kits urbanos, estradas, props e UI | CC0 nos assets publicados | conferir `License.txt` de cada download |

CC0 permite uso pessoal e comercial e não exige atribuição. Mesmo assim, o
projeto manterá créditos aos autores e o arquivo de licença de cada pack.

## Assets aplicados ao tabuleiro

- [Kenney Pirate Kit 2.1](https://kenney.nl/assets/pirate-kit): faixa de areia,
  palmeiras, pedras, píer e barco. O pack possui 70 modelos 3D e licença CC0.
  Somente oito GLBs necessários foram incorporados ao cliente.
- [Dice por RobinJ24](https://opengameart.org/content/dice-3): dado com pontos
  modelados em geometria, licença CC0. O OBJ/MTL foi convertido para GLB e
  quantizado para uso direto pelo Babylon.js, sem depender de decoder externo.

As palmeiras e pedras ficam na faixa externa de areia. O centro do jardim foi
liberado e recebeu uma praça plana exclusiva para a animação dos dois dados.
Manifestos, checksums e textos de licença ficam ao lado dos arquivos em
`apps/game-client/public/assets/vendor`.

Fontes como Sketchfab, Poly Pizza e marketplaces podem ser usadas somente após
verificação por modelo. Licenças CC-BY exigem crédito; licenças
NonCommercial/NoDerivatives ou termos que proíbam redistribuição não são aceitas
no bundle do jogo.

## Packs prioritários para avaliação visual

- [KayKit Forest](https://kaylousberg.itch.io/kaykit-forest): árvores, arbustos,
  pedras e composição do jardim central.
- [Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html):
  vegetação costeira e variações de terreno.
- [Ultimate Fantasy RTS](https://quaternius.com/packs/ultimatefantasyrts.html):
  estruturas e props estilizados que possam ser adaptados ao tabuleiro.
- [Modular Streets Pack](https://quaternius.com/packs/modularstreets.html):
  ruas, esquinas e calçadas do futuro modo Cidade 3D.
- [Cars Pack](https://quaternius.com/packs/cars.html): veículos do deslocamento
  entre pontos no futuro modo Cidade 3D.
- Kenney: `City Kit (Commercial)`, `City Kit (Suburban)`, `City Kit (Roads)` e
  `Modular Buildings`.
- KayKit Adventurers, Ultimate Modular Characters e Ultimate Modular Women para
  peões expressivos.

O tema visual final deve normalizar escala, orientação, materiais, paleta,
sombras e nomes. Misturar packs sem essa etapa gera aparência inconsistente.

## Pipeline de assets

```text
download original
  -> registrar origem/versão/licença/checksum
  -> importar no Blender quando necessário
  -> normalizar metros, origem e eixo Y-up
  -> reduzir materiais e consolidar atlas
  -> revisar animações e LOD
  -> exportar GLB
  -> comprimir Meshopt/Draco e KTX2 quando vantajoso
  -> validar tamanho, bounding box e fallback
  -> publicar com nome versionado e hash
```

Cada asset terá manifesto com:

- `id`, `source`, `sourceVersion`, `downloadedAt`;
- licença e caminho do texto legal;
- autor/crédito;
- checksum do original;
- transformações e ferramentas usadas;
- GLB final, tamanho, LOD e fallback.

Arquivos-fonte pesados não devem entrar automaticamente no bundle inicial. O
orçamento antes da partida permanece abaixo de 10 MB.

## Uso de geografia real

### Recomendado para o MVP

Usar:

- [OpenStreetMap](https://www.openstreetmap.org/copyright) para vias, costa,
  footprints e pontos relevantes;
- [IBGE](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html)
  para limites municipais e nomes oficiais;
- modelos próprios/CC0 para representar marcos de forma estilizada.

Os dados são processados offline para gerar uma rota fictícia simplificada. Não
serão enviados tiles geográficos completos durante a partida. A UI exibirá as
atribuições exigidas, e snapshots de fonte/licença ficarão versionados.

Fluxo proposto:

```text
OSM/IBGE -> recorte das nove cidades -> simplificação -> GeoJSON de referência
-> curvas/footprints estilizados -> meshes low-poly -> GLB do tema
```

Para o modo Cidade 3D, a extração deve interpretar `highway`, `lanes`,
`building`, `building:levels` e, quando disponíveis, as marcações de
`Simple 3D Buildings`. O processamento será offline e produzirá somente o
trecho jogável em volta da rota; não será criada toda a Baixada em 3D.

O MVP mantém dois modos de apresentação no contrato da sala:

- `BOARD`: tabuleiro 3D completo e prioritário;
- `CITY_3D`: opção persistida para o protótipo de ruas e carros, usando a base
  do tabuleiro enquanto o cenário urbano não estiver concluído.

Fotografias reais usadas na descrição de casas devem ficar locais no cliente e
ter autoria, origem e licença visíveis. A primeira imagem integrada é a do
Portinho, em Praia Grande, de Jacinto Alves de Souza, publicada no Wikimedia
Commons sob CC BY-SA 3.0.

Isso preserva identidade local, desempenho mobile e liberdade artística sem
alegar que o tabuleiro é uma reprodução exata.

### Google Earth e Photorealistic 3D Tiles

Não é permitido extrair, copiar, traçar ou redistribuir modelos do Google Earth.
Se uma experiência realista for criada, ela deve usar a
[Map Tiles API](https://developers.google.com/maps/documentation/tile/3d-tiles)
oficial em runtime.

Essa opção exige:

- projeto Google Cloud, billing e chave restrita;
- streaming online, quotas e custo por uso;
- logo e atribuições dinâmicas sempre visíveis;
- respeito a `Cache-Control`, sem download offline ou extração;
- objetos próprios claramente diferenciados dos dados Google.

Babylon.js recomenda
[3DTilesRendererJS](https://doc.babylonjs.com/features/featuresDeepDive/geospatial/loading3dTiles)
para carregar 3D Tiles. A integração é tecnicamente possível, mas adiciona
complexidade, largura de banda e uma estética fotorealista incompatível com o
tabuleiro low-poly.

Decisão: manter um adapter geoespacial futuro, sem dependência Google no MVP.

### Cesium OSM Buildings

[Cesium OSM Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/)
oferece edifícios globais derivados do OpenStreetMap em 3D Tiles. É uma opção
mais aberta para um modo de exploração, mas ainda depende de streaming, termos do
serviço, atribuição e orçamento de rede. Não será parte do loop principal do MVP.

## Direção recomendada

O tabuleiro será uma maquete low-poly da rota pela Baixada Santista:

- silhuetas e litoral inspirados em dados abertos;
- nove distritos visuais, um por cidade;
- prédios CC0 remixados e landmarks próprios;
- peões KayKit/Quaternius adaptados à paleta;
- nenhum valor imobiliário ou modelo urbano tratado como reprodução real;
- modo fotorealista somente como experimento separado e configurável no futuro.
