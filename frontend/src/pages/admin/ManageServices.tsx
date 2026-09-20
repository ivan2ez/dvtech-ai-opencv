import { useCallback, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  RefreshCwIcon,
  ArrowUpDown,
  WrenchIcon,
  DollarSignIcon,
  CircleDotIcon,
  FileTextIcon,
  EyeIcon,
  EyeOffIcon,
} from 'lucide-react';
import { toast } from 'sonner';

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
  getAllServiceTypesForAdmin,
  createServiceType,
  updateServiceType,
  setServiceTypeAvailability,
  deleteServiceType,
  getArchivedServiceTypes,
  restoreServiceType,
  deleteServiceTypePermanently,
} from '@/services/serviceTypeApi';
import { DetailDialog, DetailItem, DetailTextBlock } from '@/components/shared/DetailDialog';
import { ArchivePanel } from '@/components/admin/ArchivePanel';

/**
 * Services are either Available or Unavailable. Unavailable is a hard block:
 * the service is hidden from the customer's booking dropdown and the server
 * refuses requests naming it.
 */
function availabilityLabel(isAvailable: boolean): string {
  return isAvailable ? 'Available' : 'Unavailable';
}

function availabilityBadgeClass(isAvailable: boolean): string {
  return isAvailable
    ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
    : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
}

/** Pulls the backend's message out of an axios error. */
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

const serviceTypeSchema = z.object({
  name: z.string().trim().min(1, 'Service name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().trim().min(1, 'Description is required').max(500, 'Description must be 500 characters or less'),
  price: z.coerce.number().min(0, 'Price must be positive').max(999999.99, 'Price is too large'),
  // Higher weight shows the service earlier on the public list (a proxy for
  // most-availed). Whole number, 0 or more; 0 means "no boost".
  sortWeight: z.coerce
    .number({ error: 'Display priority must be a number' })
    .int('Display priority must be a whole number')
    .min(0, 'Display priority cannot be negative'),
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

  // Availability toggle confirmation
  const [togglingService, setTogglingService] = useState<ServiceType | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Active list vs Archive (recycle bin) view.
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [archiveRefreshKey, setArchiveRefreshKey] = useState(0);

  // Details dialog state
  const [detailService, setDetailService] = useState<ServiceType | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  function handleOpenDetails(service: ServiceType) {
    setDetailService(service);
    setDetailDialogOpen(true);
  }

  const form = useForm<ServiceTypeFormValues>({
    resolver: zodResolver(serviceTypeSchema) as unknown as Resolver<ServiceTypeFormValues>,
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      sortWeight: 0,
    },
  });

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Admin listing: includes Unavailable services so they can be re-enabled.
      const data = await getAllServiceTypesForAdmin();
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
    form.reset({ name: '', description: '', price: 0, sortWeight: 0 });
    setDialogOpen(true);
  }

  function handleOpenEdit(service: ServiceType) {
    setEditingService(service);
    form.reset({
      name: service.name,
      description: service.description,
      price: service.price,
      sortWeight: service.sortWeight ?? 0,
    });
    setDialogOpen(true);
  }

  function handleOpenDeleteDialog(service: ServiceType) {
    setDeletingService(service);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingService) return;
    const name = deletingService.name;
    setIsMutating(true);
    try {
      await deleteServiceType(deletingService.id);
      setDeleteDialogOpen(false);
      setDeletingService(null);
      await fetchServices();
      setArchiveRefreshKey((k) => k + 1);
      toast.success(`Service "${name}" moved to the archive.`);
    } catch (err) {
      console.error('Failed to delete service:', err);
      const message = getApiErrorMessage(err, 'Failed to delete service. Please try again.');
      setError(message);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  }

  /** Flips a service between Available and Unavailable. */
  async function handleConfirmToggleAvailability() {
    if (!togglingService) return;
    const { id, name, isActive } = togglingService;
    const next = !isActive;
    setIsMutating(true);
    try {
      await setServiceTypeAvailability(id, next);
      setTogglingService(null);
      await fetchServices();
      toast.success(`"${name}" is now ${availabilityLabel(next)}.`);
    } catch (err) {
      console.error('Failed to change service availability:', err);
      const message = getApiErrorMessage(err, 'Failed to update service availability.');
      setError(message);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  }

  async function onSubmit(values: ServiceTypeFormValues) {
    const isEditing = Boolean(editingService);
    try {
      if (editingService) {
        await updateServiceType(editingService.id, values);
      } else {
        await createServiceType(values);
      }
      setDialogOpen(false);
      await fetchServices();
      toast.success(
        isEditing ? `Service "${values.name}" updated.` : `Service "${values.name}" created.`
      );
    } catch (err) {
      console.error('Failed to save service:', err);
      setError('Failed to save service. Please try again.');
      toast.error('Failed to save service. Please try again.');
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Services</h1>
          <p className="text-sm text-muted-foreground">Configure service types and pricing</p>
        </div>
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
                <FormField
                  control={form.control}
                  name="sortWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Priority</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" min="0" placeholder="0" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Higher numbers appear first on the public services list (use it to surface
                        the most-availed services). 0 = normal.
                      </p>
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

      {/* Services vs Archive tabs */}
      <div className="flex items-center gap-1 border-b">
        {(['active', 'archive'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'active' ? 'Services' : 'Archive'}
          </button>
        ))}
      </div>

      {activeTab === 'archive' && (
        <ArchivePanel<ServiceType>
          itemLabel="service"
          fetchArchived={getArchivedServiceTypes}
          onRestore={restoreServiceType}
          onPermanentDelete={deleteServiceTypePermanently}
          refreshKey={archiveRefreshKey}
          columns={[
            { header: 'Name', render: (s) => s.name },
            { header: 'Description', render: (s) => s.description, className: 'max-w-[320px] truncate' },
          ]}
        />
      )}

      {activeTab === 'active' && (
      <>
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
                    <TableRow
                      key={service.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenDetails(service)}
                    >
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{service.description}</TableCell>
                      <TableCell>{formatPrice(service.price)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={availabilityBadgeClass(service.isActive)}>
                          {availabilityLabel(service.isActive)}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant={service.isActive ? 'outline' : 'success'}
                            size="sm"
                            onClick={() => setTogglingService(service)}
                            aria-label={`Mark ${service.name} ${service.isActive ? 'unavailable' : 'available'}`}
                            title={
                              service.isActive
                                ? 'Block this service and hide it from customers'
                                : 'Make this service bookable again'
                            }
                          >
                            {service.isActive ? (
                              <>
                                <EyeOffIcon className="h-4 w-4 mr-1" />
                                Make Unavailable
                              </>
                            ) : (
                              <>
                                <EyeIcon className="h-4 w-4 mr-1" />
                                Make Available
                              </>
                            )}
                          </Button>
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
                <Card
                  key={service.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleOpenDetails(service)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{service.name}</span>
                      <Badge variant="outline" className={availabilityBadgeClass(service.isActive)}>
                        {availabilityLabel(service.isActive)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                    <p className="text-sm font-medium">{formatPrice(service.price)}</p>
                    <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant={service.isActive ? 'outline' : 'success'}
                        size="sm"
                        className="w-full"
                        onClick={() => setTogglingService(service)}
                      >
                        {service.isActive ? (
                          <>
                            <EyeOffIcon className="h-4 w-4 mr-1" /> Make Unavailable
                          </>
                        ) : (
                          <>
                            <EyeIcon className="h-4 w-4 mr-1" /> Make Available
                          </>
                        )}
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenEdit(service)}>
                          <PencilIcon className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleOpenDeleteDialog(service)}>
                          <TrashIcon className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
      </>
      )}

      {/* Service Details Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        title={detailService?.name ?? ''}
        subtitle="Service"
        headerRight={
          detailService ? (
            <Badge variant="outline" className={availabilityBadgeClass(detailService.isActive)}>
              {availabilityLabel(detailService.isActive)}
            </Badge>
          ) : undefined
        }
        actions={
          detailService ? (
            <>
              <Button
                variant={detailService.isActive ? 'outline' : 'success'}
                size="sm"
                onClick={() => {
                  const service = detailService;
                  setDetailDialogOpen(false);
                  setTogglingService(service);
                }}
              >
                {detailService.isActive ? (
                  <>
                    <EyeOffIcon className="h-4 w-4 mr-1" />
                    Make Unavailable
                  </>
                ) : (
                  <>
                    <EyeIcon className="h-4 w-4 mr-1" />
                    Make Available
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const service = detailService;
                  setDetailDialogOpen(false);
                  handleOpenEdit(service);
                }}
              >
                <PencilIcon className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const service = detailService;
                  setDetailDialogOpen(false);
                  handleOpenDeleteDialog(service);
                }}
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          ) : undefined
        }
      >
        {detailService && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem icon={WrenchIcon} label="Service Name" value={detailService.name} />
              <DetailItem
                icon={DollarSignIcon}
                label="Price"
                value={formatPrice(detailService.price)}
              />
              <DetailItem
                icon={CircleDotIcon}
                label="Status"
                value={
                  <span>
                    {availabilityLabel(detailService.isActive)}
                    {!detailService.isActive && (
                      <span className="block text-xs text-muted-foreground">
                        Hidden from customers and blocked for booking
                      </span>
                    )}
                  </span>
                }
              />
            </div>

            {detailService.description && (
              <DetailTextBlock icon={FileTextIcon} label="Description">
                {detailService.description}
              </DetailTextBlock>
            )}
          </>
        )}
      </DetailDialog>

      {/* Availability Toggle Confirmation */}
      <Dialog
        open={togglingService !== null}
        onOpenChange={(open) => !open && setTogglingService(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {togglingService?.isActive ? 'Make Service Unavailable' : 'Make Service Available'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {togglingService?.isActive ? (
              <>
                Mark <span className="font-medium text-foreground">{togglingService?.name}</span> as
                Unavailable? It will be hidden from the customer's booking dropdown and can no
                longer be requested. Existing requests are unaffected.
              </>
            ) : (
              <>
                Mark <span className="font-medium text-foreground">{togglingService?.name}</span> as
                Available? Customers will be able to book it again.
              </>
            )}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTogglingService(null)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button
              variant={togglingService?.isActive ? 'destructive' : 'success'}
              onClick={() => void handleConfirmToggleAvailability()}
              disabled={isMutating}
            >
              {togglingService?.isActive ? 'Make Unavailable' : 'Make Available'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the service{' '}
              <span className="font-medium text-foreground">{deletingService?.name}</span>? This
              removes it from the catalog and cannot be undone.
            </p>
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-muted-foreground">
              To stop customers booking it without deleting it, use{' '}
              <span className="font-medium text-foreground">Make Unavailable</span> instead.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isMutating}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={isMutating}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
