import { useCallback, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusIcon, PencilIcon, BanIcon, SearchIcon, RefreshCwIcon, ArrowUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  deactivateCustomer,
  getTechnicians,
  createTechnician,
  updateTechnician,
  deactivateTechnician,
  type CustomerAccount,
  type TechnicianAccount,
  type CreateTechnicianData,
  type UpdateTechnicianData,
} from '@/services/adminApi';

// --- Zod Schemas ---

const createTechnicianSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit'
    ),
  specialization: z.string().min(1, 'Specialization is required').max(100, 'Maximum 100 characters'),
  contactNumber: z
    .string()
    .min(1, 'Contact number is required')
    .max(15, 'Maximum 15 digits')
    .regex(/^\d+$/, 'Contact number must contain only digits'),
});

const editTechnicianSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  specialization: z.string().min(1, 'Specialization is required').max(100, 'Maximum 100 characters'),
  contactNumber: z
    .string()
    .min(1, 'Contact number is required')
    .max(15, 'Maximum 15 digits')
    .regex(/^\d+$/, 'Contact number must contain only digits'),
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

  // Confirm deactivate dialog state
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivatingAccount, setDeactivatingAccount] = useState<{ id: number; name: string; type: 'customer' | 'technician' } | null>(null);

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

  useEffect(() => {
    void fetchCustomers();
    void fetchTechnicians();
  }, [fetchCustomers, fetchTechnicians]);

  // Filtered lists
  const filteredCustomers = customers.filter((c) => {
    const query = customerSearch.toLowerCase();
    return !query || c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query);
  });

  const filteredTechnicians = technicians.filter((t) => {
    const query = technicianSearch.toLowerCase();
    return !query || t.name.toLowerCase().includes(query) || t.email.toLowerCase().includes(query);
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

  // --- Customer Actions ---

  function handleOpenDeactivateCustomer(customer: CustomerAccount) {
    setDeactivatingAccount({ id: customer.id, name: customer.name, type: 'customer' });
    setDeactivateDialogOpen(true);
  }

  // --- Technician Actions ---

  function handleOpenCreateTechnician() {
    createForm.reset({
      name: '',
      email: '',
      password: '',
      specialization: '',
      contactNumber: '',
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
    });
    setEditDialogOpen(true);
  }

  function handleOpenDeactivateTechnician(technician: TechnicianAccount) {
    setDeactivatingAccount({ id: technician.id, name: technician.name, type: 'technician' });
    setDeactivateDialogOpen(true);
  }

  async function handleConfirmDeactivate() {
    if (!deactivatingAccount) return;
    try {
      if (deactivatingAccount.type === 'customer') {
        await deactivateCustomer(deactivatingAccount.id);
        await fetchCustomers(customerPagination.page);
      } else {
        await deactivateTechnician(deactivatingAccount.id);
        await fetchTechnicians();
      }
      setDeactivateDialogOpen(false);
      setDeactivatingAccount(null);
    } catch (err) {
      console.error('Failed to deactivate account:', err);
      setError('Failed to deactivate account. Please try again.');
    }
  }

  async function onCreateTechnician(values: CreateTechnicianFormValues) {
    try {
      const data: CreateTechnicianData = {
        name: values.name,
        email: values.email,
        password: values.password,
        specialization: values.specialization,
        contactNumber: values.contactNumber,
      };
      await createTechnician(data);
      setCreateDialogOpen(false);
      await fetchTechnicians();
    } catch (err) {
      console.error('Failed to create technician:', err);
      setError('Failed to create technician. Please try again.');
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
      };
      await updateTechnician(editingTechnician.id, data);
      setEditDialogOpen(false);
      await fetchTechnicians();
    } catch (err) {
      console.error('Failed to update technician:', err);
      setError('Failed to update technician. Please try again.');
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
      case 'busy':
        return 'secondary' as const;
      case 'unavailable':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Manage Accounts</h1>

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
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell>{customer.email}</TableCell>
                            <TableCell>
                              <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                                {customer.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDate(customer.createdAt)}</TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={!customer.isActive}
                                onClick={() => handleOpenDeactivateCustomer(customer)}
                                aria-label={`Deactivate ${customer.name}`}
                              >
                                <BanIcon className="h-4 w-4 mr-1" />
                                Deactivate
                              </Button>
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
                      <Card key={customer.id}>
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
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            disabled={!customer.isActive}
                            onClick={() => handleOpenDeactivateCustomer(customer)}
                          >
                            <BanIcon className="h-4 w-4 mr-1" />
                            Deactivate
                          </Button>
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
                              <Input type="password" placeholder="Min 8 characters" {...field} />
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
                          <TableRow key={technician.id}>
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
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleOpenEditTechnician(technician)}
                                  aria-label={`Edit ${technician.name}`}
                                >
                                  <PencilIcon />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon-sm"
                                  disabled={!technician.isActive}
                                  onClick={() => handleOpenDeactivateTechnician(technician)}
                                  aria-label={`Deactivate ${technician.name}`}
                                >
                                  <BanIcon />
                                </Button>
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
                      <Card key={technician.id}>
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
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleOpenEditTechnician(technician)}
                            >
                              <PencilIcon className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1"
                              disabled={!technician.isActive}
                              onClick={() => handleOpenDeactivateTechnician(technician)}
                            >
                              <BanIcon className="h-4 w-4 mr-1" />
                              Deactivate
                            </Button>
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
      </Tabs>

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deactivation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to deactivate the {deactivatingAccount?.type} account for{' '}
            <span className="font-medium text-foreground">
              {deactivatingAccount?.name}
            </span>
            ? They will no longer be able to access the system.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDeactivate()}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
