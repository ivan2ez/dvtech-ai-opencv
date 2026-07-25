import { useCallback, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusIcon, PencilIcon, TrashIcon, SearchIcon, ArrowUpDown, ImageIcon } from 'lucide-react';

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

import type { AirconProduct, PaginatedResponse } from '@/types';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/services/productApi';
import { ProductImageManager } from '@/components/admin/ProductImageManager';
import { getBrands, type Brand } from '@/services/brandApi';

const productSchema = z.object({
  brand: z.string().min(1, 'Brand is required').max(100),
  model: z.string().min(1, 'Model is required').max(100),
  type: z.enum(['split-type', 'window-type', 'floor-standing']),
  horsepower: z.coerce.number().min(0.5).max(10),
  btuCapacity: z.coerce.number().int().min(5000).max(60000),
  price: z.coerce.number().min(0.01).max(999999.99),
  description: z.string().optional(),
  imageUrl: z.string().max(500).optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

const PRODUCT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'split-type', label: 'Split Type' },
  { value: 'window-type', label: 'Window Type' },
  { value: 'floor-standing', label: 'Floor Standing' },
] as const;

const PRODUCT_TYPES_FORM = [
  { value: 'split-type', label: 'Split Type' },
  { value: 'window-type', label: 'Window Type' },
  { value: 'floor-standing', label: 'Floor Standing' },
] as const;

type SortField = 'price' | 'btuCapacity';
type SortDirection = 'asc' | 'desc';

export function ManageProducts() {
  const [products, setProducts] = useState<AirconProduct[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<AirconProduct>['pagination']>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AirconProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Confirm delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<AirconProduct | null>(null);

  // Image manager state
  const [imageManagerOpen, setImageManagerOpen] = useState(false);
  const [imageManagerProduct, setImageManagerProduct] = useState<AirconProduct | null>(null);

  // Brands state
  const [brands, setBrands] = useState<Brand[]>([]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as unknown as Resolver<ProductFormValues>,
    defaultValues: {
      brand: '',
      model: '',
      type: 'split-type',
      horsepower: 1,
      btuCapacity: 9000,
      price: 0,
      description: '',
      imageUrl: '',
    },
  });

  const fetchProducts = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getProducts({ page, pageSize: 10 });
      setProducts(response.data);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('Failed to load products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
    void getBrands().then(setBrands).catch(() => {});
  }, [fetchProducts]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  // Client-side filtering and sorting
  const filteredProducts = products
    .filter((p) => {
      const matchesType = typeFilter === 'all' || p.type === typeFilter;
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        p.brand.toLowerCase().includes(query) ||
        p.model.toLowerCase().includes(query);
      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

  function handleOpenCreate() {
    setEditingProduct(null);
    form.reset({
      brand: '',
      model: '',
      type: 'split-type',
      horsepower: 1,
      btuCapacity: 9000,
      price: 0,
      description: '',
      imageUrl: '',
    });
    setDialogOpen(true);
  }

  function handleOpenEdit(product: AirconProduct) {
    setEditingProduct(product);
    form.reset({
      brand: product.brand,
      model: product.model,
      type: product.type,
      horsepower: product.horsepower,
      btuCapacity: product.btuCapacity,
      price: product.price,
      description: product.description ?? '',
      imageUrl: product.imageUrl ?? '',
    });
    setDialogOpen(true);
  }

  function handleOpenDeleteDialog(product: AirconProduct) {
    setDeletingProduct(product);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingProduct) return;
    try {
      await deleteProduct(deletingProduct.id);
      setDeleteDialogOpen(false);
      setDeletingProduct(null);
      await fetchProducts(pagination.page);
    } catch (err) {
      console.error('Failed to delete product:', err);
      setError('Failed to deactivate product. Please try again.');
    }
  }

  async function onSubmit(values: ProductFormValues) {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, values);
      } else {
        await createProduct(values);
      }
      setDialogOpen(false);
      await fetchProducts(pagination.page);
    } catch (err) {
      console.error('Failed to save product:', err);
      setError('Failed to save product. Please try again.');
    }
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(price);
  }

  function getTypeLabel(type: string) {
    return PRODUCT_TYPES_FORM.find((t) => t.value === type)?.label ?? type;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage Products</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={handleOpenCreate} />}>
            <PlusIcon data-icon="inline-start" />
            Add Product
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          {...field}
                        >
                          <option value="">Select a brand...</option>
                          {brands.map((b) => (
                            <option key={b.id} value={b.name}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. FTV-25AV1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                          {...field}
                        >
                          {PRODUCT_TYPES_FORM.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="horsepower"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horsepower</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="10"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="btuCapacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BTU Capacity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1000"
                            min="5000"
                            max="60000"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (PHP)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
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
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
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
                    {editingProduct ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search brand or model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="type-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Type:
          </label>
          <select
            id="type-filter"
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {PRODUCT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => { setError(null); void fetchProducts(pagination.page); }}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>HP</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => toggleSort('btuCapacity')}
                    >
                      BTU
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => toggleSort('price')}
                    >
                      Price
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.brand}</TableCell>
                      <TableCell>{product.model}</TableCell>
                      <TableCell>{getTypeLabel(product.type)}</TableCell>
                      <TableCell>{product.horsepower}</TableCell>
                      <TableCell>{product.btuCapacity.toLocaleString()}</TableCell>
                      <TableCell>{formatPrice(product.price)}</TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? 'default' : 'secondary'}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => { setImageManagerProduct(product); setImageManagerOpen(true); }}
                            aria-label={`Manage images for ${product.brand} ${product.model}`}
                          >
                            <ImageIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenEdit(product)}
                            aria-label={`Edit ${product.brand} ${product.model}`}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            onClick={() => handleOpenDeleteDialog(product)}
                            aria-label={`Delete ${product.brand} ${product.model}`}
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
            {filteredProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No products found.</p>
            ) : (
              filteredProducts.map((product) => (
                <Card key={product.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{product.brand} {product.model}</span>
                      <Badge variant={product.isActive ? 'default' : 'secondary'}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Type:</span> {getTypeLabel(product.type)}</p>
                      <p><span className="text-muted-foreground">HP:</span> {product.horsepower} | <span className="text-muted-foreground">BTU:</span> {product.btuCapacity.toLocaleString()}</p>
                      <p><span className="text-muted-foreground">Price:</span> {formatPrice(product.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => { setImageManagerProduct(product); setImageManagerOpen(true); }}
                      >
                        <ImageIcon className="h-4 w-4 mr-1" />
                        Images
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleOpenEdit(product)}
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleOpenDeleteDialog(product)}
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

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => void fetchProducts(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => void fetchProducts(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deactivation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to deactivate{' '}
            <span className="font-medium text-foreground">
              {deletingProduct?.brand} {deletingProduct?.model}
            </span>
            ? This product will no longer appear in active listings.
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
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Image Manager */}
      {imageManagerProduct && (
        <ProductImageManager
          productId={imageManagerProduct.id}
          productName={`${imageManagerProduct.brand} ${imageManagerProduct.model}`}
          open={imageManagerOpen}
          onOpenChange={setImageManagerOpen}
        />
      )}
    </div>
  );
}
