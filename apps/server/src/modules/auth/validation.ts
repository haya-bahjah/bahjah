import { z } from 'zod';

export const signupSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email.'),
  countryCode: z.string().regex(/^\+\d{1,4}$/, 'Invalid country code.'),
  phone: z.string().trim().min(4, 'Enter a valid phone number.'),
  dob: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid date of birth.' }) }),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  marketingOptIn: z.boolean().optional().default(false),
});

export const signinSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
});

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Full name is required.').optional(),
    email: z.string().trim().toLowerCase().email('Enter a valid email.').optional(),
    countryCode: z.string().regex(/^\+\d{1,4}$/, 'Invalid country code.').optional(),
    phone: z.string().trim().min(4, 'Enter a valid phone number.').optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Nothing to update.');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email.'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'That reset link is invalid or has expired.').max(512),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

// What an avatar is allowed to be, in ONE place.
//
// This lives here rather than being written out per route because it has now
// drifted twice, both times the same way: a new avatar set is added to the
// picker, one validator learns about it, another does not, and the player who
// picks from the new set is told "Invalid avatar value." for a choice the app
// itself offered them. First it was "kyb:" missing here; then the guest-join
// schema in rooms/validation.ts, which knew only about "icon:" and so rejected
// every one of the sixty arcade avatars -- the great majority of the picker,
// and the part shown first. Every path that accepts an avatar imports this, so
// there is no second copy left to fall behind.
//
// A value is one of the built-in sets, namespaced by prefix to match what
// assets/avatars.js renders, or a small base64 data URL for an uploaded photo
// (resized and compressed client-side before it gets here):
//   arcade:<id>  the avatar library (assets/arcade-avatars.js) -- what the
//                picker offers today
//   icon:<id>    the original glyph badges, no longer offered but still stored
//                on accounts that picked one before the library landed
//   kyb:<id>     likewise, the Knows You Best characters
// The two retired prefixes stay accepted on purpose: refusing them would not
// just stop new picks, it would fail the next save of anyone still wearing one.
//
// 300k chars covers a couple hundred KB image, plenty for a small square avatar
// and enough headroom to reject anything unreasonably large.
export const avatarValueSchema = z
  .string()
  .max(300_000, 'Image is too large.')
  .regex(
    /^(icon|arcade|kyb):[a-z0-9_-]+$|^data:image\/(png|jpeg|jpg|webp);base64,/,
    'Invalid avatar value.'
  );

export const avatarSchema = z.object({
  avatar: avatarValueSchema.nullable(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type AvatarInput = z.infer<typeof avatarSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
