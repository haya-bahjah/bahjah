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

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
