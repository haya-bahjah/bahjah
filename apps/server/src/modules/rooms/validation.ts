import { z } from 'zod';
import { avatarValueSchema } from '../auth/validation';

export const createRoomSchema = z.object({
  gameType: z.enum(['trivia', 'mafia', 'knows-you-best']),
  // Whether the creator is playing on their own phone or setting up a second
  // screen. Absent means tv, which is how every client behaved before the
  // choice existed.
  displayMode: z.enum(['phone', 'tv']).optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const guestJoinSchema = z.object({
  nickname: z.string().trim().min(1, 'Enter a nickname.').max(24, 'Nickname is too long.'),
  // The same rule every other avatar path uses -- see avatarValueSchema. This
  // used to carry its own copy that knew only about "icon:", so a guest who
  // picked any of the sixty arcade avatars was told their choice was invalid.
  avatar: avatarValueSchema.nullable().optional(),
});

export type GuestJoinInput = z.infer<typeof guestJoinSchema>;
