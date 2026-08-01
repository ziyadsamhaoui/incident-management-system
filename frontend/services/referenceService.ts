import apiClient from '@/lib/api-client';
import type { Page } from '@/types/incident';

// ── Reference data shapes ───────────────────────────

export interface CategoryRef {
  id: number;
  name: string;
}

export interface DepartmentRef {
  id: number;
  name: string;
}

export interface SectionRef {
  id: number;
  name: string;
}

export interface ProductionLineRef {
  id: number;
  name: string;
  section: SectionRef | null;
}

export interface StationRef {
  id: number;
  code: string;
  rowIndex: number;
  lineIndex: number;
  isWorking: boolean;
  productionLineId: number | null;
}

// ── Reads (authenticated, any role) ─────────────────

export async function getCategories(): Promise<CategoryRef[]> {
  const { data } = await apiClient.get<CategoryRef[]>('/api/reference-data/categories');
  return data;
}

export async function getDepartments(): Promise<DepartmentRef[]> {
  const { data } = await apiClient.get<DepartmentRef[]>('/api/reference-data/departments');
  return data;
}

export async function getSections(): Promise<SectionRef[]> {
  const { data } = await apiClient.get<SectionRef[]>('/api/reference-data/sections');
  return data;
}

export async function getProductionLines(): Promise<ProductionLineRef[]> {
  const { data } = await apiClient.get<ProductionLineRef[]>('/api/reference-data/production-lines');
  return data;
}

export async function getStations(): Promise<StationRef[]> {
  const { data } = await apiClient.get<StationRef[]>('/api/reference-data/stations');
  return data;
}

// ── Writes (ADMIN only) ─────────────────────────────

export async function createCategory(name: string): Promise<CategoryRef> {
  const { data } = await apiClient.post<CategoryRef>('/api/admin/categories', { name });
  return data;
}

export async function updateCategory(id: number, name: string): Promise<CategoryRef> {
  const { data } = await apiClient.put<CategoryRef>(`/api/admin/categories/${id}`, { name });
  return data;
}

export async function deleteCategory(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/categories/${id}`);
}

export async function createDepartment(name: string): Promise<DepartmentRef> {
  const { data } = await apiClient.post<DepartmentRef>('/api/admin/departments', { name });
  return data;
}

export async function updateDepartment(id: number, name: string): Promise<DepartmentRef> {
  const { data } = await apiClient.put<DepartmentRef>(`/api/admin/departments/${id}`, { name });
  return data;
}

export async function deleteDepartment(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/departments/${id}`);
}

export async function createSection(name: string): Promise<SectionRef> {
  const { data } = await apiClient.post<SectionRef>('/api/admin/sections', { name });
  return data;
}

export async function updateSection(id: number, name: string): Promise<SectionRef> {
  const { data } = await apiClient.put<SectionRef>(`/api/admin/sections/${id}`, { name });
  return data;
}

export async function deleteSection(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/sections/${id}`);
}

export async function createProductionLine(
  name: string,
  sectionId: number | null,
): Promise<ProductionLineRef> {
  const { data } = await apiClient.post<ProductionLineRef>('/api/admin/production-lines', {
    name,
    ...(sectionId != null ? { sectionId } : {}),
  });
  return data;
}

export async function updateProductionLine(
  id: number,
  name: string,
  sectionId: number | null,
): Promise<ProductionLineRef> {
  const { data } = await apiClient.put<ProductionLineRef>(`/api/admin/production-lines/${id}`, {
    name,
    ...(sectionId != null ? { sectionId } : {}),
  });
  return data;
}

export async function deleteProductionLine(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/production-lines/${id}`);
}

export async function createStation(
  code: string,
  productionLineId: number | null,
): Promise<StationRef> {
  const { data } = await apiClient.post<StationRef>('/api/admin/stations', {
    code,
    rowIndex: 0,
    lineIndex: 0,
    isWorking: true,
    ...(productionLineId != null ? { productionLineId } : {}),
  });
  return data;
}

export async function updateStation(
  id: number,
  code: string,
  productionLineId: number | null,
): Promise<StationRef> {
  const { data } = await apiClient.put<StationRef>(`/api/admin/stations/${id}`, {
    code,
    ...(productionLineId != null ? { productionLineId } : {}),
  });
  return data;
}

export async function deleteStation(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/stations/${id}`);
}

// ── Helpers ─────────────────────────────────────────

export function getErrorDetail(err: unknown): string | null {
  const axiosErr = err as { response?: { data?: { message?: string } } };
  return axiosErr?.response?.data?.message ?? null;
}
