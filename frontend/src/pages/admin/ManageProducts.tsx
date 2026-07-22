import { useCallback, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusIcon, PencilIcon, TrashIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

import type { AirconProduct, PaginatedResponse } from '@/types';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/services/productApi';

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
  { value: 'split-type', label: 'Split Type' },
  { value: 'window-type', label: 'Window Type' },
  { value: 'floor-standing', label: 'Floor Standing' },
] as const;

export function ManageProducts() {
  const [products, setProducts] = useState<AirconProduct[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<AirconProduct>['pagination']>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AirconProduct | null>(null);

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
    try {
      const response = await getProducts({ page, pageSize: 10 });
      setProducts(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

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

  async function handleDelete(id: number) {
    if (!window.confirm('Are you sure you want to deactivate this product?')) return;
    try {
      await deleteProduct(id);
      await fetchProducts(pagination.page);
    } catch (error) {
      console.error('Failed to delete product:', error);
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
    } catch (error) {
      console.error('Failed to save product:', error);
    }
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(price);
  }

  function getTypeLabel(type: string) {
    return PRODUCT_TYPES.find((t) => t.value === type)?.label ?? type;
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
                        <Input placeholder="e.g. Daikin" {...field} />
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
                          {PRODUCT_TYPES.map((t) => (
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>HP</TableHead>
                <TableHead>BTU</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
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
                          onClick={() => handleOpenEdit(product)}
                          aria-label={`Edit ${product.brand} ${product.model}`}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => void handleDelete(product.id)}
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
    </div>
  );
}
