import { useCallback, useEffect, useRef, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, RefreshCwIcon, ImageIcon } from 'lucide-react';

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
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { getBrands, createBrand, updateBrand, deleteBrand, type Brand } from '@/services/brandApi';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

function getLogoSrc(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('http')) return logoUrl;
  return `${API_BASE}${logoUrl}`;
}

export function ManageBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandName, setBrandName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null);

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

  useEffect(() => {
    void fetchBrands();
  }, [fetchBrands]);

  function handleOpenCreate() {
    setEditingBrand(null);
    setBrandName('');
    setLogoFile(null);
    setLogoPreview(null);
    setDialogOpen(true);
  }

  function handleOpenEdit(brand: Brand) {
    setEditingBrand(brand);
    setBrandName(brand.name);
    setLogoFile(null);
    setLogoPreview(getLogoSrc(brand.logoUrl));
    setDialogOpen(true);
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  async function handleSave() {
    if (!brandName.trim()) return;
    try {
      if (editingBrand) {
        await updateBrand(editingBrand.id, brandName.trim(), logoFile || undefined);
      } else {
        await createBrand(brandName.trim(), logoFile || undefined);
      }
      setDialogOpen(false);
      await fetchBrands();
    } catch {
      setError(editingBrand ? 'Failed to update brand.' : 'Failed to create brand. It may already exist.');
    }
  }

  function handleOpenDelete(brand: Brand) {
    setDeletingBrand(brand);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingBrand) return;
    try {
      await deleteBrand(deletingBrand.id);
      setDeleteDialogOpen(false);
      setDeletingBrand(null);
      await fetchBrands();
    } catch {
      setError('Failed to deactivate brand.');
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Brands</h1>
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

      {isLoading ? (
        <p className="text-muted-foreground py-4">Loading brands...</p>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Logo</TableHead>
                  <TableHead>Brand Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No brands found.
                    </TableCell>
                  </TableRow>
                ) : (
                  brands.map((brand) => (
                    <TableRow key={brand.id}>
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
                      <TableCell>
                        <Badge variant={brand.isActive ? 'default' : 'secondary'}>
                          {brand.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => handleOpenEdit(brand)}>
                            <PencilIcon />
                          </Button>
                          <Button variant="destructive" size="icon-sm" onClick={() => handleOpenDelete(brand)}>
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
                <Card key={brand.id}>
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
                      <div>
                        <span className="font-medium">{brand.name}</span>
                        <Badge variant={brand.isActive ? 'default' : 'secondary'} className="ml-2">
                          {brand.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
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
                onChange={(e) => setBrandName(e.target.value)}
              />
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={!brandName.trim()}>
              {editingBrand ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Brand</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to deactivate <span className="font-medium text-foreground">{deletingBrand?.name}</span>?
            It will no longer appear in the brand dropdown.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleConfirmDelete()}>Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
