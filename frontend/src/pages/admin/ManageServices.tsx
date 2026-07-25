import { useCallback, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusIcon, PencilIcon, TrashIcon, RefreshCwIcon, ArrowUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

import type { ServiceType } from '@/types';
import {
  getServiceTypes,
  createServiceType,
  updateServiceType,
  deleteServiceType,
} from '@/services/serviceTypeApi';

const serviceTypeSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  price: z.coerce.number().min(0, 'Price must be positive').max(999999.99),
});

type ServiceTypeFormValues = z.infer<typeof serviceTypeSchema>;

type SortField = 'name' | 'price';
type SortDirection = 'asc' | 'desc';

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(price);
}

export function ManageServices() {
  const [services, setServices] = useState<ServiceType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingService, setDeletingService] = useState<ServiceType | null>(null);

  const form = useForm<ServiceTypeFormValues>({
    resolver: zodResolver(serviceTypeSchema) as unknown as Resolver<ServiceTypeFormValues>,
    defaultValues: {
      name: '',
      description: '',
      price: 0,
    },
  });

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getServiceTypes();
      setServices(data);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setError('Failed to load services. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  function handleOpenCreate() {
    setEditingService(null);
    form.reset({ name: '', description: '', price: 0 });
    setDialogOpen(true);
  }

  function handleOpenEdit(service: ServiceType) {
    setEditingService(service);
    form.reset({
      name: service.name,
      description: service.description,
      price: service.price,
    });
    setDialogOpen(true);
  }

  function handleOpenDeleteDialog(service: ServiceType) {
    setDeletingService(service);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingService) return;
    try {
      await deleteServiceType(deletingService.id);
      setDeleteDialogOpen(false);
      setDeletingService(null);
      await fetchServices();
    } catch (err) {
      console.error('Failed to delete service:', err);
      setError('Failed to delete service. Please try again.');
    }
  }

  async function onSubmit(values: ServiceTypeFormValues) {
    try {
      if (editingService) {
        await updateServiceType(editingService.id, values);
      } else {
        await createServiceType(values);
      }
      setDialogOpen(false);
      await fetchServices();
    } catch (err) {
      console.error('Failed to save service:', err);
      setError('Failed to save service. Please try again.');
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const sortedServices = [...services].sort((a, b) => {
    if (!sortField) return 0;
    const modifier = sortDirection === 'asc' ? 1 : -1;
    if (sortField === 'name') return a.name.localeCompare(b.name) * modifier;
    if (sortField === 'price') return (a.price - b.price) * modifier;
    return 0;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Services</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={handleOpenCreate} />}>
            <PlusIcon data-icon="inline-start" />
            Add Service
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingService ? 'Edit Service' : 'Add New Service'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Installation" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <textarea
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          placeholder="Describe this service..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (PHP)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingService ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => { setError(null); void fetchServices(); }}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading services...</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('name')}>
                      Name <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('price')}>
                      Price <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No services found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{service.description}</TableCell>
                      <TableCell>{formatPrice(service.price)}</TableCell>
                      <TableCell>
                        <Badge variant={service.isActive ? 'default' : 'secondary'}>
                          {service.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => handleOpenEdit(service)} aria-label={`Edit ${service.name}`}>
                            <PencilIcon />
                          </Button>
                          <Button variant="destructive" size="icon-sm" onClick={() => handleOpenDeleteDialog(service)} aria-label={`Delete ${service.name}`}>
                            <TrashIcon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {services.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No services found.</p>
            ) : (
              sortedServices.map((service) => (
                <Card key={service.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{service.name}</span>
                      <Badge variant={service.isActive ? 'default' : 'secondary'}>
                        {service.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                    <p className="text-sm font-medium">{formatPrice(service.price)}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenEdit(service)}>
                        <PencilIcon className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleOpenDeleteDialog(service)}>
                        <TrashIcon className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the service{' '}
            <span className="font-medium text-foreground">{deletingService?.name}</span>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleConfirmDelete()}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
