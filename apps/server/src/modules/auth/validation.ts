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

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

export const avatarSchema = z.object({
  // One of the built-in avatar sets, or a small base64 data URL for an
  // uploaded photo (resized/compressed client-side before it gets here) --
  // 300k chars covers a couple hundred KB image, plenty for a small square
  // avatar and enough headroom to reject anything unreasonably large.
  //
  // The built-in sets are namespaced by prefix, matching the values
  // assets/avatars.js renders:
  //   icon:<id>   the original glyph badges
  //   kyb:<id>    the Knows You Best characters
  // "kyb:" used to be missing here, so a player could pick one of those
  // characters in a lobby and have the save silently rejected -- the choice
  // showed until the page reloaded, then reverted to the default.
  avatar: z
    .string()
    .max(300_000, 'Image is too large.')
    .regex(
      /^(icon|kyb):[a-z0-9_-]+$|^data:image\/(png|jpeg|jpg|webp);base64,/,
      'Invalid avatar value.'
    )
    .nullable(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type AvatarInput = z.infer<typeof avatarSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
