import { z } from 'zod';

export const createRoomSchema = z.object({
  gameType: z.enum(['trivia', 'mafia', 'knows-you-best']),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
