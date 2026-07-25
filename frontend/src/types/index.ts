// Frontend type definitions

export type UserRole = 'admin' | 'technician' | 'customer';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface AirconProduct {
  id: number;
  brand: string;
  model: string;
  type: 'split-type' | 'window-type' | 'floor-standing';
  horsepower: number;
  btuCapacity: number;
  price: number;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ProductFormData {
  brand: string;
  model: string;
  type: 'split-type' | 'window-type' | 'floor-standing';
  horsepower: number;
  btuCapacity: number;
  price: number;
  description?: string;
  imageUrl?: string;
}

export interface BtuFactor {
  id: number;
  userId: number;
  factorName: string;
  factorValue: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BtuFactorFormData {
  factorName: string;
  factorValue: number;
  description?: string;
}

export interface ServiceType {
  id: number;
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ServiceRequestStatus = 'pending' | 'approved' | 'rejected' | 'assigned' | 'in-progress' | 'completed';

export interface ServiceRequest {
  id: number;
  userId: number;
  serviceType: string;
  acDetails: string | null;
  status: ServiceRequestStatus;
  createdAt: string;
  updatedAt: string;
  user?: { id: number; name: string; email: string };
}

export interface ServiceRequestFormData {
  serviceType: string;
  acDetails: string;
}

export type ScheduleStatus = 'assigned' | 'accepted' | 'rejected' | 'in-progress' | 'completed';
export type SchedulePriority = 'low' | 'medium' | 'high';

export interface TechnicianSchedule {
  id: number;
  technicianId: number;
  serviceRequestId: number;
  scheduledDate: string;
  status: ScheduleStatus;
  priority: SchedulePriority;
  report: string | null;
  createdAt: string;
  updatedAt: string;
  serviceRequest?: ServiceRequest & {
    user?: { id: number; name: string; email: string };
  };
  technician?: { id: number; name: string; email: string };
}

export interface TechnicianInfo {
  id: number;
  name: string;
  email: string;
  technicianDetail?: {
    specialization: string;
    contactNumber: string;
    availabilityStatus: 'available' | 'busy' | 'unavailable';
  };
  activeTaskCount?: number;
}

export interface AssignTechnicianData {
  technicianId: number;
  serviceRequestId: number;
  scheduledDate: string;
  priority?: SchedulePriority;
}

/**
 * Generic backend paginated response shape.
 * Used to map raw backend responses into the frontend PaginatedResponse<T> type.
 */
export interface BackendPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
