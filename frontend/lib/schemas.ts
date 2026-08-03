import { z } from 'zod';

// SOUS_CHEF: identity-only authentication

export const sousChefSchema = z.object({
  lane: z.literal('SOUS_CHEF'),
  matricule: z.string().min(1, 'Le matricule est requis'),
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
});

// CHEF_ATELIER: identity + password

export const chefAtelierSchema = sousChefSchema.extend({
  lane: z.literal('CHEF_ATELIER'),
  password: z.string().min(4, 'Le mot de passe doit contenir au moins 4 caractères'),
});

// Floor login schema: SOUS_CHEF | CHEF_ATELIER only (no ADMIN)

export const floorLoginSchema = z.discriminatedUnion('lane', [
  sousChefSchema,
  chefAtelierSchema,
]);

// Inferred type for floor login

export type FloorLoginFormValues = z.infer<typeof floorLoginSchema>;

// Admin login schema (corporate credentials)

export const adminLoginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(4, 'Le mot de passe doit contenir au moins 4 caractères'),
});

export type AdminLoginFormValues = z.infer<typeof adminLoginSchema>;

// Claim account schema

export const claimSchema = z
  .object({
    matricule: z.string().min(1, 'Le matricule est requis'),
    firstName: z.string().min(1, 'Le prénom est requis'),
    lastName: z.string().min(1, 'Le nom est requis'),
    newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string().min(1, 'Veuillez confirmer le mot de passe'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type ClaimFormValues = z.infer<typeof claimSchema>;

// Password reset confirm schema (Track C)
// STRICT minimum: 8 characters for CHEF_ATELIER and ADMIN passwords.

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Veuillez saisir le code reçu'),
    newPassword: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string().min(1, 'Veuillez confirmer le mot de passe'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
