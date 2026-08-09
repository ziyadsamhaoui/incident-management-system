'use client';

import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { useAuthStore } from '@/store/useAuthStore';
import {
  getLanguagePreference,
  setLanguagePreference,
} from '@/services/preferencesService';

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
    redirecting: 'Connexion réussie — redirection en cours...',
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
    errorServer:
      'Le serveur rencontre une erreur. Veuillez réessayer dans un instant.',
    errorNetwork:
      'Impossible de contacter le serveur. Vérifiez votre connexion puis réessayez.',
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
    // Password reset — shared
    resetTitle: 'Réinitialisation du mot de passe',
    resetBackToLogin: 'Retour à la connexion',
    resetRateLimited: 'Trop de requêtes. Réessayez dans',
    resetFieldRequired: 'Champ obligatoire',
    resetRequestChefLink: "Demander un code (Chef d'atelier)",
    resetRequestAdminLink: 'Demander un lien (Administrateur)',
    // Password reset — Track A (CHEF_ATELIER self-service)
    chefResetTitle: 'Réinitialiser votre mot de passe',
    chefResetSubtitle:
      'Vérifiez votre identité pour recevoir un code de réinitialisation.',
    chefResetSubmit: 'Recevoir mon code',
    chefResetSubmitting: 'Vérification en cours...',
    resetCodeBadge: 'Votre code de réinitialisation',
    resetCodeExpiresLabel: 'Expire dans',
    resetCodeExpired: 'Code expiré — demandez-en un nouveau.',
    resetContinue: 'Continuer',
    resetRequestNewCode: 'Demander un nouveau code',
    invalidIdentifiers: 'Identifiants invalides',
    resetBlockedHelp:
      "Toujours bloqué ? Demandez à un administrateur de générer un code pour vous.",
    // Password reset — Track B (ADMIN email)
    adminResetTitle: 'Réinitialiser le mot de passe administrateur',
    adminResetSubtitle:
      'Saisissez votre adresse email pour recevoir un lien de réinitialisation.',
    adminResetSubmit: 'Envoyer le lien',
    adminResetSubmitting: 'Envoi en cours...',
    adminResetSentTitle: 'Demande envoyée',
    adminResetSent:
      'Si cette adresse est enregistrée, un lien de réinitialisation a été envoyé.',
    // Password reset — Track C (confirm)
    confirmResetTitle: 'Définir un nouveau mot de passe',
    confirmResetSubtitle:
      'Saisissez le code reçu ainsi que votre nouveau mot de passe.',
    resetTokenLabel: 'Code de réinitialisation',
    resetTokenPlaceholder: 'Code à 6 caractères ou jeton reçu',
    resetTokenRequired: 'Veuillez saisir le code reçu',
    resetPasswordMin: 'Au moins 8 caractères',
    resetPasswordMinHint:
      'Le mot de passe doit contenir au moins 8 caractères.',
    resetPasswordMismatch: 'Les mots de passe ne correspondent pas.',
    resetPasswordMatch: 'Les mots de passe correspondent.',
    resetConfirmSubmit: 'Mettre à jour le mot de passe',
    resetConfirmSubmitting: 'Mise à jour en cours...',
    resetSuccessTitle: 'Mot de passe mis à jour, connectez-vous.',
    resetSuccessSubtitle:
      'Votre mot de passe a été modifié. Redirection vers la page de connexion…',
    resetTokenExpired:
      'Ce code a expiré, veuillez en demander un nouveau.',
    // Incidents Logs (resolved archive)
    logsExport: 'Exporter',
    logsExportPdf: 'PDF',
    logsExportExcel: 'Excel',
    logsExportCsv: 'CSV',
    logsFiltersTitle: 'Filtres',
    logsFiltersDesc:
      'Filtrer les incidents résolus par catégorie, priorité et date.',
    logsApply: 'Appliquer',
    logsEmptyZeroTitle: 'Aucun incident archivé',
    logsEmptyZeroDesc:
      "Les incidents évalués (résolus ou non résolus) apparaîtront ici.",
    logsEmptyFilteredTitle: 'Aucun résultat pour ces filtres',
    logsEmptyFilteredDesc:
      'Essayez de modifier vos critères de recherche ou de réinitialiser les filtres.',
    logsResetFilters: 'Réinitialiser les filtres',
    logsColReference: 'Référence',
    logsColCategory: 'Catégorie',
    logsColDepartment: 'Département',
    logsColOutcome: 'Résultat',
    logsColResolvedBy: 'Résolu par',
    logsColResolvedDate: 'Date de résolution',
    logsColNote: 'Note de résolution',
    logsResolved: 'Résolu',
    logsResolvedBy: 'Résolu par {name}',
    logsJustNow: "à l'instant",
    logsMinutesAgo: 'il y a {n} min',
    logsHoursAgo: 'il y a {n}h',
    logsYesterday: 'hier',
    logsDaysAgo: 'il y a {n}j',
    logsSearchPlaceholder:
      'Rechercher une référence, une note de résolution...',
    logsFilterDepartment: 'Département',
    logsFilterCategory: 'Catégorie',
    logsFilterPriority: 'Priorité',
    logsFilterFrom: 'Du',
    logsFilterTo: 'Au',
    logsFilterAllDepartments: 'Tous les départements',
    logsFilterReset: 'Réinitialiser',
    logsShowing: 'Affichage de {from} à {to} sur {total}',
    logsPrev: 'Précédent',
    logsNext: 'Suivant',
    logsPage: 'Page {page} / {totalPages}',
    // Media administration surface (/admin/media)
    mediaAdminTitle: 'Gestion des médias',
    mediaAdminSubtitle: 'Photos et vidéos stockées sur le serveur : consultation, audit et nettoyage',
    mediaAdminStorageLabel: 'Stockage des médias',
    mediaAdminFiles: '{count} fichier(s)',
    mediaAdminPhotos: 'Photos',
    mediaAdminVideos: 'Vidéos',
    mediaAdminFreeSpace: 'Espace disque libre',
    mediaAdminUsedPercent: '{percent} % du disque utilisé',
    mediaAdminAlmostFull: '⚠ Stockage presque saturé',
    mediaAdminPhoto: 'Photo',
    mediaAdminVideo: 'Vidéo',
    mediaAdminSearch: "Rechercher par référence d'incident...",
    mediaAdminAllDepartments: 'Tous les départements',
    mediaAdminAllTypes: 'Tous',
    mediaAdminReset: 'Réinitialiser',
    mediaAdminGrid: 'Grille',
    mediaAdminList: 'Liste',
    mediaAdminAutoDeleteIn: 'Suppression automatique dans {days} jour(s)',
    mediaAdminRetained: 'Conservé — incident en cours',
    mediaAdminDeleteFile: 'Supprimer le fichier',
    mediaAdminConfirmDelete: 'Confirmer la suppression',
    mediaAdminCancel: 'Annuler',
    mediaAdminDeleteSelected: 'Supprimer les fichiers sélectionnés',
    mediaAdminSelectAllFiltered: 'Tout sélectionner',
    mediaAdminDeselect: 'Désélectionner',
    mediaAdminSelected: '{count} fichier(s) sélectionné(s)',
    mediaAdminBulkTitle: 'Supprimer les fichiers sélectionnés',
    mediaAdminBulkMessage: 'Voulez-vous supprimer {count} fichiers ? Espace libéré : {size}',
    mediaAdminFreedSpace: 'Espace libéré',
    mediaAdminSystemEmpty: 'Aucun média stocké pour le moment.',
    mediaAdminFilteredEmpty: 'Aucun résultat ne correspond à vos filtres actuels.',
    // Analytics & Quality Engineering page (/analytics)
    analyticsTitle: 'Analytique',
    analyticsSubtitle:
      'Tendances historiques, qualité des résolutions et signaux de récurrence',
    analyticsPreset7: '7 jours',
    analyticsPreset30: '30 jours',
    analyticsPreset90: '90 jours',
    analyticsPresetYtd: 'Depuis le 1er janvier',
    analyticsPresetCustom: 'Personnalisé',
    analyticsFrom: 'Du',
    analyticsTo: 'Au',
    analyticsAllDepartments: 'Tous les départements',
    analyticsCompare: 'Comparer',
    analyticsCompareHint: 'Afficher les variations vs. la période précédente',
    analyticsExport: 'Exporter le rapport',
    analyticsExportCsv: 'Exporter en CSV',
    analyticsExportPdf: 'Exporter en PDF',
    analyticsExportDesc: 'Rapport mensuel — sécurité & exploitation',
    analyticsMetricTotal: 'Incidents déclarés',
    analyticsMetricRate: 'Taux de résolution',
    analyticsMetricMttr: 'MTTR',
    analyticsMetricTtc: 'Prise en charge',
    analyticsVsPrev: 'vs. période préc.',
    analyticsNoCompare: 'Aucune donnée de comparaison',
    analyticsVolumeTitle: 'Volume des incidents',
    analyticsVolumeDesc: 'Incidents déclarés par période',
    analyticsOutcomeTitle: 'Qualité des résolutions',
    analyticsOutcomeDesc: 'Part des résolus vs non résolus',
    analyticsResolved: 'Résolus',
    analyticsNonResolved: 'Non résolus',
    analyticsMttrTitle: 'MTTR — durée moyenne de résolution',
    analyticsMttrDesc: 'Heures moyennes par période',
    analyticsTtcTitle: 'Temps moyen de prise en charge',
    analyticsTtcDesc: 'De la déclaration à la prise en charge',
    analyticsParetoTitle: 'Analyse Pareto (80/20)',
    analyticsParetoDesc: 'Incidents par catégorie et part cumulée',
    analyticsParetoInsight:
      '{n} / {total} catégories concentrent {pct} % des incidents',
    analyticsParetoCumulative: 'Part cumulée',
    analyticsHeatmapTitle: 'Carte de chaleur des créneaux',
    analyticsHeatmapDesc: 'Incidents par heure et jour de la semaine',
    analyticsHeatmapTotal: '{count} incidents sur la période',
    analyticsHeatmapLow: 'Faible',
    analyticsHeatmapHigh: 'Élevé',
    analyticsDayMon: 'Lun',
    analyticsDayTue: 'Mar',
    analyticsDayWed: 'Mer',
    analyticsDayThu: 'Jeu',
    analyticsDayFri: 'Ven',
    analyticsDaySat: 'Sam',
    analyticsDaySun: 'Dim',
    analyticsSignalsTitle: 'Signaux de récurrence',
    analyticsSignalsDesc: '≥ 3 incidents — même station & catégorie — en 14 jours',
    analyticsSignalsCount: '{n} incidents',
    analyticsSignalsEmpty: 'Aucun signal de récurrence',
    analyticsSignalsEmptyDesc:
      'Aucune station ne présente de motif répétitif sur la période.',
    analyticsSignalsOpen: 'Voir les incidents',
    analyticsSignalsSince: 'depuis {date}',
    analyticsDeptTitle: 'Répartition par département',
    analyticsDeptDesc: 'Volume total sur la période',
    analyticsWorkloadTitle: 'Charge de travail de l’équipe',
    analyticsWorkloadDesc: 'Indicateurs agrégés — équilibrage de la charge',
    analyticsWorkloadMember: 'Membre',
    analyticsWorkloadClaims: 'Pris en charge',
    analyticsWorkloadResolved: 'Résolus',
    analyticsWorkloadNonResolved: 'Non résolus',
    analyticsWorkloadEvaluated: 'Évaluations',
    analyticsWorkloadAvg: 'Durée moy. de résolution',
    analyticsLoading: 'Chargement des analyses…',
    analyticsEmpty: 'Aucune donnée pour cette période',
    analyticsError: 'Impossible de charger les analyses',
  },
  AR: {
    title: 'التسجيل في حسابك',
    subtitle: 'أدخل بياناتك للمتابعة',
    rememberMe: 'تذكرني',
    forgotPassword: 'نسيت كلمة المرور؟',
    submit: 'تسجيل الدخول',
    submitting: 'جارٍ تسجيل الدخول...',
    redirecting: 'تم تسجيل الدخول بنجاح — جارٍ التحويل...',
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
    errorServer: 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى بعد قليل.',
    errorNetwork:
      'تعذر الوصول إلى الخادم. تحقق من اتصالك ثم أعد المحاولة.',
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
    // Password reset — shared
    resetTitle: 'إعادة تعيين كلمة المرور',
    resetBackToLogin: 'العودة إلى تسجيل الدخول',
    resetRateLimited: 'طلبات كثيرة جداً. حاول بعد',
    resetFieldRequired: 'حقل مطلوب',
    resetRequestChefLink: 'طلب رمز (رئيس الورشة)',
    resetRequestAdminLink: 'طلب رابط (مسؤول)',
    // Password reset — Track A (CHEF_ATELIER self-service)
    chefResetTitle: 'إعادة تعيين كلمة المرور',
    chefResetSubtitle: 'تحقق من هويتك لتلقي رمز إعادة التعيين.',
    chefResetSubmit: 'استلام رمزي',
    chefResetSubmitting: 'جارٍ التحقق...',
    resetCodeBadge: 'رمز إعادة التعيين الخاص بك',
    resetCodeExpiresLabel: 'ينتهي خلال',
    resetCodeExpired: 'انتهت صلاحية الرمز — اطلب رمزاً جديداً.',
    resetContinue: 'متابعة',
    resetRequestNewCode: 'طلب رمز جديد',
    invalidIdentifiers: 'بيانات غير صحيحة',
    resetBlockedHelp:
      'لا تزال عالقاً؟ اطلب من مسؤول توليد رمز لك.',
    // Password reset — Track B (ADMIN email)
    adminResetTitle: 'إعادة تعيين كلمة مرور المسؤول',
    adminResetSubtitle:
      'أدخل بريدك الإلكتروني لتلقي رابط إعادة التعيين.',
    adminResetSubmit: 'إرسال الرابط',
    adminResetSubmitting: 'جارٍ الإرسال...',
    adminResetSentTitle: 'تم إرسال الطلب',
    adminResetSent:
      'إذا كان هذا البريد مسجلاً، فقد تم إرسال رابط إعادة التعيين.',
    // Password reset — Track C (confirm)
    confirmResetTitle: 'تعيين كلمة مرور جديدة',
    confirmResetSubtitle: 'أدخل الرمز المستلم وكلمة المرور الجديدة.',
    resetTokenLabel: 'رمز إعادة التعيين',
    resetTokenPlaceholder: 'الرمز المكون من 6 أحرف أو الرمز المستلم',
    resetTokenRequired: 'يرجى إدخال الرمز المستلم',
    resetPasswordMin: '8 أحرف على الأقل',
    resetPasswordMinHint: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
    resetPasswordMismatch: 'كلمتا المرور غير متطابقتين.',
    resetPasswordMatch: 'كلمتا المرور متطابقتان.',
    resetConfirmSubmit: 'تحديث كلمة المرور',
    resetConfirmSubmitting: 'جارٍ التحديث...',
    resetSuccessTitle: 'تم تحديث كلمة المرور، سجّل الدخول.',
    resetSuccessSubtitle:
      'تم تعديل كلمة المرور. جارٍ التحويل إلى صفحة تسجيل الدخول…',
    resetTokenExpired: 'انتهت صلاحية هذا الرمز، يرجى طلب رمز جديد.',
    // Incidents Logs (resolved archive)
    logsExport: 'تصدير',
    logsExportPdf: 'PDF',
    logsExportExcel: 'Excel',
    logsExportCsv: 'CSV',
    logsFiltersTitle: 'الفلاتر',
    logsFiltersDesc:
      'قم بتصفية الحوادث المحلولة حسب الفئة والأولوية والتاريخ.',
    logsApply: 'تطبيق',
    logsEmptyZeroTitle: 'لا توجد حوادث مؤرشفة',
    logsEmptyZeroDesc:
      'ستظهر هنا الحوادث التي تم تقييمها (محلولة أو غير محلولة).',
    logsEmptyFilteredTitle: 'لا توجد نتائج لهذه الفلاتر',
    logsEmptyFilteredDesc:
      'حاول تعديل معايير البحث أو إعادة تعيين الفلاتر.',
    logsResetFilters: 'إعادة تعيين الفلاتر',
    logsColReference: 'المرجع',
    logsColCategory: 'الفئة',
    logsColDepartment: 'القسم',
    logsColOutcome: 'النتيجة',
    logsColResolvedBy: 'حُل بواسطة',
    logsColResolvedDate: 'تاريخ الحل',
    logsColNote: 'ملاحظة الحل',
    logsResolved: 'محلول',
    logsResolvedBy: 'حُل بواسطة {name}',
    logsJustNow: 'الآن',
    logsMinutesAgo: 'منذ {n} دقيقة',
    logsHoursAgo: 'منذ {n} ساعة',
    logsYesterday: 'أمس',
    logsDaysAgo: 'منذ {n} يوم',
    logsSearchPlaceholder:
      'ابحث عن مرجع أو ملاحظة حل...',
    logsFilterDepartment: 'القسم',
    logsFilterCategory: 'الفئة',
    logsFilterPriority: 'الأولوية',
    logsFilterFrom: 'من',
    logsFilterTo: 'إلى',
    logsFilterAllDepartments: 'جميع الأقسام',
    logsFilterReset: 'إعادة تعيين',
    logsShowing: 'عرض {from} إلى {to} من {total}',
    logsPrev: 'السابق',
    logsNext: 'التالي',
    logsPage: 'صفحة {page} / {totalPages}',
    // Media administration surface (/admin/media)
    mediaAdminTitle: 'إدارة الوسائط',
    mediaAdminSubtitle: 'الصور والفيديوهات المخزنة على الخادم : الحصص، التدقيق والتنظيف',
    mediaAdminStorageLabel: 'تخزين الوسائط',
    mediaAdminFiles: '{count} ملف(ملفات)',
    mediaAdminPhotos: 'الصور',
    mediaAdminVideos: 'الفيديوهات',
    mediaAdminFreeSpace: 'المساحة الحرة على القرص',
    mediaAdminUsedPercent: '{percent}٪ من القرص مستخدم',
    mediaAdminAlmostFull: '⚠ التخزين شبه ممتلئ',
    mediaAdminPhoto: 'صورة',
    mediaAdminVideo: 'فيديو',
    mediaAdminSearch: 'البحث برقم الحادثة...',
    mediaAdminAllDepartments: 'جميع الأقسام',
    mediaAdminAllTypes: 'الكل',
    mediaAdminReset: 'إعادة تعيين',
    mediaAdminGrid: 'شبكة',
    mediaAdminList: 'قائمة',
    mediaAdminAutoDeleteIn: 'حذف تلقائي خلال {days} يوم(أيام)',
    mediaAdminRetained: 'محفوظ — حادثة قيد المعالجة',
    mediaAdminDeleteFile: 'حذف الملف',
    mediaAdminConfirmDelete: 'تأكيد الحذف',
    mediaAdminCancel: 'إلغاء',
    mediaAdminDeleteSelected: 'حذف الملفات المحددة',
    mediaAdminSelectAllFiltered: 'تحديد الكل',
    mediaAdminDeselect: 'إلغاء التحديد',
    mediaAdminSelected: '{count} ملف محدد',
    mediaAdminBulkTitle: 'حذف الملفات المحددة',
    mediaAdminBulkMessage: 'هل تريد حذف {count} ملفات؟ المساحة المحررة: {size}',
    mediaAdminFreedSpace: 'المساحة المحررة',
    mediaAdminSystemEmpty: 'لا توجد وسائط مخزنة حالياً.',
    mediaAdminFilteredEmpty: 'لا توجد نتائج تطابق فلاترك الحالية.',
    // Analytics & Quality Engineering page (/analytics)
    analyticsTitle: 'التحليلات والجودة',
    analyticsSubtitle: 'الاتجاهات التاريخية وجودة الحلول وإشارات التكرار',
    analyticsPreset7: '7 أيام',
    analyticsPreset30: '30 يومًا',
    analyticsPreset90: '90 يومًا',
    analyticsPresetYtd: 'منذ 1 يناير',
    analyticsPresetCustom: 'مخصص',
    analyticsFrom: 'من',
    analyticsTo: 'إلى',
    analyticsAllDepartments: 'جميع الأقسام',
    analyticsCompare: 'مقارنة',
    analyticsCompareHint: 'عرض التغيرات مقارنة بالفترة السابقة',
    analyticsExport: 'تصدير التقرير',
    analyticsExportCsv: 'تصدير CSV',
    analyticsExportPdf: 'تصدير PDF',
    analyticsExportDesc: 'التقرير الشهري — السلامة والاستغلال',
    analyticsMetricTotal: 'الحوادث المصرح بها',
    analyticsMetricRate: 'معدل الحل',
    analyticsMetricMttr: 'متوسط زمن الحل',
    analyticsMetricTtc: 'الاستلام',
    analyticsVsPrev: 'مقارنة بالفترة السابقة',
    analyticsNoCompare: 'لا توجد بيانات للمقارنة',
    analyticsVolumeTitle: 'حجم الحوادث',
    analyticsVolumeDesc: 'الحوادث المصرح بها حسب الفترة',
    analyticsOutcomeTitle: 'جودة الحلول',
    analyticsOutcomeDesc: 'نسبة المحلول مقابل غير المحلول',
    analyticsResolved: 'محلول',
    analyticsNonResolved: 'غير محلول',
    analyticsMttrTitle: 'متوسط زمن الحل (MTTR)',
    analyticsMttrDesc: 'متوسط الساعات حسب الفترة',
    analyticsTtcTitle: 'متوسط زمن الاستلام',
    analyticsTtcDesc: 'من التصريح إلى الاستلام',
    analyticsParetoTitle: 'تحليل باريتو (80/20)',
    analyticsParetoDesc: 'الحوادث حسب الفئة والحصة التراكمية',
    analyticsParetoInsight: '{n} من {total} فئة تركّز {pct} % من الحوادث',
    analyticsParetoCumulative: 'الحصة التراكمية',
    analyticsHeatmapTitle: 'خريطة حرارية للفترات الزمنية',
    analyticsHeatmapDesc: 'الحوادث حسب الساعة ويوم الأسبوع',
    analyticsHeatmapTotal: '{count} حادثة خلال الفترة',
    analyticsHeatmapLow: 'منخفض',
    analyticsHeatmapHigh: 'مرتفع',
    analyticsDayMon: 'اثن',
    analyticsDayTue: 'ثلا',
    analyticsDayWed: 'أرب',
    analyticsDayThu: 'خمي',
    analyticsDayFri: 'جمع',
    analyticsDaySat: 'سبت',
    analyticsDaySun: 'أحد',
    analyticsSignalsTitle: 'إشارات التكرار',
    analyticsSignalsDesc: '≥ 3 حوادث — نفس المحطة والفئة — خلال 14 يومًا',
    analyticsSignalsCount: '{n} حوادث',
    analyticsSignalsEmpty: 'لا توجد إشارات تكرار',
    analyticsSignalsEmptyDesc:
      'لا توجد محطة تُظهر نمطًا متكررًا خلال الفترة.',
    analyticsSignalsOpen: 'عرض الحوادث',
    analyticsSignalsSince: 'منذ {date}',
    analyticsDeptTitle: 'التوزيع حسب القسم',
    analyticsDeptDesc: 'الحجم الإجمالي خلال الفترة',
    analyticsWorkloadTitle: 'عبء عمل الفريق',
    analyticsWorkloadDesc: 'مؤشرات مجمعة — توازن العبء',
    analyticsWorkloadMember: 'العضو',
    analyticsWorkloadClaims: 'تم الاستلام',
    analyticsWorkloadResolved: 'محلول',
    analyticsWorkloadNonResolved: 'غير محلول',
    analyticsWorkloadEvaluated: 'التقييمات',
    analyticsWorkloadAvg: 'متوسط زمن الحل',
    analyticsLoading: 'جارٍ تحميل التحليلات…',
    analyticsEmpty: 'لا توجد بيانات لهذه الفترة',
    analyticsError: 'تعذر تحميل التحليلات',
  },
};

// Lane label translations

export const LANE_LABELS: Record<Lang, Record<string, string>> = {
  FR: { SOUS_CHEF: 'Opérateur', CHEF_ATELIER: "Chef d'atelier", ADMIN: 'Administrateur' },
  AR: { SOUS_CHEF: 'عامل', CHEF_ATELIER: 'رئيس الورشة', ADMIN: 'مسؤول' },
};

// ── Shared language store ──────────────────────────────────
// A module-level zustand store (instead of per-component useState) so every
// consumer of useTranslation re-renders when the language changes — switching
// language in Settings updates the whole app, not just one component.

const STORAGE_KEY = 'app-lang';

/**
 * Synchronous initial value from localStorage so the very first paint already
 * renders in the saved language (no flash of French before hydration).
 */
function readStoredLang(): Lang {
  if (typeof window === 'undefined') return 'FR';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'AR' || stored === 'FR' ? stored : 'FR';
  } catch {
    return 'FR';
  }
}

interface LangState {
  lang: Lang;
  /** Apply the language immediately (state + document attributes). */
  apply: (next: Lang) => void;
}

const useLangStore = create<LangState>((set) => ({
  lang: readStoredLang(),
  apply: (next) => set({ lang: next }),
}));

function persistLocal(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // localStorage unavailable — session-only language is fine.
  }
}

/** Keep the document dir/lang in sync so Arabic renders RTL app-wide. */
function applyDocumentLang(lang: Lang) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang === 'AR' ? 'ar' : 'fr';
  document.documentElement.dir = lang === 'AR' ? 'rtl' : 'ltr';
}

let hydrationStarted = false;

/**
 * Adopt the server preference (Redis) when available — the authoritative
 * source for an authenticated user. Skipped while unauthenticated (the login
 * pages would otherwise trigger a pointless 401 refresh cycle); the
 * subscription below re-runs it the moment the user signs in.
 */
function fetchServerLanguage() {
  if (!useAuthStore.getState().accessToken) return;
  getLanguagePreference().then((serverLang) => {
    if (serverLang) {
      useLangStore.getState().apply(serverLang);
      applyDocumentLang(serverLang);
      persistLocal(serverLang);
    }
  });
}

/**
 * One-time bootstrap: apply the local language synchronously, then adopt the
 * Redis preference. Idempotent — only the first caller performs the work. A
 * subscription re-fetches on login (client-side navigation has no full reload,
 * so the module-level guard would otherwise skip the server value).
 */
function startHydration() {
  if (hydrationStarted) return;
  hydrationStarted = true;
  applyDocumentLang(useLangStore.getState().lang);
  fetchServerLanguage();
  useAuthStore.subscribe((state, prev) => {
    if (!prev.isAuthenticated && state.isAuthenticated) fetchServerLanguage();
  });
}

export function useTranslation() {
  const lang = useLangStore((s) => s.lang);
  const apply = useLangStore((s) => s.apply);

  // Keep the document dir/lang in sync with every change.
  useEffect(() => {
    applyDocumentLang(lang);
  }, [lang]);

  // Adopt the persisted preference once.
  useEffect(() => {
    startHydration();
  }, []);

  const setLang = useCallback(
    (next: Lang) => {
      apply(next);
      applyDocumentLang(next);
      persistLocal(next);
      // Best-effort server persistence (Redis) — never blocks the UI.
      setLanguagePreference(next);
    },
    [apply],
  );

  return {
    lang,
    setLang,
    t: T[lang],
    laneLabel: LANE_LABELS[lang],
    dir: lang === 'AR' ? ('rtl' as const) : ('ltr' as const),
    isRtl: lang === 'AR',
    hydrated: true,
  };
}

