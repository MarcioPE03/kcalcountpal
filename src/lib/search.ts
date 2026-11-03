import { z } from "zod";
export const momentoSearch = z.object({
  momento: z.enum(["desayuno", "almuerzo", "merienda", "cena", "snack"]).optional(),
});
