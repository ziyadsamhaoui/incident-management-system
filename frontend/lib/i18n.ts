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
    newPassword: 'Nouveau mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    newPasswordPlaceholder: 'Votre nouveau mot de passe',
    confirmPasswordPlaceholder: 'Confirmez votre mot de passe',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    errorAuth: 'Échec de connexion',
    errorLocked: 'Compte verrouillé',
    errorRateLimited: 'Trop de requêtes',
    unlockIn: 'Débloqué dans',
    errorLockedDetail:
      'Compte verrouillé en raison de trop de tentatives de connexion échouées. Réessayez plus tard.',
    errorRateLimitedDetail:
      'Trop de tentatives de connexion. Veuillez patienter avant de réessayer.',
    errorInvalidCredentials: 'Identifiants invalides. Veuillez réessayer.',
    // SOUS_CHEF helper copy (replaces register link)
    sousChefHelp:
      "Problème de connexion ? Demandez à votre chef d'équipe de vérifier vos informations.",
    // Account unclaimed
    unclaimedTitle: 'Compte non réclamé',
    unclaimedMessage:
      "Votre compte Chef d'atelier a été créé mais pas encore réclamé. Veuillez définir votre mot de passe.",
    claimAccount: "Réclamer mon compte Chef d'atelier",
    // Claim page
    claimTitle: 'Réclamer votre compte',
    claimSubtitle:
      'Vérifiez votre identité et définissez un mot de passe pour activer votre compte.',
    claimSubmit: 'Réclamer mon compte',
    claiming: 'Réclamation en cours...',
    claimSuccess: 'Compte réclamé avec succès ! Vous allez être redirigé.',
    claimError: 'Échec de la réclamation du compte',
    matriculeNotEligible: "Ce matricule n'est pas éligible à la réclamation.",
    alreadyClaimed: 'Ce compte a déjà été réclamé.',
    identityMismatch:
      'Les informations fournies ne correspondent pas à nos enregistrements.',
    checkMatricule: 'Vérification du matricule...',
    claimLoginLink: 'Déjà un compte ?',
    claimLoginAction: 'Se connecter',
    // CHEF_ATELIER lane claim prompt (login page footer)
    chefAtelierClaimPrompt: "Vous êtes un chef d'atelier ?",
    chefAtelierClaimAction: 'Réclamer mon compte',
    // Admin login
    adminLoginTitle: 'Connexion administrateur',
    adminLoginSubtitle:
      'Saisissez vos identifiants pour accéder à l’espace sécurisé.',
    adminLoginSubmit: 'Se connecter',
    adminLoginSubmitting: 'Connexion...',
    backToFloor: "Retour au terminal de l'atelier",
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
    lastName: 'الاسم العائلي',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    matriculePlaceholder: '1005',
    firstNamePlaceholder: 'أحمد',
    lastNamePlaceholder: 'عمروي',
    emailPlaceholder: 'admin@icglma.ma',
    passwordPlaceholder: '••••••••',
    passwordPlaceholderAlt: 'كلمة المرور الخاصة بك',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    newPasswordPlaceholder: 'كلمة المرور الجديدة',
    confirmPasswordPlaceholder: 'أكد كلمة المرور',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    errorAuth: 'فشل تسجيل الدخول',
    errorLocked: 'الحساب مقفل',
    errorRateLimited: 'طلبات كثيرة جداً',
    unlockIn: 'يفتح بعد',
    errorLockedDetail:
      'تم قفل الحساب بسبب كثرة محاولات تسجيل الدخول الفاشلة. حاول مرة أخرى لاحقاً.',
    errorRateLimitedDetail:
      'محاولات تسجيل دخول كثيرة جداً. يرجى الانتظار قبل إعادة المحاولة.',
    errorInvalidCredentials: 'بيانات الدخول غير صحيحة. حاول مجدداً.',
    // SOUS_CHEF helper copy
    sousChefHelp: 'تعذر تسجيل الدخول؟ اطلب من مشرفك التحقق من بياناتك.',
    // Account unclaimed
    unclaimedTitle: 'الحساب غير مُطالب به',
    unclaimedMessage:
      'تم إنشاء حسابك كرئيس ورشة لكن لم يُطالب به بعد. يرجى تعيين كلمة المرور الخاصة بك.',
    claimAccount: 'المطالبة بحساب رئيس الورشة',
    // Claim page
    claimTitle: 'المطالبة بحسابك',
    claimSubtitle: 'تحقق من هويتك وحدد كلمة مرور لتفعيل حسابك كرئيس ورشة.',
    claimSubmit: 'المطالبة بحسابي',
    claiming: 'جارٍ المطالبة...',
    claimSuccess: 'تمت المطالبة بالحساب بنجاح! سيتم إعادة توجيهك.',
    claimError: 'فشلت المطالبة بالحساب',
    matriculeNotEligible: 'رقم التسجيل هذا غير مؤهل للمطالبة.',
    alreadyClaimed: 'تمت المطالبة بهذا الحساب بالفعل.',
    identityMismatch: 'المعلومات المقدمة لا تتطابق مع سجلاتنا.',
    checkMatricule: 'جارٍ التحقق من رقم التسجيل...',
    claimLoginLink: 'لديك حساب بالفعل؟',
    claimLoginAction: 'تسجيل الدخول',
    // CHEF_ATELIER lane claim prompt (login page footer)
    chefAtelierClaimPrompt: 'هل تمت ترقيتك إلى رئيس ورشة؟',
    chefAtelierClaimAction: 'المطالبة بحسابي',
    // Admin login
    adminLoginTitle: 'تسجيل دخول المسؤول',
    adminLoginSubtitle:
      'أدخل بيانات الدخول الخاصة بك للوصول إلى لوحة التحكم.',
    adminLoginSubmit: 'تسجيل الدخول',
    adminLoginSubmitting: 'جارٍ تسجيل الدخول...',
    backToFloor: 'العودة إلى واجهة الورشة',
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

