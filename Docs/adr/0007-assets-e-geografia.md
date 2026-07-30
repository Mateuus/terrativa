# ADR 0007 — Assets low-poly e geografia

Status: aceito  
Data: 2026-07-26

## Contexto

O jogo precisa comunicar a Baixada Santista, funcionar em mobile e manter
identidade própria. Existem packs públicos de alta qualidade e serviços capazes
de transmitir cidades reais, mas suas licenças, custo e perfil de desempenho são
diferentes.

## Decisão

O MVP usa cenário low-poly criado a partir de assets CC0, priorizando KayKit,
Quaternius e Kenney. Cada item terá manifesto de origem, licença, checksum e
transformações. O bundle usa GLB e materiais/atlases normalizados.

OpenStreetMap e IBGE podem orientar costa, vias, limites e landmarks. A geometria
será simplificada e estilizada offline, com atribuição e rastreabilidade das
fontes.

Google Earth não é fonte de modelos extraíveis. Photorealistic 3D Tiles só poderá
ser consumido pela API oficial, em runtime e num modo futuro separado. Um adapter
de 3D Tiles poderá usar 3DTilesRendererJS/Babylon sem entrar no núcleo do jogo.

## Consequências

O tabuleiro ganha coerência artística, baixo peso e previsibilidade de custo.
Haverá trabalho de normalização para combinar packs. Licenças continuam
auditáveis mesmo quando CC0 não exige crédito. Um modo realista futuro terá
atribuição, billing, rede e política próprios, sem comprometer o MVP.

## Alternativas rejeitadas

- Copiar modelos do Google Earth: incompatível com os termos de uso.
- Usar Photorealistic 3D Tiles como tabuleiro principal: custo, dependência
  online, peso e estética inadequados ao MVP.
- Aceitar qualquer asset “gratuito”: gratuidade não garante redistribuição ou
  uso comercial.
