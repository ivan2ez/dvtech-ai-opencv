import { Op } from 'sequelize';
import { User, TechnicianDetail, ServiceRequest, TechnicianSchedule, Report } from '../models';
import bcrypt from 'bcrypt';
import { syncTechnicianAvailability } from './scheduleService';

// --- Types ---

export interface CustomerListItem {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
}

export interface PaginatedCustomers {
  data: CustomerListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// --- Service Functions ---

export async function getCustomers(
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedCustomers> {
  // Settle any timed deactivations that have elapsed before reading, so the
  // list reflects the true active state without a background job.
  await reactivateExpiredAccounts();

  const offset = (page - 1) * pageSize;

  const { count, rows } = await User.findAndCountAll({
    where: { role: 'customer' },
    attributes: ['id', 'name', 'email', 'isActive', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset,
  });

  const data: CustomerListItem[] = rows.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    createdAt: user.createdAt,
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

// --- Account activation / archive ---

/** The two account kinds an admin manages. */
export type AccountRole = 'customer' | 'technician';

export interface ArchivedAccountItem {
  id: number;
  name: string;
  email: string;
  role: AccountRole;
  createdAt: Date;
  /** When the account was archived. */
  deletedAt: Date | null;
}

/** Records that a permanent delete would remove along with the account. */
export interface AccountDeletionImpact {
  serviceRequests: number;
  schedules: number;
}

function notFound(role: AccountRole): Error & { statusCode: number } {
  const label = role === 'customer' ? 'Customer' : 'Technician';
  const error = new Error(`${label} not found`) as Error & { statusCode: number };
  error.statusCode = 404;
  return error;
}

function conflict(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 409;
  return error;
}

function forbidden(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 403;
  return error;
}

/**
 * The authenticated actor performing an account operation, passed through from
 * the controller so the service can enforce the rule server-side in addition to
 * the route's `roleMiddleware('admin')` guard (Req 12.6, 19.4).
 */
export interface AccountActor {
  userId: number;
  role: string;
}

/**
 * Loads an account of the expected role.
 *
 * `includeArchived` is required for archive operations (restore / permanent
 * delete), because User is paranoid and archived rows are hidden by default.
 */
async function findAccount(
  id: number,
  role: AccountRole,
  options: { includeArchived?: boolean } = {}
): Promise<User> {
  // Apply any elapsed timed reactivation first so a single-account lookup also
  // reflects the true active state.
  await reactivateExpiredAccounts();

  const user = await User.findByPk(id, { paranoid: !options.includeArchived });

  if (!user || user.role !== role) {
    throw notFound(role);
  }
  return user;
}

/**
 * Flips an account between Active and Inactive.
 *
 * A deactivated account can still be signed into but is excluded from work
 * assignment; archiving it removes access entirely.
 *
 * Technician-specific rules (from the revisions):
 *   - You cannot deactivate a technician who has an active
 *     (assigned / in-progress) task — they must finish it first.
 *   - Deactivating a technician forces their availability to 'unavailable'.
 *   - Reactivating recomputes availability from their live workload.
 */
/** Timed-deactivation spans the admin can choose, in whole days. */
const ALLOWED_DEACTIVATION_DAYS = [1, 2, 3, 4] as const;

export async function setAccountActive(
  id: number,
  role: AccountRole,
  isActive: boolean,
  /**
   * Optional auto-reactivation span, in days, when deactivating. One of 1–4.
   * Omitted (or null) means an indefinite ("forever") deactivation. Ignored
   * when activating.
   */
  durationDays?: number | null,
  /**
   * The authenticated actor. When supplied, the activation path enforces that
   * only an admin may activate an account (Req 12.6). The route already applies
   * `roleMiddleware('admin')`; this is the server-side belt-and-braces check.
   */
  actor?: AccountActor
): Promise<void> {
  // Activation is a distinct flow with its own explicit responses (Req 12):
  // 404 missing, 409 already-active, 403 unauthorized, plus archived-account
  // restore. It is handled separately so the responses are unambiguous.
  if (isActive) {
    return activateAccount(id, role, actor);
  }

  const user = await findAccount(id, role);

  if (role === 'technician') {
    const activeTasks = await TechnicianSchedule.count({
      where: {
        technicianId: id,
        status: { [Op.in]: ['assigned', 'accepted', 'in-progress'] },
      },
    });
    if (activeTasks > 0) {
      throw conflict(
        'This technician has active tasks. They must be completed or reassigned before deactivating.'
      );
    }
  }

  user.isActive = false;

  // Deactivating: record when to auto-reactivate, if a finite span was given.
  if (durationDays === undefined || durationDays === null) {
    user.reactivateAt = null; // indefinite ("forever")
  } else {
    const days = Math.trunc(Number(durationDays));
    if (!ALLOWED_DEACTIVATION_DAYS.includes(days as (typeof ALLOWED_DEACTIVATION_DAYS)[number])) {
      throw conflict('Deactivation duration must be 1, 2, 3, or 4 days — or left as forever.');
    }
    user.reactivateAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  await user.save();

  if (role === 'technician') {
    const detail = await TechnicianDetail.findOne({ where: { userId: id } });
    if (detail) {
      // Deactivated -> unavailable, no tasks can be assigned.
      detail.availabilityStatus = 'unavailable';
      await detail.save();
    }
  }
}

/**
 * Activates an account, with explicit, unambiguous responses for the failure
 * cases (Req 12):
 *
 *   - 404 when the target account does not exist for the given role (Req 12.4).
 *   - 409 when the account is already Active (Req 12.5).
 *   - 403 when the actor is not an admin (Req 12.6) — enforced here in addition
 *     to the route's `roleMiddleware('admin')`.
 *
 * On success it clears the account's deactivated state (isActive + any pending
 * timed reactivation) and its archived state (soft-delete), sets it Active, and
 * recomputes technician availability so the technician reappears in the
 * Availability_Service results and can log in again (Req 12.1, 12.2, 12.3).
 *
 * Any unexpected error is logged with its stack trace before being rethrown so
 * the error middleware can map it to a 500 (Req 12.7).
 */
async function activateAccount(
  id: number,
  role: AccountRole,
  actor?: AccountActor
): Promise<void> {
  // Server-side authorization check (Req 12.6). The route already restricts to
  // admins; this guards against any future caller that skips the middleware.
  if (actor && actor.role !== 'admin') {
    throw forbidden('You are not authorized to activate accounts.');
  }

  try {
    // Include archived rows: an archived (soft-deleted) account is restored as
    // part of activation, so it must be visible to the lookup (Req 12.1).
    const user = await findAccount(id, role, { includeArchived: true });

    // Already-active guard (Req 12.5). An account is "already Active" only when
    // it is both flagged active and not archived.
    if (user.isActive && !user.deletedAt) {
      throw conflict('This account is already active.');
    }

    // Clear archived state (Req 12.1).
    if (user.deletedAt) {
      await user.restore();
    }

    // Clear deactivated state: set Active and drop any pending timed
    // reactivation (Req 12.1).
    user.isActive = true;
    user.reactivateAt = null;
    await user.save();

    // Recompute availability so a reactivated technician becomes assignable
    // again and appears in Availability_Service results (Req 12.2, 12.3).
    if (role === 'technician') {
      const detail = await TechnicianDetail.findOne({ where: { userId: id } });
      if (detail) {
        await syncTechnicianAvailability(id, { force: true });
      }
    }
  } catch (error) {
    // Business-rule responses (404/409/403) carry an explicit statusCode and
    // are expected — rethrow them untouched. Anything else is an unexpected
    // fault: log it with its stack trace before it bubbles to the 500 handler
    // (Req 12.7).
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === undefined || statusCode >= 500) {
      console.error(
        `Unexpected error activating ${role} account ${id}:`,
        error instanceof Error ? error.stack : error
      );
    }
    throw error;
  }
}

/**
 * Auto-reactivates any account whose timed deactivation has elapsed.
 *
 * Evaluated lazily by the account read paths (list + lookup), mirroring the
 * reschedule/pending-request expiry pattern, so a timed deactivation flips back
 * to active without a background worker — which matters on the serverless
 * deployment. Technician availability is recomputed so a reactivated technician
 * becomes assignable again.
 */
export async function reactivateExpiredAccounts(): Promise<number> {
  const due = await User.findAll({
    where: {
      isActive: false,
      reactivateAt: { [Op.ne]: null, [Op.lte]: new Date() },
    },
    attributes: ['id', 'role'],
  });

  if (due.length === 0) return 0;

  await User.update(
    { isActive: true, reactivateAt: null },
    {
      where: {
        isActive: false,
        reactivateAt: { [Op.ne]: null, [Op.lte]: new Date() },
      },
    }
  );

  // Recompute availability for any reactivated technicians.
  for (const user of due) {
    if (user.role === 'technician') {
      await syncTechnicianAvailability(user.id, { force: true });
    }
  }

  return due.length;
}

/**
 * Soft-deletes (archives) an account.
 *
 * Refuses while the account is still Active: deactivating first is a deliberate
 * speed bump so an in-use account can't be archived by a single misclick.
 */
export async function archiveAccount(id: number, role: AccountRole): Promise<void> {
  const user = await findAccount(id, role);

  if (user.isActive) {
    throw conflict(
      'This account is still active. Deactivate it first, then delete it.'
    );
  }

  await user.destroy(); // paranoid → sets deleted_at
}

/** Returns an archived account to the active records table. */
export async function restoreAccount(id: number, role: AccountRole): Promise<void> {
  const user = await findAccount(id, role, { includeArchived: true });

  if (!user.deletedAt) {
    throw conflict('This account is not archived.');
  }

  await user.restore();
}

/**
 * Counts the records a permanent delete would take with it.
 *
 * Every user-referencing foreign key is ON DELETE CASCADE, so removing the row
 * also removes the account's service requests and technician assignments (and,
 * transitively, their room assessments, recommendations and reports). Surfacing
 * the counts lets the admin see the blast radius before confirming.
 */
export async function getAccountDeletionImpact(
  id: number,
  role: AccountRole
): Promise<AccountDeletionImpact> {
  await findAccount(id, role, { includeArchived: true });

  const [serviceRequests, schedules] = await Promise.all([
    ServiceRequest.count({ where: { userId: id } }),
    TechnicianSchedule.count({ where: { technicianId: id } }),
  ]);

  return { serviceRequests, schedules };
}

/**
 * Irreversibly removes an archived account and its cascaded records.
 *
 * Only archived accounts can be permanently deleted, so this is always a
 * two-step, explicitly-confirmed action rather than something reachable
 * directly from the main records table.
 */
export async function deleteAccountPermanently(id: number, role: AccountRole): Promise<void> {
  const user = await findAccount(id, role, { includeArchived: true });

  if (!user.deletedAt) {
    throw conflict('Archive this account before deleting it permanently.');
  }

  await user.destroy({ force: true });
}

/** Lists archived accounts of the given role, most recently archived first. */
export async function getArchivedAccounts(role: AccountRole): Promise<ArchivedAccountItem[]> {
  const rows = await User.findAll({
    where: { role, deletedAt: { [Op.ne]: null } },
    attributes: ['id', 'name', 'email', 'role', 'createdAt', 'deletedAt'],
    paranoid: false,
    order: [['deletedAt', 'DESC']],
  });

  return rows.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as AccountRole,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,
  }));
}

// --- Technician Types ---

export interface TechnicianListItem {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  technicianDetail: {
    id: number;
    specialization: string;
    contactNumber: string;
    availabilityStatus: string;
    street: string | null;
    barangay: string | null;
    city: string | null;
    province: string | null;
  } | null;
}

export interface CreateTechnicianInput {
  name: string;
  email: string;
  password: string;
  specialization: string;
  contactNumber: string;
  street?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
}

export interface UpdateTechnicianInput {
  name?: string;
  email?: string;
  specialization?: string;
  contactNumber?: string;
  availabilityStatus?: 'available' | 'unavailable';
  street?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
}

// --- Technician Service Functions ---

export async function getTechnicians(): Promise<TechnicianListItem[]> {
  // Settle elapsed timed deactivations before listing.
  await reactivateExpiredAccounts();

  const technicians = await User.findAll({
    where: { role: 'technician' },
    attributes: ['id', 'name', 'email', 'isActive', 'createdAt'],
    include: [
      {
        model: TechnicianDetail,
        as: 'technicianDetail',
        attributes: ['id', 'specialization', 'contactNumber', 'availabilityStatus', 'street', 'barangay', 'city', 'province'],
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  return technicians.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    createdAt: user.createdAt,
    technicianDetail: user.technicianDetail
      ? {
          id: user.technicianDetail.id,
          specialization: user.technicianDetail.specialization,
          contactNumber: user.technicianDetail.contactNumber,
          availabilityStatus: user.technicianDetail.availabilityStatus,
          street: user.technicianDetail.street,
          barangay: user.technicianDetail.barangay,
          city: user.technicianDetail.city,
          province: user.technicianDetail.province,
        }
      : null,
  }));
}

export async function createTechnician(
  input: CreateTechnicianInput
): Promise<{ user: User; technicianDetail: TechnicianDetail }> {
  // Emails are case-insensitive identifiers, so they are stored lowercased and
  // always compared in that canonical form. Archived accounts are included in
  // the check: the row still exists and can be restored, so its address is not
  // free to hand to someone else.
  const normalizedEmail = input.email.trim().toLowerCase();

  const existingUser = await User.findOne({
    where: { email: normalizedEmail },
    paranoid: false,
  });

  if (existingUser) {
    const error = new Error('Email already exists') as Error & {
      statusCode: number;
      errors: Array<{ field: string; message: string }>;
    };
    error.statusCode = 409;
    error.errors = [{ field: 'email', message: 'Email is already registered' }];
    throw error;
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await User.create({
    name: input.name,
    email: normalizedEmail,
    password: hashedPassword,
    role: 'technician',
    isActive: true,
  });

  const toNullable = (v: string | null | undefined): string | null => {
    if (v === null || v === undefined) return null;
    const trimmed = String(v).trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  const technicianDetail = await TechnicianDetail.create({
    userId: user.id,
    specialization: input.specialization,
    contactNumber: input.contactNumber,
    availabilityStatus: 'available',
    street: toNullable(input.street),
    barangay: toNullable(input.barangay),
    city: toNullable(input.city),
    province: toNullable(input.province),
  });

  return { user, technicianDetail };
}

export async function updateTechnician(
  technicianId: number,
  input: UpdateTechnicianInput
): Promise<void> {
  const user = await User.findByPk(technicianId, {
    include: [{ model: TechnicianDetail, as: 'technicianDetail' }],
  });

  if (!user || user.role !== 'technician') {
    const error = new Error('Technician not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  const userChanged = input.name !== undefined || input.email !== undefined;

  if (input.name) {
    user.name = input.name;
  }

  if (input.email) {
    const normalizedEmail = input.email.trim().toLowerCase();
    // Reject if another account already uses this email, archived ones included.
    const existing = await User.findOne({
      where: { email: normalizedEmail },
      paranoid: false,
    });
    if (existing && existing.id !== user.id) {
      const error = new Error('Email already in use') as Error & {
        statusCode: number;
        errors: Array<{ field: string; message: string }>;
      };
      error.statusCode = 409;
      error.errors = [{ field: 'email', message: 'Email is already registered' }];
      throw error;
    }
    user.email = normalizedEmail;
  }

  if (userChanged) {
    await user.save();
  }

  const hasAddressUpdate =
    input.street !== undefined ||
    input.barangay !== undefined ||
    input.city !== undefined ||
    input.province !== undefined;

  if (
    user.technicianDetail &&
    (input.specialization || input.contactNumber || input.availabilityStatus || hasAddressUpdate)
  ) {
    if (input.specialization) {
      user.technicianDetail.specialization = input.specialization;
    }
    if (input.contactNumber) {
      user.technicianDetail.contactNumber = input.contactNumber;
    }
    if (input.availabilityStatus) {
      user.technicianDetail.availabilityStatus = input.availabilityStatus;
    }
    // Address parts: undefined = leave unchanged; empty string = clear to null.
    const toNullable = (v: string | null | undefined): string | null => {
      if (v === null) return null;
      const trimmed = String(v).trim();
      return trimmed.length === 0 ? null : trimmed;
    };
    if (input.street !== undefined) user.technicianDetail.street = toNullable(input.street);
    if (input.barangay !== undefined) user.technicianDetail.barangay = toNullable(input.barangay);
    if (input.city !== undefined) user.technicianDetail.city = toNullable(input.city);
    if (input.province !== undefined) user.technicianDetail.province = toNullable(input.province);
    await user.technicianDetail.save();
  }
}

// --- Dashboard Stats ---

export interface DashboardStats {
  pendingRequests: number;
  activeTechnicians: number;
  totalCustomers: number;
  totalReports: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [pendingRequests, activeTechnicians, totalCustomers, totalReports] = await Promise.all([
    ServiceRequest.count({ where: { status: 'pending' } }),
    TechnicianDetail.count({ where: { availabilityStatus: 'available' } }),
    User.count({ where: { role: 'customer' } }),
    Report.count(),
  ]);

  return { pendingRequests, activeTechnicians, totalCustomers, totalReports };
}
