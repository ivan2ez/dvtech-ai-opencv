import { useCallback, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusIcon, PencilIcon, TrashIcon, RefreshCwIcon, ArrowUpDown, ThermometerIcon, HashIcon, FileTextIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { DetailDialog, DetailItem, DetailTextBlock } from '@/components/shared/DetailDialog';
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

import type { BtuFactor } from '@/types';
import {
  getBtuFactors,
  createBtuFactor,
  updateBtuFactor,
  deleteBtuFactor,
  getArchivedBtuFactors,
  restoreBtuFactor,
  deleteBtuFactorPermanently,
} from '@/services/btuFactorApi';
import { ArchivePanel } from '@/components/admin/ArchivePanel';

/**
 * Pulls the most specific message out of an axios error: a field-level
 * validation message if present, otherwise the top-level message.
 */
function getBtuFactorErrorMessage(err: unknown): string {
  const fallback = 'Failed to save BTU factor. Please try again.';
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: string; errors?: Array<{ message?: string }> } } }).response;
    const data = response?.data;
    if (data?.errors?.length && data.errors[0]?.message) return data.errors[0].message;
    if (data?.message) return data.message;
  }
  return fallback;
}

const btuFactorSchema = z.object({
  factorName: z.string().trim().min(1, 'Factor name is required').max(100, 'Name must be 100 characters or less'),
  // No upper limit — appliance adders can be large (e.g. +1000). Only reject
  // letters (non-numbers) and negatives, matching the backend rules.
  factorValue: z.coerce
    .number({ error: 'Factor value is required and must be a number' })
    .gt(0, 'Factor value must be greater than 0'),
  description: z.string().trim().max(500, 'Description must be 500 characters or less').optional(),
});

type BtuFactorFormValues = z.infer<typeof btuFactorSchema>;

type SortField = 'factorName' | 'factorValue';
type SortDirection = 'asc' | 'desc';

export function ManageBtuFactors() {
  const [factors, setFactors] = useState<BtuFactor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFactor, setEditingFactor] = useState<BtuFactor | null>(null);

  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Confirm delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFactor, setDeletingFactor] = useState<BtuFactor | null>(null);

  // Active list vs Archive (recycle bin) view.
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [archiveRefreshKey, setArchiveRefreshKey] = useState(0);

  // Details dialog state
  const [detailFactor, setDetailFactor] = useState<BtuFactor | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  function handleOpenDetails(factor: BtuFactor) {
    setDetailFactor(factor);
    setDetailDialogOpen(true);
  }

  const form = useForm<BtuFactorFormValues>({
    resolver: zodResolver(btuFactorSchema) as unknown as Resolver<BtuFactorFormValues>,
    defaultValues: {
      factorName: '',
      factorValue: 1,
      description: '',
    },
  });

  const fetchFactors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getBtuFactors();
      setFactors(data);
    } catch (err) {
      console.error('Failed to fetch BTU factors:', err);
      setError('Failed to load BTU factors. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFactors();
  }, [fetchFactors]);

  function handleOpenCreate() {
    setEditingFactor(null);
    form.reset({
      factorName: '',
      factorValue: 1,
      description: '',
    });
    setDialogOpen(true);
  }

  function handleOpenEdit(factor: BtuFactor) {
    setEditingFactor(factor);
    form.reset({
      factorName: factor.factorName,
      factorValue: factor.factorValue,
      description: factor.description ?? '',
    });
    setDialogOpen(true);
  }

  function handleOpenDeleteDialog(factor: BtuFactor) {
    setDeletingFactor(factor);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingFactor) return;
    const name = deletingFactor.factorName;
    try {
      await deleteBtuFactor(deletingFactor.id);
      setDeleteDialogOpen(false);
      setDeletingFactor(null);
      await fetchFactors();
      setArchiveRefreshKey((k) => k + 1);
      toast.success(`BTU factor "${name}" moved to the archive.`);
    } catch (err) {
      console.error('Failed to delete BTU factor:', err);
      setError('Failed to delete BTU factor. Please try again.');
      toast.error('Failed to delete BTU factor. Please try again.');
    }
  }

  async function onSubmit(values: BtuFactorFormValues) {
    const isEditing = Boolean(editingFactor);
    try {
      if (editingFactor) {
        await updateBtuFactor(editingFactor.id, values);
      } else {
        await createBtuFactor(values);
      }
      setDialogOpen(false);
      await fetchFactors();
      toast.success(
        isEditing
          ? `BTU factor "${values.factorName}" updated.`
          : `BTU factor "${values.factorName}" created.`
      );
    } catch (err) {
      console.error('Failed to save BTU factor:', err);
      // Surface the backend's specific message (e.g. a validation or duplicate-name
      // error) instead of a generic string, so the real cause is visible.
      const message = getBtuFactorErrorMessage(err);
      setError(message);
      toast.error(message);
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const sortedFactors = [...factors].sort((a, b) => {
    if (!sortField) return 0;
    const modifier = sortDirection === 'asc' ? 1 : -1;
    if (sortField === 'factorName') {
      return a.factorName.localeCompare(b.factorName) * modifier;
    }
    if (sortField === 'factorValue') {
      return (a.factorValue - b.factorValue) * modifier;
    }
    return 0;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage BTU Factors</h1>
          <p className="text-sm text-muted-foreground">Configure calculation factors for AI recommendations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={handleOpenCreate} />}>
            <PlusIcon data-icon="inline-start" />
            Add BTU Factor
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingFactor ? 'Edit BTU Factor' : 'Add New BTU Factor'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="factorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Factor Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Sun Exposure" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="factorValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Factor Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                        />
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
                        <Input placeholder="Optional description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingFactor ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* BTU factors vs Archive tabs */}
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
            {tab === 'active' ? 'BTU Factors' : 'Archive'}
          </button>
        ))}
      </div>

      {activeTab === 'archive' && (
        <ArchivePanel<BtuFactor>
          itemLabel="BTU factor"
          fetchArchived={getArchivedBtuFactors}
          onRestore={restoreBtuFactor}
          onPermanentDelete={deleteBtuFactorPermanently}
          refreshKey={archiveRefreshKey}
          columns={[
            { header: 'Factor', render: (f) => f.factorName },
            { header: 'Value', render: (f) => f.factorValue },
            { header: 'Description', render: (f) => f.description ?? '—', className: 'max-w-[320px] truncate' },
          ]}
        />
      )}

      {activeTab === 'active' && (
      <>
      {error && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => { setError(null); void fetchFactors(); }}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading BTU factors...</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('factorName')}>
                      Factor Name <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('factorValue')}>
                      Factor Value <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No BTU factors found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedFactors.map((factor) => (
                    <TableRow
                      key={factor.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenDetails(factor)}
                    >
                      <TableCell className="font-medium">{factor.factorName}</TableCell>
                      <TableCell>{factor.factorValue}</TableCell>
                      <TableCell>{factor.description ?? '—'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenEdit(factor)}
                            aria-label={`Edit ${factor.factorName}`}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            onClick={() => handleOpenDeleteDialog(factor)}
                            aria-label={`Delete ${factor.factorName}`}
                          >
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
            {factors.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No BTU factors found.</p>
            ) : (
              sortedFactors.map((factor) => (
                <Card
                  key={factor.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleOpenDetails(factor)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{factor.factorName}</span>
                      <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                        {factor.factorValue}
                      </span>
                    </div>
                    {factor.description && (
                      <p className="text-sm text-muted-foreground">{factor.description}</p>
                    )}
                    <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleOpenEdit(factor)}
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleOpenDeleteDialog(factor)}
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
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

      {/* BTU Factor Details Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        title={detailFactor?.factorName ?? ''}
        subtitle="BTU Calculation Factor"
        actions={
          detailFactor ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const factor = detailFactor;
                  setDetailDialogOpen(false);
                  handleOpenEdit(factor);
                }}
              >
                <PencilIcon className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const factor = detailFactor;
                  setDetailDialogOpen(false);
                  handleOpenDeleteDialog(factor);
                }}
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          ) : undefined
        }
      >
        {detailFactor && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem icon={ThermometerIcon} label="Factor Name" value={detailFactor.factorName} />
              <DetailItem icon={HashIcon} label="Factor Value" value={detailFactor.factorValue} />
            </div>

            {detailFactor.description && (
              <DetailTextBlock icon={FileTextIcon} label="Description">
                {detailFactor.description}
              </DetailTextBlock>
            )}
          </>
        )}
      </DetailDialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the BTU factor{' '}
            <span className="font-medium text-foreground">
              {deletingFactor?.factorName}
            </span>
            ? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
