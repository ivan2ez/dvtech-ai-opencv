import { useCallback, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  PlusIcon,
  PencilIcon,
  BanIcon,
  SearchIcon,
  RefreshCwIcon,
  ArrowUpDown,
  MailIcon,
  CircleDotIcon,
  CalendarClockIcon,
  WrenchIcon,
  PhoneIcon,
  ActivityIcon,
  MapPinIcon,
  TrashIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DetailDialog, DetailItem } from '@/components/shared/DetailDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import type { PaginatedResponse } from '@/types';
import {
  getCustomers,
  getTechnicians,
  createTechnician,
  updateTechnician,
  setAccountActive,
  archiveAccount,
  getArchivedAccounts,
  restoreAccount,
  getAccountDeletionImpact,
  deleteAccountPermanently,
  type AccountRole,
  type ArchivedAccount,
  type AccountDeletionImpact,
  type CustomerAccount,
  type TechnicianAccount,
  type CreateTechnicianData,
  type UpdateTechnicianData,
} from '@/services/adminApi';

// --- Zod Schemas ---

const addressSchemaFields = {
  street: z.string().trim().max(255, 'Maximum 255 characters'),
  barangay: z.string().trim().max(255, 'Maximum 255 characters'),
  city: z.string().trim().max(255, 'Maximum 255 characters'),
  province: z.string().trim().max(255, 'Maximum 255 characters'),
};

/**
 * Pulls the backend's message out of an axios error.
 * Used so rule violations (e.g. deleting a still-active account) are shown
 * verbatim instead of a generic failure string.
 */
function getApiErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as Record<string, unknown>).response === 'object'
  ) {
    const response = (err as { response: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
}

/** Joins split address parts into a single readable line, or a dash if empty. */
function formatAddress(parts?: {
  street?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
} | null): string {
  if (!parts) return '—';
  const joined = [parts.street, parts.barangay, parts.city, parts.province]
    .map((p) => (p ?? '').trim())
    .filter((p) => p.length > 0)
    .join(', ');
  return joined || '—';
}

const createTechnicianSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be 100 characters or less'),
  email: z.string().trim().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit'
    ),
  specialization: z.string().trim().min(1, 'Specialization is required').max(100, 'Maximum 100 characters'),
  contactNumber: z
    .string()
    .trim()
    .regex(/^\d{11}$/, 'Contact number must be exactly 11 digits'),
  ...addressSchemaFields,
});

const editTechnicianSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be 100 characters or less'),
  email: z.string().trim().email('Invalid email address'),
  specialization: z.string().trim().min(1, 'Specialization is required').max(100, 'Maximum 100 characters'),
  contactNumber: z
    .string()
    .trim()
    .regex(/^\d{11}$/, 'Contact number must be exactly 11 digits'),
  ...addressSchemaFields,
});

type CreateTechnicianFormValues = z.infer<typeof createTechnicianSchema>;
type EditTechnicianFormValues = z.infer<typeof editTechnicianSchema>;

type CustomerSortField = 'name' | 'createdAt';
type TechSortField = 'name' | 'createdAt';
type SortDirection = 'asc' | 'desc';

// --- Component ---

export function ManageAccounts() {
  // Customer state
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [customerPagination, setCustomerPagination] = useState<PaginatedResponse<CustomerAccount>['pagination']>({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Technician state
  const [technicians, setTechnicians] = useState<TechnicianAccount[]>([]);
  const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(false);
  const [technicianSearch, setTechnicianSearch] = useState('');

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Sort state - customers
  const [customerSortField, setCustomerSortField] = useState<CustomerSortField | null>(null);
  const [customerSortDirection, setCustomerSortDirection] = useState<SortDirection>('asc');

  // Sort state - technicians
  const [techSortField, setTechSortField] = useState<TechSortField | null>(null);
  const [techSortDirection, setTechSortDirection] = useState<SortDirection>('asc');

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<TechnicianAccount | null>(null);

  // Identifies an account across both roles for the confirmation dialogs.
  type AccountTarget = { id: number; name: string; role: AccountRole };

  // Confirm activate/deactivate dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<(AccountTarget & { nextActive: boolean }) | null>(
    null
  );
  // Inline error shown in the deactivate dialog (e.g. the "active tasks" 409).
  const [statusError, setStatusError] = useState<string | null>(null);
  // Auto-reactivation span chosen when deactivating: 'forever' or 1–4 days.
  const [deactivateDuration, setDeactivateDuration] = useState<'forever' | '1' | '2' | '3' | '4'>(
    'forever'
  );

  // Confirm soft-delete (archive) dialog state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AccountTarget | null>(null);

  // Archive tab state
  const [archivedAccounts, setArchivedAccounts] = useState<ArchivedAccount[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');

  // Restore + permanent delete dialog state
  const [restoreTarget, setRestoreTarget] = useState<AccountTarget | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<AccountTarget | null>(null);
  const [purgeImpact, setPurgeImpact] = useState<AccountDeletionImpact | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Details dialog state
  const [detailCustomer, setDetailCustomer] = useState<CustomerAccount | null>(null);
  const [detailTechnician, setDetailTechnician] = useState<TechnicianAccount | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  function handleOpenCustomerDetails(customer: CustomerAccount) {
    setDetailCustomer(customer);
    setDetailTechnician(null);
    setDetailDialogOpen(true);
  }

  function handleOpenTechnicianDetails(technician: TechnicianAccount) {
    setDetailTechnician(technician);
    setDetailCustomer(null);
    setDetailDialogOpen(true);
  }

  // Forms
  const createForm = useForm<CreateTechnicianFormValues>({
    resolver: zodResolver(createTechnicianSchema) as unknown as Resolver<CreateTechnicianFormValues>,
    defaultValues: {
      name: '',
      email: '',
      password: '',
      specialization: '',
      contactNumber: '',
    },
  });

  const editForm = useForm<EditTechnicianFormValues>({
    resolver: zodResolver(editTechnicianSchema) as unknown as Resolver<EditTechnicianFormValues>,
    defaultValues: {
      name: '',
      email: '',
      specialization: '',
      contactNumber: '',
    },
  });

  // --- Data Fetching ---

  const fetchCustomers = useCallback(async (page = 1) => {
    setIsLoadingCustomers(true);
    setError(null);
    try {
      const response = await getCustomers({ page, pageSize: 20 });
      setCustomers(response.data);
      setCustomerPagination(response.pagination);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setError('Failed to load customers. Please try again.');
    } finally {
      setIsLoadingCustomers(false);
    }
  }, []);

  const fetchTechnicians = useCallback(async () => {
    setIsLoadingTechnicians(true);
    setError(null);
    try {
      const response = await getTechnicians();
      setTechnicians(response);
    } catch (err) {
      console.error('Failed to fetch technicians:', err);
      setError('Failed to load technicians. Please try again.');
    } finally {
      setIsLoadingTechnicians(false);
    }
  }, []);

  /** Loads both archives into one list so the tab can show a Role column. */
  const fetchArchive = useCallback(async () => {
    setIsLoadingArchive(true);
    setError(null);
    try {
      const [customers, technicians] = await Promise.all([
        getArchivedAccounts('customer'),
        getArchivedAccounts('technician'),
      ]);
      const merged = [...customers, ...technicians].sort((a, b) => {
        const aTime = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
        const bTime = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
        return bTime - aTime;
      });
      setArchivedAccounts(merged);
    } catch (err) {
      console.error('Failed to fetch archived accounts:', err);
      setError('Failed to load the archive. Please try again.');
    } finally {
      setIsLoadingArchive(false);
    }
  }, []);

  useEffect(() => {
    void fetchCustomers();
    void fetchTechnicians();
    void fetchArchive();
  }, [fetchCustomers, fetchTechnicians, fetchArchive]);

  /** Re-reads whichever lists a mutation could have changed. */
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchCustomers(customerPagination.page), fetchTechnicians(), fetchArchive()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCustomers, fetchTechnicians, fetchArchive, customerPagination.page]);

  // Filtered lists
  const filteredCustomers = customers.filter((c) => {
    const query = customerSearch.toLowerCase();
    return !query || c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query);
  });

  const filteredTechnicians = technicians.filter((t) => {
    const query = technicianSearch.toLowerCase();
    return !query || t.name.toLowerCase().includes(query) || t.email.toLowerCase().includes(query);
  });

  const filteredArchive = archivedAccounts.filter((a) => {
    const query = archiveSearch.toLowerCase();
    return !query || a.name.toLowerCase().includes(query) || a.email.toLowerCase().includes(query);
  });

  function toggleCustomerSort(field: CustomerSortField) {
    if (customerSortField === field) {
      setCustomerSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setCustomerSortField(field);
      setCustomerSortDirection('asc');
    }
  }

  function toggleTechSort(field: TechSortField) {
    if (techSortField === field) {
      setTechSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTechSortField(field);
      setTechSortDirection('asc');
    }
  }

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    if (!customerSortField) return 0;
    const modifier = customerSortDirection === 'asc' ? 1 : -1;
    if (customerSortField === 'name') {
      return a.name.localeCompare(b.name) * modifier;
    }
    if (customerSortField === 'createdAt') {
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * modifier;
    }
    return 0;
  });

  const sortedTechnicians = [...filteredTechnicians].sort((a, b) => {
    if (!techSortField) return 0;
    const modifier = techSortDirection === 'asc' ? 1 : -1;
    if (techSortField === 'name') {
      return a.name.localeCompare(b.name) * modifier;
    }
    if (techSortField === 'createdAt') {
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * modifier;
    }
    return 0;
  });

  // --- Activation / Archive Actions (shared by both roles) ---

  function handleOpenStatusDialog(target: AccountTarget, nextActive: boolean) {
    setStatusTarget({ ...target, nextActive });
    setStatusError(null);
    setDeactivateDuration('forever');
    setStatusDialogOpen(true);
  }

  function handleOpenArchiveDialog(target: AccountTarget) {
    setArchiveTarget(target);
    setArchiveDialogOpen(true);
  }

  async function handleConfirmStatusChange() {
    if (!statusTarget) return;
    const { id, name, role, nextActive } = statusTarget;
    setIsMutating(true);
    setStatusError(null);
    try {
      // When deactivating, pass the chosen auto-reactivation span (null =
      // forever). Ignored by the API when activating.
      const durationDays =
        nextActive || deactivateDuration === 'forever' ? null : Number(deactivateDuration);
      await setAccountActive(role, id, nextActive, durationDays);
      setStatusDialogOpen(false);
      setStatusTarget(null);
      await refreshAll();
      const successMessage = nextActive
        ? `"${name}" activated.`
        : durationDays
          ? `"${name}" deactivated for ${durationDays} day${durationDays > 1 ? 's' : ''}.`
          : `"${name}" deactivated.`;
      toast.success(successMessage);
    } catch (err) {
      console.error('Failed to change account status:', err);
      // Keep the dialog open and surface the backend's reason inline — most
      // often the 409 raised when deactivating a technician who still has an
      // active (assigned / in-progress) job. The message is shown verbatim so
      // the admin knows exactly why and what to do (complete or reassign first).
      setStatusError(
        getApiErrorMessage(err, 'Failed to update the account status. Please try again.')
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleConfirmArchive() {
    if (!archiveTarget) return;
    const { id, name, role } = archiveTarget;
    setIsMutating(true);
    try {
      await archiveAccount(role, id);
      setArchiveDialogOpen(false);
      setArchiveTarget(null);
      await refreshAll();
      toast.success(`"${name}" moved to the archive.`);
    } catch (err) {
      console.error('Failed to archive account:', err);
      // The backend refuses while the account is still active.
      toast.error(getApiErrorMessage(err, 'Failed to delete the account.'));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleConfirmRestore() {
    if (!restoreTarget) return;
    const { id, name, role } = restoreTarget;
    setIsMutating(true);
    try {
      await restoreAccount(role, id);
      setRestoreTarget(null);
      await refreshAll();
      toast.success(`"${name}" restored. The account can be used again.`);
    } catch (err) {
      console.error('Failed to restore account:', err);
      toast.error(getApiErrorMessage(err, 'Failed to restore the account.'));
    } finally {
      setIsMutating(false);
    }
  }

  /** Opens the permanent-delete dialog, loading what the delete would remove. */
  async function handleOpenPurgeDialog(target: AccountTarget) {
    setPurgeTarget(target);
    setPurgeImpact(null);
    try {
      setPurgeImpact(await getAccountDeletionImpact(target.role, target.id));
    } catch (err) {
      console.error('Failed to load deletion impact:', err);
      // Not fatal — the dialog still warns generically without the counts.
    }
  }

  async function handleConfirmPurge() {
    if (!purgeTarget) return;
    const { id, name, role } = purgeTarget;
    setIsMutating(true);
    try {
      await deleteAccountPermanently(role, id);
      setPurgeTarget(null);
      setPurgeImpact(null);
      await refreshAll();
      toast.success(`"${name}" permanently deleted.`);
    } catch (err) {
      console.error('Failed to permanently delete account:', err);
      toast.error(getApiErrorMessage(err, 'Failed to permanently delete the account.'));
    } finally {
      setIsMutating(false);
    }
  }

  // --- Technician Actions ---

  function handleOpenCreateTechnician() {
    createForm.reset({
      name: '',
      email: '',
      password: '',
      specialization: '',
      contactNumber: '',
      street: '',
      barangay: '',
      city: '',
      province: '',
    });
    setCreateDialogOpen(true);
  }

  function handleOpenEditTechnician(technician: TechnicianAccount) {
    setEditingTechnician(technician);
    editForm.reset({
      name: technician.name,
      email: technician.email,
      specialization: technician.technicianDetail?.specialization ?? '',
      contactNumber: technician.technicianDetail?.contactNumber ?? '',
      street: technician.technicianDetail?.street ?? '',
      barangay: technician.technicianDetail?.barangay ?? '',
      city: technician.technicianDetail?.city ?? '',
      province: technician.technicianDetail?.province ?? '',
    });
    setEditDialogOpen(true);
  }

  async function onCreateTechnician(values: CreateTechnicianFormValues) {
    try {
      const data: CreateTechnicianData = {
        name: values.name,
        email: values.email,
        password: values.password,
        specialization: values.specialization,
        contactNumber: values.contactNumber,
        street: values.street,
        barangay: values.barangay,
        city: values.city,
        province: values.province,
      };
      await createTechnician(data);
      setCreateDialogOpen(false);
      await fetchTechnicians();
      toast.success(`Technician "${values.name}" created.`);
    } catch (err) {
      console.error('Failed to create technician:', err);
      setError('Failed to create technician. Please try again.');
      toast.error('Failed to create technician. Please try again.');
    }
  }

  async function onEditTechnician(values: EditTechnicianFormValues) {
    if (!editingTechnician) return;
    try {
      const data: UpdateTechnicianData = {
        name: values.name,
        email: values.email,
        specialization: values.specialization,
        contactNumber: values.contactNumber,
        street: values.street,
        barangay: values.barangay,
        city: values.city,
        province: values.province,
      };
      await updateTechnician(editingTechnician.id, data);
      setEditDialogOpen(false);
      await fetchTechnicians();
      toast.success(`Technician "${values.name}" updated.`);
    } catch (err) {
      console.error('Failed to update technician:', err);
      setError('Failed to update technician. Please try again.');
      toast.error('Failed to update technician. Please try again.');
    }
  }

  // --- Helpers ---

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getAvailabilityBadgeVariant(status: string) {
    switch (status) {
      case 'available':
        return 'default' as const;
      case 'unavailable':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Accounts</h1>
          <p className="text-sm text-muted-foreground">View and manage customer and technician accounts</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => { setError(null); void fetchCustomers(customerPagination.page); void fetchTechnicians(); }}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
          <TabsTrigger value="archive">
            <span className="inline-flex items-center gap-1.5">
              <ArchiveIcon className="h-3.5 w-3.5" />
              Archive
              {archivedAccounts.length > 0 && (
                <Badge variant="secondary" className="ml-0.5">
                  {archivedAccounts.length}
                </Badge>
              )}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoadingCustomers ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading customers...</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleCustomerSort('name')}>
                            Name <ArrowUpDown className="h-4 w-4" />
                          </button>
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>
                          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleCustomerSort('createdAt')}>
                            Created <ArrowUpDown className="h-4 w-4" />
                          </button>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No customers found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedCustomers.map((customer) => (
                          <TableRow
                            key={customer.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleOpenCustomerDetails(customer)}
                          >
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell>{customer.email}</TableCell>
                            <TableCell>
                              <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                                {customer.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDate(customer.createdAt)}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <AccountActions
                                target={{ id: customer.id, name: customer.name, role: 'customer' }}
                                isActive={customer.isActive}
                                onToggle={handleOpenStatusDialog}
                                onDelete={handleOpenArchiveDialog}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No customers found.</p>
                  ) : (
                    sortedCustomers.map((customer) => (
                      <Card
                        key={customer.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleOpenCustomerDetails(customer)}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{customer.name}</span>
                            <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                              {customer.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p><span className="text-muted-foreground">Email:</span> {customer.email}</p>
                            <p><span className="text-muted-foreground">Created:</span> {formatDate(customer.createdAt)}</p>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <AccountActions
                              target={{ id: customer.id, name: customer.name, role: 'customer' }}
                              isActive={customer.isActive}
                              onToggle={handleOpenStatusDialog}
                              onDelete={handleOpenArchiveDialog}
                              full
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {customerPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing page {customerPagination.page} of {customerPagination.totalPages} ({customerPagination.totalItems} total)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={customerPagination.page <= 1}
                        onClick={() => void fetchCustomers(customerPagination.page - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={customerPagination.page >= customerPagination.totalPages}
                        onClick={() => void fetchCustomers(customerPagination.page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* Technicians Tab */}
        <TabsContent value="technicians">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or email..."
                  value={technicianSearch}
                  onChange={(e) => setTechnicianSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger render={<Button onClick={handleOpenCreateTechnician} />}>
                  <PlusIcon data-icon="inline-start" />
                  Create Technician
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Technician</DialogTitle>
                  </DialogHeader>
                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(onCreateTechnician)} className="space-y-4">
                      <FormField
                        control={createForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Full name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="email@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <PasswordInput placeholder="Min 8 characters" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="specialization"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Specialization</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Installation, Repair" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="contactNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Number</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. 09171234567" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="pt-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium">
                          <MapPinIcon className="h-3.5 w-3.5" />
                          Address
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Used to match technicians to the nearest customer requests.
                        </p>
                      </div>
                      <FormField
                        control={createForm.control}
                        name="street"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street</FormLabel>
                            <FormControl>
                              <Input placeholder="House no., street name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <FormField
                          control={createForm.control}
                          name="barangay"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Barangay</FormLabel>
                              <FormControl>
                                <Input placeholder="Barangay" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createForm.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input placeholder="City" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createForm.control}
                          name="province"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Province</FormLabel>
                              <FormControl>
                                <Input placeholder="Province" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Create</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {isLoadingTechnicians ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading technicians...</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleTechSort('name')}>
                            Name <ArrowUpDown className="h-4 w-4" />
                          </button>
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Specialization</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Availability</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>
                          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleTechSort('createdAt')}>
                            Created <ArrowUpDown className="h-4 w-4" />
                          </button>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTechnicians.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No technicians found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedTechnicians.map((technician) => (
                          <TableRow
                            key={technician.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleOpenTechnicianDetails(technician)}
                          >
                            <TableCell className="font-medium">{technician.name}</TableCell>
                            <TableCell>{technician.email}</TableCell>
                            <TableCell>{technician.technicianDetail?.specialization ?? '—'}</TableCell>
                            <TableCell>{technician.technicianDetail?.contactNumber ?? '—'}</TableCell>
                            <TableCell>
                              <Badge variant={getAvailabilityBadgeVariant(technician.technicianDetail?.availabilityStatus ?? 'unavailable')}>
                                {technician.technicianDetail?.availabilityStatus ?? 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={technician.isActive ? 'default' : 'secondary'}>
                                {technician.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDate(technician.createdAt)}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleOpenEditTechnician(technician)}
                                  aria-label={`Edit ${technician.name}`}
                                >
                                  <PencilIcon />
                                </Button>
                                <AccountActions
                                  target={{
                                    id: technician.id,
                                    name: technician.name,
                                    role: 'technician',
                                  }}
                                  isActive={technician.isActive}
                                  onToggle={handleOpenStatusDialog}
                                  onDelete={handleOpenArchiveDialog}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filteredTechnicians.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No technicians found.</p>
                  ) : (
                    sortedTechnicians.map((technician) => (
                      <Card
                        key={technician.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleOpenTechnicianDetails(technician)}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{technician.name}</span>
                            <Badge variant={technician.isActive ? 'default' : 'secondary'}>
                              {technician.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p><span className="text-muted-foreground">Email:</span> {technician.email}</p>
                            <p><span className="text-muted-foreground">Specialization:</span> {technician.technicianDetail?.specialization ?? '—'}</p>
                            <p><span className="text-muted-foreground">Contact:</span> {technician.technicianDetail?.contactNumber ?? '—'}</p>
                            <p>
                              <span className="text-muted-foreground">Availability:</span>{' '}
                              <Badge variant={getAvailabilityBadgeVariant(technician.technicianDetail?.availabilityStatus ?? 'unavailable')} className="ml-1">
                                {technician.technicianDetail?.availabilityStatus ?? 'N/A'}
                              </Badge>
                            </p>
                          </div>
                          <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => handleOpenEditTechnician(technician)}
                            >
                              <PencilIcon className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <AccountActions
                              target={{
                                id: technician.id,
                                name: technician.name,
                                role: 'technician',
                              }}
                              isActive={technician.isActive}
                              onToggle={handleOpenStatusDialog}
                              onDelete={handleOpenArchiveDialog}
                              full
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </>
            )}

            {/* Edit Technician Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Technician</DialogTitle>
                </DialogHeader>
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(onEditTechnician)} className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="specialization"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specialization</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Installation, Repair" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="contactNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Number</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 09171234567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="pt-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <MapPinIcon className="h-3.5 w-3.5" />
                        Address
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Used to match technicians to the nearest customer requests.
                      </p>
                    </div>
                    <FormField
                      control={editForm.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street</FormLabel>
                          <FormControl>
                            <Input placeholder="House no., street name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <FormField
                        control={editForm.control}
                        name="barangay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Barangay</FormLabel>
                            <FormControl>
                              <Input placeholder="Barangay" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="City" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="province"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Province</FormLabel>
                            <FormControl>
                              <Input placeholder="Province" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Update</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        {/* Archive Tab — deleted accounts, restorable or removable for good */}
        <TabsContent value="archive">
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Deleted accounts are kept here. <span className="font-medium text-foreground">Restore</span>{' '}
              returns an account to use. <span className="font-medium text-foreground">Delete Permanently</span>{' '}
              cannot be undone.
            </div>

            <div className="relative w-full sm:w-64">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or email..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoadingArchive ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading archive...</p>
              </div>
            ) : filteredArchive.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <ArchiveIcon className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {archiveSearch ? 'No archived accounts match your search.' : 'The archive is empty.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Deleted</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredArchive.map((account) => (
                        <TableRow key={`${account.role}-${account.id}`}>
                          <TableCell className="font-medium">{account.name}</TableCell>
                          <TableCell>{account.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {account.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {account.deletedAt ? formatDate(account.deletedAt) : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setRestoreTarget({
                                    id: account.id,
                                    name: account.name,
                                    role: account.role,
                                  })
                                }
                                aria-label={`Restore ${account.name}`}
                              >
                                <ArchiveRestoreIcon className="h-4 w-4 mr-1" />
                                Restore
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  void handleOpenPurgeDialog({
                                    id: account.id,
                                    name: account.name,
                                    role: account.role,
                                  })
                                }
                                aria-label={`Permanently delete ${account.name}`}
                              >
                                <TrashIcon className="h-4 w-4 mr-1" />
                                Delete Permanently
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filteredArchive.map((account) => (
                    <Card key={`${account.role}-${account.id}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{account.name}</span>
                          <Badge variant="secondary" className="capitalize">
                            {account.role}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="text-muted-foreground">Email:</span> {account.email}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Deleted:</span>{' '}
                            {account.deletedAt ? formatDate(account.deletedAt) : '—'}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() =>
                              setRestoreTarget({
                                id: account.id,
                                name: account.name,
                                role: account.role,
                              })
                            }
                          >
                            <ArchiveRestoreIcon className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() =>
                              void handleOpenPurgeDialog({
                                id: account.id,
                                name: account.name,
                                role: account.role,
                              })
                            }
                          >
                            <TrashIcon className="h-4 w-4 mr-1" />
                            Delete Permanently
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Account Details Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        title={detailCustomer?.name ?? detailTechnician?.name ?? ''}
        subtitle={detailCustomer ? 'Customer' : detailTechnician ? 'Technician' : undefined}
        headerRight={(() => {
          const acct = detailCustomer ?? detailTechnician;
          if (!acct) return undefined;
          return (
            <Badge variant={acct.isActive ? 'default' : 'secondary'}>
              {acct.isActive ? 'Active' : 'Inactive'}
            </Badge>
          );
        })()}
        identity={(() => {
          const acct = detailCustomer ?? detailTechnician;
          if (!acct) return undefined;
          return { name: acct.name, secondary: acct.email };
        })()}
        actions={(() => {
          const acct = detailCustomer ?? detailTechnician;
          if (!acct) return undefined;
          const target = {
            id: acct.id,
            name: acct.name,
            role: (detailCustomer ? 'customer' : 'technician') as AccountRole,
          };
          return (
            <>
              {detailTechnician && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const tech = detailTechnician;
                    setDetailDialogOpen(false);
                    handleOpenEditTechnician(tech);
                  }}
                >
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
              <AccountActions
                target={target}
                isActive={acct.isActive}
                onToggle={(t, nextActive) => {
                  setDetailDialogOpen(false);
                  handleOpenStatusDialog(t, nextActive);
                }}
                onDelete={(t) => {
                  setDetailDialogOpen(false);
                  handleOpenArchiveDialog(t);
                }}
              />
            </>
          );
        })()}
      >
        {(detailCustomer || detailTechnician) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailItem
              icon={MailIcon}
              label="Email"
              value={detailCustomer?.email ?? detailTechnician?.email ?? '—'}
            />
            <DetailItem
              icon={CircleDotIcon}
              label="Status"
              value={(detailCustomer ?? detailTechnician)?.isActive ? 'Active' : 'Inactive'}
            />
            <DetailItem
              icon={CalendarClockIcon}
              label="Member Since"
              value={formatDate((detailCustomer ?? detailTechnician)!.createdAt)}
            />

            {detailTechnician && (
              <>
                <DetailItem
                  icon={WrenchIcon}
                  label="Specialization"
                  value={detailTechnician.technicianDetail?.specialization ?? '—'}
                />
                <DetailItem
                  icon={PhoneIcon}
                  label="Contact"
                  value={detailTechnician.technicianDetail?.contactNumber ?? '—'}
                />
                <DetailItem
                  icon={ActivityIcon}
                  label="Availability"
                  value={
                    <span className="capitalize">
                      {detailTechnician.technicianDetail?.availabilityStatus ?? 'N/A'}
                    </span>
                  }
                />
                <div className="sm:col-span-2">
                  <DetailItem
                    icon={MapPinIcon}
                    label="Address"
                    value={formatAddress(detailTechnician.technicianDetail)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </DetailDialog>

      {/* Activate / Deactivate Confirmation */}
      <Dialog
        open={statusDialogOpen}
        onOpenChange={(open) => {
          setStatusDialogOpen(open);
          if (!open) setStatusError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {statusTarget?.nextActive ? 'Activate Account' : 'Deactivate Account'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {statusTarget?.nextActive ? (
              <>
                Reactivate the {statusTarget?.role} account for{' '}
                <span className="font-medium text-foreground">{statusTarget?.name}</span>? They will
                be able to use the system again.
              </>
            ) : (
              <>
                Deactivate the {statusTarget?.role} account for{' '}
                <span className="font-medium text-foreground">{statusTarget?.name}</span>? While
                deactivated they can still sign in but cannot be assigned work. An account must be
                deactivated before it can be deleted.
              </>
            )}
          </p>

          {/* Timed deactivation: auto-reactivates after the chosen span. */}
          {!statusTarget?.nextActive && (
            <div className="space-y-2">
              <label htmlFor="deactivate-duration" className="text-sm font-medium">
                Deactivation Period
              </label>
              <select
                id="deactivate-duration"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={deactivateDuration}
                onChange={(e) =>
                  setDeactivateDuration(e.target.value as 'forever' | '1' | '2' | '3' | '4')
                }
              >
                <option value="forever">Until manually reactivated (forever)</option>
                <option value="1">1 day</option>
                <option value="2">2 days</option>
                <option value="3">3 days</option>
                <option value="4">4 days</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {deactivateDuration === 'forever'
                  ? 'Stays deactivated until you reactivate it.'
                  : `Automatically reactivates after ${deactivateDuration} day${deactivateDuration === '1' ? '' : 's'}.`}
              </p>
            </div>
          )}

          {statusError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {statusError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(false)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button
              variant={statusTarget?.nextActive ? 'success' : 'destructive'}
              onClick={() => void handleConfirmStatusChange()}
              disabled={isMutating}
            >
              {statusTarget?.nextActive ? 'Activate' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete (soft) Confirmation — "Are you sure you want to delete this account?" */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the {archiveTarget?.role} account for{' '}
            <span className="font-medium text-foreground">{archiveTarget?.name}</span>? It will be
            moved to the Archive, where you can restore it or delete it permanently.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveDialogOpen(false)}
              disabled={isMutating}
            >
              No
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmArchive()}
              disabled={isMutating}
            >
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <Dialog open={restoreTarget !== null} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore Account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Restore the {restoreTarget?.role} account for{' '}
            <span className="font-medium text-foreground">{restoreTarget?.name}</span>? It will
            return to the records table and can be used again.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreTarget(null)} disabled={isMutating}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={() => void handleConfirmRestore()}
              disabled={isMutating}
            >
              <CheckCircle2Icon className="h-4 w-4 mr-1" />
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation — irreversible, so state the exact impact */}
      <Dialog
        open={purgeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPurgeTarget(null);
            setPurgeImpact(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="h-4 w-4 text-destructive" />
              Delete Permanently
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Permanently delete the {purgeTarget?.role} account for{' '}
              <span className="font-medium text-foreground">{purgeTarget?.name}</span>? This cannot
              be undone and the account can never be used again.
            </p>
            {purgeImpact && (purgeImpact.serviceRequests > 0 || purgeImpact.schedules > 0) && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">This will also remove:</p>
                <ul className="mt-1 list-inside list-disc text-muted-foreground">
                  {purgeImpact.serviceRequests > 0 && (
                    <li>
                      {purgeImpact.serviceRequests} service request
                      {purgeImpact.serviceRequests === 1 ? '' : 's'} and their reports
                    </li>
                  )}
                  {purgeImpact.schedules > 0 && (
                    <li>
                      {purgeImpact.schedules} technician assignment
                      {purgeImpact.schedules === 1 ? '' : 's'}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPurgeTarget(null);
                setPurgeImpact(null);
              }}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmPurge()}
              disabled={isMutating}
            >
              <TrashIcon className="h-4 w-4 mr-1" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Account row actions ─── */

/**
 * The Activate/Deactivate toggle plus the Delete button for one account.
 *
 * Delete is disabled while the account is Active — an account must be
 * deactivated first. The backend enforces the same rule, so this is a hint
 * rather than the guard itself.
 */
function AccountActions({
  target,
  isActive,
  onToggle,
  onDelete,
  full = false,
}: {
  target: { id: number; name: string; role: AccountRole };
  isActive: boolean;
  onToggle: (target: { id: number; name: string; role: AccountRole }, nextActive: boolean) => void;
  onDelete: (target: { id: number; name: string; role: AccountRole }) => void;
  /** Full-width stacked layout for the mobile card view. */
  full?: boolean;
}) {
  return (
    <div className={full ? 'space-y-2' : 'flex items-center gap-2'}>
      <Button
        variant={isActive ? 'destructive' : 'success'}
        size="sm"
        className={full ? 'w-full' : undefined}
        onClick={() => onToggle(target, !isActive)}
        aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${target.name}`}
      >
        {isActive ? (
          <>
            <BanIcon className="h-4 w-4 mr-1" />
            Deactivate
          </>
        ) : (
          <>
            <CheckCircle2Icon className="h-4 w-4 mr-1" />
            Activate
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={full ? 'w-full' : undefined}
        disabled={isActive}
        onClick={() => onDelete(target)}
        aria-label={`Delete ${target.name}`}
        title={isActive ? 'Deactivate the account before deleting it' : 'Move to archive'}
      >
        <TrashIcon className="h-4 w-4 mr-1" />
        Delete
      </Button>
    </div>
  );
}
