import { z } from "zod";

export const boardSummarySchema = z
  .object({
    id: z.uuid(),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(120),
    tileCount: z.int().min(4).max(120),
    version: z.int().positive(),
  })
  .strict();

export type BoardSummary = z.infer<typeof boardSummarySchema>;

export const foundationBoard: BoardSummary = Object.freeze({
  id: "9b835496-1969-49f4-8aef-1d11da39c6ab",
  slug: "baixada-santista",
  name: "Baixada Santista",
  tileCount: 36,
  version: 2,
});
