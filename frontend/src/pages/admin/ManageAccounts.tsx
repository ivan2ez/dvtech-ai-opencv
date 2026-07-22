import { useCallback, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusIcon, PencilIcon, BanIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

  // Technician state
  const [technicians, setTechnicians] = useState<TechnicianAccount[]>([]);
  const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(false);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<TechnicianAccount | null>(null);

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
    try {
      const response = await getCustomers({ page, pageSize: 20 });
      setCustomers(response.data);
      setCustomerPagination(response.pagination);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setIsLoadingCustomers(false);
    }
  }, []);

  const fetchTechnicians = useCallback(async () => {
    setIsLoadingTechnicians(true);
    try {
      const response = await getTechnicians();
      setTechnicians(response);
    } catch (error) {
      console.error('Failed to fetch technicians:', error);
    } finally {
      setIsLoadingTechnicians(false);
    }
  }, []);

  useEffect(() => {
    void fetchCustomers();
    void fetchTechnicians();
  }, [fetchCustomers, fetchTechnicians]);

  // --- Customer Actions ---

  async function handleDeactivateCustomer(id: number) {
    if (!window.confirm('Are you sure you want to deactivate this customer account?')) return;
    try {
      await deactivateCustomer(id);
      await fetchCustomers(customerPagination.page);
    } catch (error) {
      console.error('Failed to deactivate customer:', error);
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

  async function handleDeactivateTechnician(id: number) {
    if (!window.confirm('Are you sure you want to deactivate this technician account?')) return;
    try {
      await deactivateTechnician(id);
      await fetchTechnicians();
    } catch (error) {
      console.error('Failed to deactivate technician:', error);
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
    } catch (error) {
      console.error('Failed to create technician:', error);
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
    } catch (error) {
      console.error('Failed to update technician:', error);
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

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <div className="space-y-4">
            {isLoadingCustomers ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading customers...</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No customers found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      customers.map((customer) => (
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
                              onClick={() => void handleDeactivateCustomer(customer.id)}
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
            <div className="flex justify-end">
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicians.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No technicians found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    technicians.map((technician) => (
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
                              onClick={() => void handleDeactivateTechnician(technician.id)}
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
    </div>
  );
}
