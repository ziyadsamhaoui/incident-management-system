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

// ADMIN: email + password

export const adminSchema = z.object({
  lane: z.literal('ADMIN'),
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(4, 'Le mot de passe doit contenir au moins 4 caractères'),
});

// Discriminated union — each lane validates its own fields

export const loginSchema = z.discriminatedUnion('lane', [
  sousChefSchema,
  chefAtelierSchema,
  adminSchema,
]);

// Inferred type

export type LoginFormValues = z.infer<typeof loginSchema>;

// Per-lane error paths for inline display

export type LoginFormErrors = z.inferFlattenedErrors<typeof loginSchema>;

// Registration schema

const roleOptions = ['ADMIN', 'CHEF_ATELIER', 'SOUS_CHEF'] as const;

export const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Le nom complet est requis'),
    matricule: z.string().min(1, 'Le matricule est requis'),
    email: z.string().email('Adresse email invalide'),
    password: z.string().min(4, 'Le mot de passe doit contenir au moins 4 caractères'),
    confirmPassword: z.string().min(1, 'Veuillez confirmer le mot de passe'),
    role: z.enum(roleOptions, { errorMap: () => ({ message: 'Veuillez sélectionner un rôle' }) }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
