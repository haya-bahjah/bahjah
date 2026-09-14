import { z } from 'zod';

// A person's name, as everybody else in the room will see it.
//
// Names are drawn on other people's screens -- the lobby roster, the TV
// scoreboard, the reveal -- and those screens build their markup as strings.
// A name is therefore not data about you alone; it is content that renders in
// somebody else's browser, and it has to be safe there. A nickname of
// `<img src=x onerror=...>` ran as script on the host's screen, where the
// signed-in session token is.
//
// Angle brackets are refused here rather than escaped. Escaping is the
// renderer's job and belongs there too, but this is the single place every
// name enters the system, and a name containing markup has no honest use --
// nobody is called <img>. Refusing is also visible: you find out at signup
// instead of discovering later that your name renders oddly.
//
// The length cap matters as much as the characters. fullName had none at all,
// so an account could carry a payload of any size. 60 is longer than any real
// name that still fits on a scoreboard.
const NAME_MAX = 60;
const MARKUP = /[<>]/;
// Invisible by definition, so their only use is confusing something
// downstream -- a log line, a CSV export, a terminal.
const CONTROL = /[\u0000-\u001f\u007f]/;

// A factory rather than one schema, because the cap differs by surface -- an
// account's name gets 60, a guest's nickname 24 (it lives in a seat chip) --
// and zod's .max() is not available once .refine() has been applied.
export function displayName(max: number, tooShort = 'Full name is required.') {
  return z
    .string()
    .trim()
    .min(1, tooShort)
    .max(max, 'Name is too long.')
    .refine((v) => !MARKUP.test(v), 'Name cannot contain < or >.')
    .refine((v) => !CONTROL.test(v), 'Name contains invalid characters.');
}

export const displayNameSchema = displayName(NAME_MAX);

export const signupSchema = z.object({
  fullName: displayNameSchema,
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
    fullName: displayNameSchema.optional(),
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
