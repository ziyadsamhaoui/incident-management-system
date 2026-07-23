'use client';

import { useState, useEffect, useCallback } from 'react';

// Types

export type Lang = 'FR' | 'AR';

// Consolidated Translation Dictionaries

const T: Record<Lang, Record<string, string>> = {
  FR: {
    title: 'Connexion à votre compte',
    subtitle: 'Entrez vos identifiants pour continuer',
    rememberMe: 'Se souvenir de moi',
    forgotPassword: 'Mot de passe oublié ?',
    submit: 'Se connecter',
    submitting: 'Connexion...',
    locked: 'Compte verrouillé',
    rateLimited: 'Trop de requêtes',
    registerQuestion: 'Pas encore de compte ?',
    registerAction: 'Créer un compte',
    lockedCountdown: 'Débloqué dans',
    retryIn: 'Réessayer dans',
    // Form field labels
    matricule: 'Matricule',
    firstName: 'Prénom',
    lastName: 'Nom',
    email: 'Adresse email',
    password: 'Mot de passe',
    matriculePlaceholder: '1005',
    firstNamePlaceholder: 'Ahmed',
    lastNamePlaceholder: 'Amraoui',
    emailPlaceholder: 'admin@icglma.ma',
    passwordPlaceholder: '••••••••',
    passwordPlaceholderAlt: 'Votre mot de passe',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    errorAuth: 'Échec de connexion',
    errorLocked: 'Compte verrouillé',
    errorRateLimited: 'Trop de requêtes',
    unlockIn: 'Débloqué dans',
  },
  AR: {
    title: 'التسجيل في حسابك',
    subtitle: 'أدخل بياناتك للمتابعة',
    rememberMe: 'تذكرني',
    forgotPassword: 'نسيت كلمة المرور؟',
    submit: 'تسجيل الدخول',
    submitting: 'جارٍ تسجيل الدخول...',
    locked: 'الحساب مقفل',
    rateLimited: 'طلبات كثيرة جداً',
    registerQuestion: 'ليس لديك حساب؟',
    registerAction: 'إنشاء حساب',
    lockedCountdown: 'يفتح بعد',
    retryIn: 'حاول بعد',
    // Form field labels
    matricule: 'رقم التسجيل',
    firstName: 'الاسم الشخصي',
    lastName: 'اسم العائلي',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    matriculePlaceholder: '1005',
    firstNamePlaceholder: 'أحمد',
    lastNamePlaceholder: 'عمروي',
    emailPlaceholder: 'admin@icglma.ma',
    passwordPlaceholder: '••••••••',
    passwordPlaceholderAlt: 'كلمة المرور الخاصة بك',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    errorAuth: 'فشل تسجيل الدخول',
    errorLocked: 'الحساب مقفل',
    errorRateLimited: 'طلبات كثيرة جداً',
    unlockIn: 'يفتح بعد',
  },
};

// Lane label translations

export const LANE_LABELS: Record<Lang, Record<string, string>> = {
  FR: { SOUS_CHEF: 'Opérateur', CHEF_ATELIER: "Chef d'atelier", ADMIN: 'Administrateur' },
  AR: { SOUS_CHEF: 'عامل', CHEF_ATELIER: 'رئيس الورشة', ADMIN: 'مسؤول' },
};

// useTranslation hook

const STORAGE_KEY = 'app-lang';

export function useTranslation() {
  const [lang, setLangState] = useState<Lang>('FR');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'FR' || stored === 'AR') {
        setLangState(stored);
      }
    } catch {
      // localStorage unavailable
    }
    setHydrated(true);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return {
    lang,
    setLang,
    t: T[lang],
    laneLabel: LANE_LABELS[lang],
    dir: lang === 'AR' ? ('rtl' as const) : ('ltr' as const),
    isRtl: lang === 'AR',
    hydrated,
  };
}

