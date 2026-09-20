import { createContext, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthState, LoginCredentials, RegisterData, User } from '../types';
import {
  getProfileApi,
  loginApi,
  registerApi,
  updateProfileApi,
  type UpdateProfileData,
} from '../services/authApi';

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<User>;
  register: (data: RegisterData) => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<User>;
  logout: () => void;
  error: string | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user && !!token;

  // On mount, restore session from localStorage token
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await getProfileApi();
        setUser(profile);
        setToken(storedToken);
      } catch {
        // Token is invalid or expired — clear it
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<User> => {
    setError(null);
    try {
      const response = await loginApi(credentials);
      localStorage.setItem('token', response.token);
      setToken(response.token);
      setUser(response.user);
      return response.user;
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    setError(null);
    try {
      const response = await registerApi(data);
      localStorage.setItem('token', response.token);
      setToken(response.token);
      setUser(response.user);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      throw new AuthRequestError(message, getFieldErrors(err));
    }
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileData) => {
    const updated = await updateProfileApi(data);
    setUser(updated);
    return updated;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    updateProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export interface AuthFieldError {
  field: string;
  message: string;
}

/**
 * Error thrown by auth actions (login/register). Carries the user-facing
 * message plus any field-level errors returned by the backend (e.g. a
 * duplicate email), so forms can surface them inline on the relevant field.
 */
export class AuthRequestError extends Error {
  fieldErrors: AuthFieldError[];
  constructor(message: string, fieldErrors: AuthFieldError[] = []) {
    super(message);
    this.name = 'AuthRequestError';
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Normalises any thrown value into an AuthRequestError, pulling the message and
 * field-level errors out of an axios error response when present.
 *
 * Useful for auth-adjacent calls made outside this context (e.g. requesting a
 * Gmail verification code) so callers can handle every failure the same way.
 */
export function toAuthRequestError(err: unknown): AuthRequestError {
  if (err instanceof AuthRequestError) return err;
  return new AuthRequestError(getErrorMessage(err), getFieldErrors(err));
}

function getErrorMessage(err: unknown): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as Record<string, unknown>).response === 'object'
  ) {
    const response = (err as { response: { data?: { message?: string } } }).response;
    if (response.data?.message) {
      return response.data.message;
    }
  }
  return 'An unexpected error occurred';
}

function getFieldErrors(err: unknown): AuthFieldError[] {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as Record<string, unknown>).response === 'object'
  ) {
    const response = (err as { response: { data?: { errors?: unknown } } }).response;
    const errors = response.data?.errors;
    if (Array.isArray(errors)) {
      return errors.filter(
        (e): e is AuthFieldError =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as AuthFieldError).field === 'string' &&
          typeof (e as AuthFieldError).message === 'string'
      );
    }
  }
  return [];
}
