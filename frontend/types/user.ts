/** Mirrors backend user profile DTO */
export interface UserProfileDTO {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  role: 'SOUS_CHEF' | 'CHEF_ATELIER' | 'ADMIN';
  departmentId: string | null;
  departmentName?: string | null;
  isFirstLogin: boolean;
}

/** Payload for setting a user's department (one-shot onboarding) */
export interface SetDepartmentPayload {
  departmentId: string;
}

/** Reference data groups for admin forms */
export interface ReferenceDataGroup {
  categories: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  sections: Array<{ id: string; name: string }>;
  productionLines: Array<{ id: string; name: string }>;
  stations: Array<{ id: string; name: string }>;
}
