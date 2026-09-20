import api from './api';
import type { QuotationStatus } from '@/constants/quotationStatus';

/**
 * Quotation API client (C4 My Quotations / A6 Manage Quotations — Req 4, 11).
 *
 * The customer-facing calls (`listMyQuotations`, `getMyQuotation`) and the
 * admin-facing call (`listAllQuotations`) are intentionally separate functions
 * mirroring the two server scopes so the frontend can never confuse them. The
 * backend enforces ownership/access; these are thin transport wrappers.
 */

/**
 * A quotation row as returned by the backend for the list/detail views. The
 * admin listing additionally carries the owning `customer`; the customer
 * listing omits it (Req 4.3, 11.2).
 */
export interface Quotation {
  id: number;
  brand: string;
  model: string;
  details: string | null;
  status: QuotationStatus;
  /** ISO date string; the list is ordered most-recent-first by the server. */
  submittedAt: string;
  serviceRequestId: number | null;
  customer?: {
    id: number;
    name: string;
    email: string;
  };
}

/**
 * Lists the authenticated customer's own quotations, most recent first
 * (GET /api/quotations/mine — Req 4.1, 4.2, 4.4). Ownership is enforced
 * server-side from the JWT.
 */
export async function listMyQuotations(): Promise<Quotation[]> {
  const response = await api.get<{ quotations: Quotation[] }>('/quotations/mine');
  return response.data.quotations;
}

/**
 * Returns a single quotation the authenticated customer owns, for the details
 * action (GET /api/quotations/mine/:id — Req 4.3).
 */
export async function getMyQuotation(id: number): Promise<Quotation> {
  const response = await api.get<{ quotation: Quotation }>(`/quotations/mine/${id}`);
  return response.data.quotation;
}

/**
 * Lists every customer's quotations for the admin Manage Quotations view, most
 * recent first (GET /api/quotations — Req 11.1, 11.2, 11.3). Admin-only access
 * is enforced on the server by `roleMiddleware('admin')` (Req 11.8).
 */
export async function listAllQuotations(): Promise<Quotation[]> {
  const response = await api.get<{ quotations: Quotation[] }>('/quotations');
  return response.data.quotations;
}

/**
 * Creates a quotation for the authenticated customer from a chosen unit
 * (POST /api/quotations — Req 4). The owning user is taken from the JWT on the
 * server, so only brand/model/details are sent. Callers that render their own
 * inline error message pass `skipErrorToast` to avoid a duplicate toast.
 */
export async function createQuotation(payload: {
  brand: string;
  model: string;
  details?: string;
}): Promise<Quotation> {
  const response = await api.post<{ quotation: Quotation }>('/quotations', payload, {
    skipErrorToast: true,
  });
  return response.data.quotation;
}

/**
 * Admin: moves a quotation to a new status (PATCH /api/quotations/:id/status —
 * Req 11). At 'paid' the server wires the quotation into scheduling (Req 11.5,
 * 11.6). Admin-only access is enforced on the server by `roleMiddleware('admin')`.
 */
export async function updateQuotationStatus(
  id: number,
  status: QuotationStatus
): Promise<Quotation> {
  const response = await api.patch<{ quotation: Quotation }>(
    `/quotations/${id}/status`,
    { status }
  );
  return response.data.quotation;
}
