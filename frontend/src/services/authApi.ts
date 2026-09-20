import api from './api';
import type {
  GmailOtpRequestResult,
  LoginCredentials,
  RegisterData,
  User,
} from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Step 1 of registration: ask the backend to email a 6-digit code to the Gmail
 * address the visitor entered. Also pre-checks that the email and Gmail are not
 * already taken, so a code is never sent for an unusable signup.
 */
export async function requestRegistrationOtpApi(
  email: string,
  gmail: string
): Promise<GmailOtpRequestResult> {
  const response = await api.post<GmailOtpRequestResult>('/auth/register/gmail-otp', {
    email,
    gmail,
  });
  return response.data;
}

/**
 * Emails a verification code to the new Gmail address a signed-in user wants to
 * switch to. The change is applied by `updateProfileApi` with the code attached.
 */
export async function requestProfileGmailOtpApi(
  gmail: string
): Promise<GmailOtpRequestResult> {
  const response = await api.post<GmailOtpRequestResult>('/auth/profile/gmail-otp', {
    gmail,
  });
  return response.data;
}

export async function loginApi(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/login', credentials);
  return response.data;
}

export async function registerApi(data: RegisterData): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/register', data);
  return response.data;
}

export async function getProfileApi(): Promise<User> {
  const response = await api.get<User>('/auth/profile');
  return response.data;
}

export interface UpdateProfileData {
  name: string;
  email: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  contactNumber?: string;
  /** Mandatory. Changing it requires `gmailOtp`. */
  gmail: string;
  /** 6-digit code, required only when `gmail` differs from the stored value. */
  gmailOtp?: string;
}

export async function updateProfileApi(data: UpdateProfileData): Promise<User> {
  const response = await api.put<User>('/auth/profile', data);
  return response.data;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export async function changePasswordApi(data: ChangePasswordData): Promise<{ message: string }> {
  const response = await api.put<{ message: string }>('/auth/password', data);
  return response.data;
}

export interface ForgotPasswordResponse {
  message: string;
  // Present only outside production, until email delivery is configured.
  resetToken?: string;
  resetUrl?: string;
}

export async function forgotPasswordApi(email: string): Promise<ForgotPasswordResponse> {
  const response = await api.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
  return response.data;
}

export async function resetPasswordApi(
  token: string,
  newPassword: string
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('/auth/reset-password', {
    token,
    newPassword,
  });
  return response.data;
}
