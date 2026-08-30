import { z } from 'zod';

import { AVATAR_MAX_LENGTH, AVATAR_VALUE_PATTERN } from '../auth/validation';

export const createRoomSchema = z.object({
  gameType: z.enum(['trivia', 'mafia', 'knows-you-best']),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const guestJoinSchema = z.object({
  nickname: z.string().trim().min(1, 'Enter a nickname.').max(24, 'Nickname is too long.'),
  avatar: z
    .string()
    .max(AVATAR_MAX_LENGTH, 'Image is too large.')
    .regex(AVATAR_VALUE_PATTERN, 'Invalid avatar value.')
    .nullable()
    .optional(),
});

export type GuestJoinInput = z.infer<typeof guestJoinSchema>;
