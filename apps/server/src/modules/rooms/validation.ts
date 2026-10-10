import { z } from 'zod';
import { avatarValueSchema, displayName } from '../auth/validation';

export const createRoomSchema = z.object({
  gameType: z.enum(['trivia', 'mafia', 'knows-you-best', 'fabrication', 'auction', 'insan-hayawan-jamad']),
  // Whether the creator is playing on their own phone or setting up a second
  // screen. Absent means tv, which is how every client behaved before the
  // choice existed.
  displayMode: z.enum(['phone', 'tv']).optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const guestJoinSchema = z.object({
  // Same rule as an account's name (displayNameSchema), and for the same
  // reason: this string is drawn on everybody else's screen. It matters more
  // here, not less -- a guest needs no account and no email, so this is the
  // one name a complete stranger can put on the host's television by scanning
  // a QR code. Kept at 24 rather than 60 because a nickname sits in a seat
  // chip, and the markup and control-character rules are shared.
  nickname: displayName(24, 'Enter a nickname.'),
  // The same rule every other avatar path uses -- see avatarValueSchema. This
  // used to carry its own copy that knew only about "icon:", so a guest who
  // picked any of the sixty arcade avatars was told their choice was invalid.
  avatar: avatarValueSchema.nullable().optional(),
});

export type GuestJoinInput = z.infer<typeof guestJoinSchema>;

// Renaming yourself in the lobby: the same bounds the nickname had on the way
// in, so a name cannot become something join would have refused.
export const guestNameSchema = z.object({
  name: z.string().trim().min(1, 'Enter a nickname.').max(24, 'Nickname is too long.'),
});

export type GuestNameInput = z.infer<typeof guestNameSchema>;
