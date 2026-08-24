import { z } from 'zod';

// mafiaCountOverride's max of 9 matches the largest value assignRoles' clamp
// could ever honor: floor((20-1)/2) at the room's player cap of 20.
export const mafiaConfigSchema = z.object({
  daySeconds: z.number().int().min(30).max(300),
  nightSeconds: z.number().int().min(30).max(300),
  voteSeconds: z.number().int().min(15).max(180),
  mafiaCountOverride: z.number().int().min(1).max(9).nullable(),
  tieRule: z.enum(['none', 'revote', 'random']),
  revealEliminatedRole: z.boolean(),
  includeDoctor: z.boolean(),
  includeDetective: z.boolean(),
  doctorCanProtectSelf: z.boolean(),
});

export type MafiaConfigInput = z.infer<typeof mafiaConfigSchema>;
