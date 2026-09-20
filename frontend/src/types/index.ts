// Frontend type definitions

export type UserRole = 'admin' | 'technician' | 'customer';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  street: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  contactNumber: string | null;
  /** Verified Gmail address used for system notifications. */
  gmail: string | null;
  /** True once the OTP sent to `gmail` has been confirmed. */
  gmailVerified: boolean;
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
  /** Gmail address the account is verified against. Mandatory. */
  gmail: string;
  /** 6-digit code emailed to `gmail`. The account is not created without it. */
  gmailOtp: string;
}

/** Result of asking the backend to email a Gmail verification code. */
export interface GmailOtpRequestResult {
  message: string;
  /** Partially hidden address, safe to display (e.g. "ju•••@gmail.com"). */
  maskedGmail: string;
  expiresInMinutes: number;
  resendAvailableInSeconds: number;
  /** False when email delivery is not configured on the server. */
  delivered: boolean;
}

/** Compressor technology of an AC unit. */
export type ProductUnitType = 'inverter' | 'non-inverter';

export interface AirconProduct {
  id: number;
  brand: string;
  model: string;
  type: 'split-type' | 'window-type' | 'floor-standing';
  unitType: ProductUnitType;
  horsepower: number;
  btuCapacity: number;
  price: number;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  /** Admin display priority for the public catalog (higher shows first). */
  sortWeight: number;
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
  unitType: ProductUnitType;
  horsepower: number;
  btuCapacity: number;
  price: number;
  description?: string;
  imageUrl?: string;
  sortWeight?: number;
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
  /** Admin display priority for the public services list (higher shows first). */
  sortWeight: number;
  createdAt: string;
  updatedAt: string;
}

export type ServiceRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'assigned'
  | 'in-progress'
  | 'completed'
  | 'needs-rescheduling'
  | 'declined'
  | 'expired';

/** Bookable half-day slots. */
export type ServiceTimeSlot = 'morning' | 'afternoon';

export interface AssignedTechnicianSchedule {
  id: number;
  status: ScheduleStatus;
  priority: SchedulePriority;
  scheduledDate: string;
  createdAt: string;
  technician?: {
    id: number;
    name: string;
    email: string;
    technicianDetail?: {
      specialization: string;
      contactNumber: string;
      availabilityStatus: 'available' | 'unavailable';
      street?: string | null;
      barangay?: string | null;
      city?: string | null;
      province?: string | null;
    };
  };
}

export interface ServiceRequest {
  id: number;
  userId: number;
  serviceType: string;
  acDetails: string | null;
  status: ServiceRequestStatus;
  serviceStreet: string | null;
  serviceBarangay: string | null;
  serviceCity: string | null;
  serviceProvince: string | null;
  contactNumber: string | null;
  installBrand: string | null;
  installModel: string | null;
  serviceRequiredDate: string | null;
  /** Half-day slot the customer picked alongside the required date. */
  serviceRequiredTime: ServiceTimeSlot | null;
  rejectionReason: string | null;

  // Rescheduling proposal — populated while status is 'needs-rescheduling',
  // and retained afterwards as the record of what was offered.
  proposedDate: string | null;
  proposedTime: ServiceTimeSlot | null;
  proposedTechnicianId: number | null;
  rescheduleReason: string | null;
  rescheduleRequestedAt: string | null;
  /** Deadline for the customer's decision (48 hours after the proposal). */
  rescheduleExpiresAt: string | null;
  rescheduleRespondedAt: string | null;
  rescheduleDeclineNotes: string | null;
  /** Set when the customer has moved this request to their recycle bin. */
  customerDeletedAt?: string | null;
  proposedTechnician?: {
    id: number;
    name: string;
    email: string;
  } | null;

  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    name: string;
    email: string;
    street?: string | null;
    barangay?: string | null;
    city?: string | null;
    province?: string | null;
  };
  technicianSchedules?: AssignedTechnicianSchedule[];
}

export interface ServiceRequestFormData {
  serviceType: string;
  acDetails: string;
  serviceStreet: string;
  serviceBarangay: string;
  serviceCity: string;
  serviceProvince: string;
  contactNumber: string;
  installBrand?: string;
  installModel?: string;
  serviceRequiredDate: string;
  serviceRequiredTime: ServiceTimeSlot;
}

export type ScheduleStatus = 'assigned' | 'accepted' | 'rejected' | 'reassigned' | 'in-progress' | 'completed';
export type SchedulePriority = 'low' | 'medium' | 'high';

export type ScheduleTimeSlot = 'morning' | 'afternoon';

export interface TechnicianSchedule {
  id: number;
  technicianId: number;
  serviceRequestId: number;
  scheduledDate: string;
  scheduledTime?: ScheduleTimeSlot | null;
  status: ScheduleStatus;
  priority: SchedulePriority;
  report: string | null;
  reportPhotoPath: string | null;
  rejectionReason: string | null;
  completedAt: string | null;
  /**
   * Manila slot start instant (ISO string) — the boundary at/after which the
   * task may be started. Null when the date/slot cannot be resolved. The Start
   * control is disabled while `Date.now()` is before this instant (Req 15.2–15.4).
   */
  startableAt?: string | null;
  createdAt: string;
  updatedAt: string;
  serviceRequest?: ServiceRequest & {
    user?: {
      id: number;
      name: string;
      email: string;
      street?: string | null;
      barangay?: string | null;
      city?: string | null;
      province?: string | null;
    };
  };
  technician?: {
    id: number;
    name: string;
    email: string;
    technicianDetail?: {
      specialization: string;
      contactNumber: string;
      availabilityStatus: 'available' | 'unavailable';
      street?: string | null;
      barangay?: string | null;
      city?: string | null;
      province?: string | null;
    };
  };
}

export interface TechnicianInfo {
  id: number;
  name: string;
  email: string;
  technicianDetail?: {
    specialization: string;
    contactNumber: string;
    availabilityStatus: 'available' | 'unavailable';
    street?: string | null;
    barangay?: string | null;
    city?: string | null;
    province?: string | null;
  };
  activeTaskCount?: number;
}

export interface AssignTechnicianData {
  technicianId: number;
  serviceRequestId: number;
  scheduledDate: string;
  scheduledTime?: ScheduleTimeSlot;
  priority?: SchedulePriority;
}

/**
 * A technician returned by GET /schedules/available-technicians — only
 * technicians who are free for the requested date + slot appear here.
 */
export interface AvailableTechnician {
  id: number;
  name: string;
  email: string;
  contactNumber: string | null;
  availabilityStatus: 'available' | 'unavailable';
  tasksOnDate: number;
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
