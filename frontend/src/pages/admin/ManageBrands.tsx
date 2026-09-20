import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  RefreshCwIcon,
  ImageIcon,
  TagIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  AlertTriangleIcon,
  CalendarClockIcon,
} from 'lucide-react';
import { toast } from 'sonner';

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
  getBrands,
  getArchivedBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  restoreBrand,
  deleteBrandPermanently,
  type Brand,
} from '@/services/brandApi';
import { DetailDialog, DetailItem } from '@/components/shared/DetailDialog';
import { validateImageFile } from '@/utils/fileValidation';

const BRAND_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const BRAND_NAME_MAX = 100;

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

function getLogoSrc(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('http')) return logoUrl;
  return `${API_BASE}${logoUrl}`;
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ManageBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [archivedBrands, setArchivedBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Archive dialogs
  const [restoringBrand, setRestoringBrand] = useState<Brand | null>(null);
  const [purgingBrand, setPurgingBrand] = useState<Brand | null>(null);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandName, setBrandName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [nameError, setNameError] = useState('');
  const [logoError, setLogoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null);

  // Details dialog
  const [detailBrand, setDetailBrand] = useState<Brand | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  function handleOpenDetails(brand: Brand) {
    setDetailBrand(brand);
    setDetailDialogOpen(true);
  }

  const fetchBrands = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getBrands();
      setBrands(data);
    } catch {
      setError('Failed to load brands.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchArchive = useCallback(async () => {
    setIsLoadingArchive(true);
    try {
      const data = await getArchivedBrands();
      setArchivedBrands(data);
    } catch {
      setError('Failed to load the brand archive.');
    } finally {
      setIsLoadingArchive(false);
    }
  }, []);

  useEffect(() => {
    void fetchBrands();
    void fetchArchive();
  }, [fetchBrands, fetchArchive]);

  /** Re-reads both lists after any mutation. */
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchBrands(), fetchArchive()]);
  }, [fetchBrands, fetchArchive]);

  function handleOpenCreate() {
    setEditingBrand(null);
    setBrandName('');
    setLogoFile(null);
    setLogoPreview(null);
    setNameError('');
    setLogoError('');
    setDialogOpen(true);
  }

  function handleOpenEdit(brand: Brand) {
    setEditingBrand(brand);
    setBrandName(brand.name);
    setLogoFile(null);
    setLogoPreview(getLogoSrc(brand.logoUrl));
    setNameError('');
    setLogoError('');
    setDialogOpen(true);
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError('');
    const file = e.target.files?.[0];
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    const err = validateImageFile(file, {
      maxMB: 2,
      types: BRAND_LOGO_TYPES,
      typeLabel: 'JPEG, PNG, WebP, or SVG',
    });
    if (err) {
      setLogoError(err);
      setLogoFile(null);
      setLogoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function validateBrandName(): boolean {
    const name = brandName.trim();
    if (!name) {
      setNameError('Brand name is required.');
      return false;
    }
    if (name.length > BRAND_NAME_MAX) {
      setNameError(`Brand name must be ${BRAND_NAME_MAX} characters or less.`);
      return false;
    }
    setNameError('');
    return true;
  }

  async function handleSave() {
    if (!validateBrandName() || logoError) return;
    const isEditing = Boolean(editingBrand);
    const name = brandName.trim();
    try {
      if (editingBrand) {
        await updateBrand(editingBrand.id, name, logoFile || undefined);
      } else {
        await createBrand(name, logoFile || undefined);
      }
      setDialogOpen(false);
      await refreshAll();
      toast.success(isEditing ? `Brand "${name}" updated.` : `Brand "${name}" created.`);
    } catch (err) {
      // Surface the server's message so "it's in the archive, restore it
      // instead" reaches the admin verbatim.
      const message = getApiErrorMessage(
        err,
        isEditing ? 'Failed to update brand.' : 'Failed to create brand. It may already exist.'
      );
      setError(message);
      toast.error(message);
    }
  }

  function handleOpenDelete(brand: Brand) {
    setDeletingBrand(brand);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingBrand) return;
    const name = deletingBrand.name;
    setIsMutating(true);
    try {
      await deleteBrand(deletingBrand.id);
      setDeleteDialogOpen(false);
      setDeletingBrand(null);
      await refreshAll();
      toast.success(`Brand "${name}" moved to the archive.`);
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to delete brand.');
      setError(message);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleConfirmRestore() {
    if (!restoringBrand) return;
    const name = restoringBrand.name;
    setIsMutating(true);
    try {
      await restoreBrand(restoringBrand.id);
      setRestoringBrand(null);
      await refreshAll();
      toast.success(`Brand "${name}" restored.`);
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to restore brand.');
      setError(message);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleConfirmPurge() {
    if (!purgingBrand) return;
    const name = purgingBrand.name;
    setIsMutating(true);
    try {
      await deleteBrandPermanently(purgingBrand.id);
      setPurgingBrand(null);
      await refreshAll();
      toast.success(`Brand "${name}" permanently deleted.`);
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to permanently delete brand.');
      setError(message);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Brands</h1>
          <p className="text-sm text-muted-foreground">Add and manage AC brands in your catalog</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Brand
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => { setError(null); void fetchBrands(); }}>
              <RefreshCwIcon className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="brands">
        <TabsList>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="archive">
            <span className="inline-flex items-center gap-1.5">
              <ArchiveIcon className="h-3.5 w-3.5" />
              Archive
              {archivedBrands.length > 0 && (
                <Badge variant="secondary" className="ml-0.5">
                  {archivedBrands.length}
                </Badge>
              )}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brands">
          {isLoading ? (
            <p className="text-muted-foreground py-4">Loading brands...</p>
          ) : (
            <>
              {/* Desktop Table — no Status column; a brand either exists or is archived */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Logo</TableHead>
                      <TableHead>Brand Name</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brands.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No brands found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      brands.map((brand) => (
                        <TableRow
                          key={brand.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleOpenDetails(brand)}
                        >
                          <TableCell>
                            {brand.logoUrl ? (
                              <img
                                src={getLogoSrc(brand.logoUrl)!}
                                alt={brand.name}
                                className="w-10 h-10 object-contain rounded"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{brand.name}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => handleOpenEdit(brand)} aria-label={`Edit ${brand.name}`}>
                                <PencilIcon />
                              </Button>
                              <Button variant="destructive" size="icon-sm" onClick={() => handleOpenDelete(brand)} aria-label={`Delete ${brand.name}`}>
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

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {brands.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No brands found.</p>
                ) : (
                  brands.map((brand) => (
                    <Card
                      key={brand.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleOpenDetails(brand)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {brand.logoUrl ? (
                            <img
                              src={getLogoSrc(brand.logoUrl)!}
                              alt={brand.name}
                              className="w-10 h-10 object-contain rounded"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{brand.name}</span>
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleOpenEdit(brand)}>
                            <PencilIcon />
                          </Button>
                          <Button variant="destructive" size="icon-sm" onClick={() => handleOpenDelete(brand)}>
                            <TrashIcon />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* Archive — restore or remove for good */}
        <TabsContent value="archive">
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Deleted brands are kept here. <span className="font-medium text-foreground">Restore</span>{' '}
              puts a brand back in the catalog.{' '}
              <span className="font-medium text-foreground">Delete Permanently</span> cannot be undone.
            </div>

            {isLoadingArchive ? (
              <p className="text-muted-foreground py-4">Loading archive...</p>
            ) : archivedBrands.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <ArchiveIcon className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">The archive is empty.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Logo</TableHead>
                        <TableHead>Brand Name</TableHead>
                        <TableHead>Deleted</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedBrands.map((brand) => (
                        <TableRow key={brand.id}>
                          <TableCell>
                            {brand.logoUrl ? (
                              <img
                                src={getLogoSrc(brand.logoUrl)!}
                                alt={brand.name}
                                className="w-10 h-10 object-contain rounded opacity-60"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{brand.name}</TableCell>
                          <TableCell>{formatDate(brand.deletedAt)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRestoringBrand(brand)}
                                aria-label={`Restore ${brand.name}`}
                              >
                                <ArchiveRestoreIcon className="h-4 w-4 mr-1" />
                                Restore
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setPurgingBrand(brand)}
                                aria-label={`Permanently delete ${brand.name}`}
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
                  {archivedBrands.map((brand) => (
                    <Card key={brand.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          {brand.logoUrl ? (
                            <img
                              src={getLogoSrc(brand.logoUrl)!}
                              alt={brand.name}
                              className="w-10 h-10 object-contain rounded opacity-60"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <span className="font-medium">{brand.name}</span>
                            <p className="text-xs text-muted-foreground">
                              Deleted {formatDate(brand.deletedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setRestoringBrand(brand)}
                          >
                            <ArchiveRestoreIcon className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() => setPurgingBrand(brand)}
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

      {/* Brand Details Dialog */}
      <DetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        title={detailBrand?.name ?? ''}
        subtitle="Brand"
        actions={
          detailBrand ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const brand = detailBrand;
                  setDetailDialogOpen(false);
                  handleOpenEdit(brand);
                }}
              >
                <PencilIcon className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const brand = detailBrand;
                  setDetailDialogOpen(false);
                  handleOpenDelete(brand);
                }}
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          ) : undefined
        }
      >
        {detailBrand && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {detailBrand.logoUrl ? (
                <img
                  src={getLogoSrc(detailBrand.logoUrl)!}
                  alt={detailBrand.name}
                  className="h-20 w-20 rounded-lg border object-contain bg-white p-2"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="grid gap-3">
                <DetailItem icon={TagIcon} label="Brand Name" value={detailBrand.name} />
                <DetailItem
                  icon={CalendarClockIcon}
                  label="Added"
                  value={formatDate(detailBrand.createdAt)}
                />
              </div>
            </div>
          </div>
        )}
      </DetailDialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingBrand ? 'Edit Brand' : 'Add New Brand'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand Name</label>
              <Input
                placeholder="Brand name"
                value={brandName}
                maxLength={BRAND_NAME_MAX}
                aria-invalid={!!nameError}
                onChange={(e) => {
                  setBrandName(e.target.value);
                  if (nameError) setNameError('');
                }}
              />
              {nameError && <p className="text-sm font-medium text-destructive">{nameError}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo (optional)</label>
              {logoPreview && (
                <div className="flex justify-center">
                  <img src={logoPreview} alt="Logo preview" className="w-20 h-20 object-contain rounded border" />
                </div>
              )}
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={handleLogoChange}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">Max 2MB. JPEG, PNG, WebP, or SVG.</p>
              {logoError && <p className="text-sm font-medium text-destructive">{logoError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={!brandName.trim() || !!logoError}>
              {editingBrand ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete (soft) Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Brand</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">{deletingBrand?.name}</span>? It will move
            to the Archive, where you can restore it or delete it permanently.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isMutating}>
              No
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={isMutating}
            >
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog
        open={restoringBrand !== null}
        onOpenChange={(open) => !open && setRestoringBrand(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restore Brand</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Restore <span className="font-medium text-foreground">{restoringBrand?.name}</span>? It
            will appear in the catalog and brand dropdowns again.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoringBrand(null)} disabled={isMutating}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={() => void handleConfirmRestore()}
              disabled={isMutating}
            >
              <ArchiveRestoreIcon className="h-4 w-4 mr-1" />
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Dialog */}
      <Dialog open={purgingBrand !== null} onOpenChange={(open) => !open && setPurgingBrand(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="h-4 w-4 text-destructive" />
              Delete Permanently
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Permanently delete <span className="font-medium text-foreground">{purgingBrand?.name}</span>?
              This cannot be undone, and its logo will be removed from storage.
            </p>
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-muted-foreground">
              Existing products keep their brand name, but this brand will no longer be selectable.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgingBrand(null)} disabled={isMutating}>
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
