import { User, TechnicianDetail } from '../models';
import bcrypt from 'bcrypt';

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

export async function deactivateCustomer(customerId: number): Promise<void> {
  const user = await User.findByPk(customerId);

  if (!user || user.role !== 'customer') {
    const error = new Error('Customer not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  user.isActive = false;
  await user.save();
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
  } | null;
}

export interface CreateTechnicianInput {
  name: string;
  email: string;
  password: string;
  specialization: string;
  contactNumber: string;
}

export interface UpdateTechnicianInput {
  name?: string;
  specialization?: string;
  contactNumber?: string;
  availabilityStatus?: 'available' | 'busy' | 'unavailable';
}

// --- Technician Service Functions ---

export async function getTechnicians(): Promise<TechnicianListItem[]> {
  const technicians = await User.findAll({
    where: { role: 'technician' },
    attributes: ['id', 'name', 'email', 'isActive', 'createdAt'],
    include: [
      {
        model: TechnicianDetail,
        as: 'technicianDetail',
        attributes: ['id', 'specialization', 'contactNumber', 'availabilityStatus'],
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
        }
      : null,
  }));
}

export async function createTechnician(
  input: CreateTechnicianInput
): Promise<{ user: User; technicianDetail: TechnicianDetail }> {
  const existingUser = await User.findOne({ where: { email: input.email } });

  if (existingUser) {
    const error = new Error('Email already exists') as Error & { statusCode: number };
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await User.create({
    name: input.name,
    email: input.email,
    password: hashedPassword,
    role: 'technician',
    isActive: true,
  });

  const technicianDetail = await TechnicianDetail.create({
    userId: user.id,
    specialization: input.specialization,
    contactNumber: input.contactNumber,
    availabilityStatus: 'available',
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

  if (input.name) {
    user.name = input.name;
    await user.save();
  }

  if (user.technicianDetail && (input.specialization || input.contactNumber || input.availabilityStatus)) {
    if (input.specialization) {
      user.technicianDetail.specialization = input.specialization;
    }
    if (input.contactNumber) {
      user.technicianDetail.contactNumber = input.contactNumber;
    }
    if (input.availabilityStatus) {
      user.technicianDetail.availabilityStatus = input.availabilityStatus;
    }
    await user.technicianDetail.save();
  }
}

export async function deactivateTechnician(technicianId: number): Promise<void> {
  const user = await User.findByPk(technicianId);

  if (!user || user.role !== 'technician') {
    const error = new Error('Technician not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  user.isActive = false;
  await user.save();
}
