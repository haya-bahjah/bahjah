import { z } from 'zod';

// mafiaCountOverride's max of 7 matches the largest value assignRoles' clamp
// could ever honor: floor((15-1)/2) at the room's player cap of 15.
export const mafiaConfigSchema = z.object({
  daySeconds: z.number().int().min(30).max(300),
  nightSeconds: z.number().int().min(30).max(300),
  voteSeconds: z.number().int().min(15).max(180),
  mafiaCountOverride: z.number().int().min(1).max(7).nullable(),
  tieRule: z.enum(['none', 'revote', 'random']),
  revealEliminatedRole: z.boolean(),
  includeDoctor: z.boolean(),
  includeDetective: z.boolean(),
  doctorCanProtectSelf: z.boolean(),
});

export type MafiaConfigInput = z.infer<typeof mafiaConfigSchema>;
