/** Mirrors backend `DepartmentResponse` */
export interface DepartmentRef {
  id: number;
  name: string;
}

/** Mirrors backend `UserResponse` record */
export interface UserResponseDTO {
  id: number;
  firstName: string;
  lastName: string;
  matricule: number;
  isActive: boolean;
  role: 'SOUS_CHEF' | 'CHEF_ATELIER' | 'ADMIN';
  department: DepartmentRef | null;
  createdAt: string;
}

/** Payload for POST /api/users */
export interface CreateUserRequestDTO {
  firstName: string;
  lastName: string;
  password: string;
  matricule: number;
  role: 'SOUS_CHEF' | 'CHEF_ATELIER' | 'ADMIN';
  departmentId: number | null;
}

/** Legacy alias used by settings/profile screens */
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

/** Payload for setting the current user's department (one-shot onboarding) */
export interface SetDepartmentPayload {
  departmentId: number;
}
