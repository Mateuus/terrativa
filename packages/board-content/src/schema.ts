import { z } from "zod";

const slugSchema = z.string().regex(/^[a-z0-9-]+$/);
const colorSchema = z.string().regex(/^#[0-9A-F]{6}$/i);
const safeCreditsSchema = z.int().min(0).max(1_000_000);

export const tileTypeSchema = z.enum([
  "START",
  "PROPERTY",
  "TRANSPORT",
  "UTILITY",
  "REGIONAL_EVENT",
  "COMMUNITY_BENEFIT",
  "MUNICIPAL_FEE",
  "INSPECTION",
  "VISITING",
  "REST",
  "MOVE",
]);

export const cardDeckTypeSchema = z.enum(["REGIONAL_EVENT", "COMMUNITY_BENEFIT"]);

export const cardEffectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("RECEIVE"), amount: safeCreditsSchema.positive() }).strict(),
  z.object({ type: z.literal("PAY"), amount: safeCreditsSchema.positive() }).strict(),
  z
    .object({
      type: z.literal("MOVE_TO"),
      position: z.int().min(0).max(119),
      collectPassStart: z.boolean(),
    })
    .strict(),
  z
    .object({ type: z.literal("MOVE_STEPS"), steps: z.int().min(-35).max(35).refine(Boolean) })
    .strict(),
  z.object({ type: z.literal("GET_OUT_OF_INSPECTION") }).strict(),
  z
    .object({
      type: z.literal("REPAIRS"),
      amountPerUpgrade: safeCreditsSchema.positive(),
    })
    .strict(),
]);

export const citySchema = z
  .object({
    key: slugSchema,
    name: z.string().min(2).max(80),
    accentColor: colorSchema,
    introduction: z.string().min(20).max(360),
  })
  .strict();

export const propertyGroupSchema = z
  .object({
    id: z.uuid(),
    key: slugSchema,
    name: z.string().min(2).max(120),
    color: colorSchema,
    upgradeCost: safeCreditsSchema.positive(),
    maxLevel: z.int().min(0).max(8),
    category: z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/),
  })
  .strict();

export const propertyContentSchema = z
  .object({
    id: z.uuid(),
    groupKey: slugSchema,
    purchasePrice: safeCreditsSchema.positive(),
    mortgageValue: safeCreditsSchema.positive(),
    unmortgageCost: safeCreditsSchema.positive(),
    rentByLevel: z.array(safeCreditsSchema).min(1).max(9),
  })
  .strict();

export const tileSchema = z
  .object({
    id: z.uuid(),
    position: z.int().min(0).max(119),
    type: tileTypeSchema,
    name: z.string().min(2).max(120),
    description: z.string().min(20).max(500),
    educationalText: z.string().min(20).max(500),
    cityKey: slugSchema,
    asset: z
      .object({
        key: z.string().min(3).max(160),
        fallbackKey: z.string().min(3).max(160),
      })
      .strict(),
    media: z
      .object({
        imageUrl: z.string().min(3).max(500),
        alt: z.string().min(3).max(240),
        credit: z.string().min(3).max(240),
        sourceUrl: z.url(),
        license: z.string().min(2).max(80),
      })
      .strict()
      .nullable(),
    property: propertyContentSchema.nullable(),
    amount: safeCreditsSchema.nullable(),
    targetPosition: z.int().min(0).max(119).nullable(),
    collectPassStart: z.boolean(),
  })
  .strict();

export const cardSchema = z
  .object({
    id: z.uuid(),
    key: slugSchema,
    title: z.string().min(2).max(120),
    publicText: z.string().min(10).max(500),
    educationalText: z.string().min(10).max(500),
    effect: cardEffectSchema,
    tradable: z.boolean(),
    enabled: z.boolean(),
  })
  .strict();

export const cardDeckSchema = z
  .object({
    id: z.uuid(),
    type: cardDeckTypeSchema,
    name: z.string().min(2).max(120),
    cards: z.array(cardSchema).min(1).max(80),
  })
  .strict();

export const boardContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.uuid(),
    slug: slugSchema,
    name: z.string().min(2).max(120),
    edition: z.string().min(2).max(120),
    locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
    version: z.int().positive(),
    tileCount: z.int().min(4).max(120),
    startingBalance: safeCreditsSchema.positive(),
    passStartReward: safeCreditsSchema.positive(),
    inspectionPosition: z.int().min(0).max(119),
    economyDisclaimer: z.string().min(40).max(500),
    rules: z
      .object({
        inspectionFee: safeCreditsSchema.positive(),
        maxInspectionTurns: z.int().min(1).max(10),
        purchaseDecisionMs: z.int().min(1_000).max(300_000),
        tradeExpiryMs: z.int().min(1_000).max(600_000),
        maxRounds: z.int().min(5).max(500).nullable(),
      })
      .strict(),
    sources: z.array(
      z
        .object({
          label: z.string().min(2).max(120),
          url: z.url(),
          usage: z.string().min(10).max(240),
        })
        .strict(),
    ),
    cities: z.array(citySchema),
    groups: z.array(propertyGroupSchema),
    tiles: z.array(tileSchema),
    decks: z.array(cardDeckSchema),
  })
  .strict()
  .superRefine((content, context) => {
    checkUnique(
      content.cities.map((city) => city.key),
      "cidade",
      context,
    );
    checkUnique(
      content.groups.map((group) => group.id),
      "ID de grupo",
      context,
    );
    checkUnique(
      content.groups.map((group) => group.key),
      "chave de grupo",
      context,
    );
    checkUnique(
      content.tiles.map((tile) => tile.id),
      "ID de casa",
      context,
    );
    checkUnique(
      content.tiles.map((tile) => String(tile.position)),
      "posição de casa",
      context,
    );
    checkUnique(
      content.decks.map((deck) => deck.id),
      "ID de baralho",
      context,
    );
    checkUnique(
      content.decks.map((deck) => deck.type),
      "tipo de baralho",
      context,
    );
    checkUnique(
      content.decks.flatMap((deck) => deck.cards.map((card) => card.id)),
      "ID de carta",
      context,
    );
    checkUnique(
      content.decks.flatMap((deck) => deck.cards.map((card) => card.key)),
      "chave de carta",
      context,
    );

    if (content.tiles.length !== content.tileCount) {
      issue(context, "tileCount deve corresponder à quantidade de casas");
    }
    const positions = content.tiles
      .map((tile) => tile.position)
      .sort((left, right) => left - right);
    if (positions.some((position, index) => position !== index)) {
      issue(context, "as posições devem ser contínuas e começar em zero");
    }
    if (content.tiles.filter((tile) => tile.type === "START").length !== 1) {
      issue(context, "o tabuleiro deve possuir exatamente uma casa START");
    }
    if (content.inspectionPosition >= content.tileCount) {
      issue(context, "inspectionPosition deve apontar para uma casa existente");
    } else if (content.tiles[content.inspectionPosition]?.type !== "INSPECTION") {
      issue(context, "inspectionPosition deve apontar para uma casa INSPECTION");
    }

    const cityKeys = new Set(content.cities.map((city) => city.key));
    const cityTileCounts = new Map(content.cities.map((city) => [city.key, 0]));
    const groupByKey = new Map(content.groups.map((group) => [group.key, group]));
    const propertyIds: string[] = [];
    const propertyCountByGroup = new Map(content.groups.map((group) => [group.key, 0]));
    for (const tile of content.tiles) {
      if (!cityKeys.has(tile.cityKey)) {
        issue(context, `a casa ${tile.position} referencia uma cidade inexistente`);
      } else {
        cityTileCounts.set(tile.cityKey, (cityTileCounts.get(tile.cityKey) ?? 0) + 1);
      }
      const ownable = ["PROPERTY", "TRANSPORT", "UTILITY"].includes(tile.type);
      if (ownable !== (tile.property !== null)) {
        issue(context, `a casa ${tile.position} possui definição de propriedade incompatível`);
      }
      if (tile.property) {
        propertyIds.push(tile.property.id);
        const group = groupByKey.get(tile.property.groupKey);
        if (!group) {
          issue(context, `a propriedade da casa ${tile.position} referencia grupo inexistente`);
        } else {
          propertyCountByGroup.set(group.key, (propertyCountByGroup.get(group.key) ?? 0) + 1);
          if (tile.property.rentByLevel.length !== group.maxLevel + 1) {
            issue(context, `a propriedade da casa ${tile.position} não possui aluguel por nível`);
          }
        }
        if (tile.property.mortgageValue >= tile.property.purchasePrice) {
          issue(context, `a hipoteca da casa ${tile.position} deve ser menor que o preço`);
        }
        if (tile.property.unmortgageCost <= tile.property.mortgageValue) {
          issue(context, `a quitação da casa ${tile.position} deve incluir custo adicional`);
        }
      }
      if ((tile.type === "MUNICIPAL_FEE") !== (tile.amount !== null)) {
        issue(context, `a casa ${tile.position} possui taxa incompatível`);
      }
      if ((tile.type === "MOVE") !== (tile.targetPosition !== null)) {
        issue(context, `a casa ${tile.position} possui destino incompatível`);
      }
      if (tile.targetPosition !== null && tile.targetPosition >= content.tileCount) {
        issue(context, `a casa ${tile.position} aponta para destino inexistente`);
      }
    }
    checkUnique(propertyIds, "ID de propriedade", context);
    for (const [cityKey, count] of cityTileCounts) {
      if (count === 0) {
        issue(context, `a cidade ${cityKey} não possui casas`);
      }
    }
    for (const [groupKey, count] of propertyCountByGroup) {
      if (count === 0) {
        issue(context, `o grupo ${groupKey} não possui propriedades`);
      }
    }

    const deckTypes = new Set(content.decks.map((deck) => deck.type));
    for (const tile of content.tiles) {
      if (tile.type === "REGIONAL_EVENT" && !deckTypes.has("REGIONAL_EVENT")) {
        issue(context, "há uma casa de evento sem baralho regional");
      }
      if (tile.type === "COMMUNITY_BENEFIT" && !deckTypes.has("COMMUNITY_BENEFIT")) {
        issue(context, "há uma casa de benefício sem baralho comunitário");
      }
    }
    for (const deck of content.decks) {
      if (!deck.cards.some((card) => card.enabled)) {
        issue(context, `o baralho ${deck.name} não possui cartas ativas`);
      }
      for (const card of deck.cards) {
        if (card.effect.type === "MOVE_TO" && card.effect.position >= content.tileCount) {
          issue(context, `a carta ${card.key} aponta para uma casa inexistente`);
        }
      }
    }
  });

export type BoardContent = z.infer<typeof boardContentSchema>;
export type BoardContentTile = z.infer<typeof tileSchema>;
export type BoardContentCard = z.infer<typeof cardSchema>;

function checkUnique(values: readonly string[], label: string, context: z.RefinementCtx): void {
  if (new Set(values).size !== values.length) {
    issue(context, `há ${label} duplicado`);
  }
}

function issue(context: z.RefinementCtx, message: string): void {
  context.addIssue({ code: "custom", message });
}
