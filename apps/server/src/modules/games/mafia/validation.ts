import { z } from 'zod';

// mafiaCountOverride's max of 25 matches the largest value assignRoles' clamp
// could ever honor: floor(50/2) at the room's player cap of 50. The old
// max of 9 was written for a 20-seat cap and silently rejected any override
// a big room could legitimately ask for.
export const mafiaConfigSchema = z.object({
  daySeconds: z.number().int().min(30).max(300),
  nightSeconds: z.number().int().min(30).max(300),
  voteSeconds: z.number().int().min(15).max(180),
  mafiaCountOverride: z.number().int().min(1).max(25).nullable(),
  tieRule: z.enum(['none', 'revote', 'random']),
  revealEliminatedRole: z.boolean(),
  includeDoctor: z.boolean(),
  includeDetective: z.boolean(),
  doctorCanProtectSelf: z.boolean(),
});

export type MafiaConfigInput = z.infer<typeof mafiaConfigSchema>;
