import { z } from 'zod';

export const createRoomSchema = z.object({
  gameType: z.enum(['trivia', 'mafia', 'knows-you-best']),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const guestJoinSchema = z.object({
  nickname: z.string().trim().min(1, 'Enter a nickname.').max(24, 'Nickname is too long.'),
  avatar: z
    .string()
    .max(300_000, 'Image is too large.')
    .regex(/^icon:[a-z0-9_-]+$|^data:image\/(png|jpeg|jpg|webp);base64,/, 'Invalid avatar value.')
    .nullable()
    .optional(),
});

export type GuestJoinInput = z.infer<typeof guestJoinSchema>;
