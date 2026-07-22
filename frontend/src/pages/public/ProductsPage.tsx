import { useCallback, useEffect, useState } from 'react';
import { ArrowUpDown, Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { AirconProduct, PaginatedResponse } from '@/types';
import { getProducts } from '@/services/productApi';

const PRODUCT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'split-type', label: 'Split Type' },
  { value: 'window-type', label: 'Window Type' },
  { value: 'floor-standing', label: 'Floor Standing' },
] as const;

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(price);
}

function getTypeLabel(type: string) {
  const found = PRODUCT_TYPES.find((t) => t.value === type);
  return found ? found.label : type;
}

export function ProductsPage() {
  const [products, setProducts] = useState<AirconProduct[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<AirconProduct>['pagination']>({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchProducts = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const params: { page: number; pageSize: number; type?: string; sortByPrice?: 'asc' | 'desc' } = {
        page,
        pageSize: 20,
        sortByPrice: sortOrder,
      };
      if (typeFilter) {
        params.type = typeFilter;
      }
      const response = await getProducts(params);
      setProducts(response.data);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, sortOrder]);

  useEffect(() => {
    void fetchProducts(1);
  }, [fetchProducts]);

  function handleTypeChange(value: string | null) {
    setTypeFilter(!value || value === '__all__' ? '' : value);
  }

  function toggleSortOrder() {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">AC Product Catalog</h1>
        <p className="text-muted-foreground">
          Browse our selection of air conditioning units
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter || '__all__'} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_TYPES.map((t) => (
              <SelectItem key={t.value || '__all__'} value={t.value || '__all__'}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={toggleSortOrder}>
          <ArrowUpDown className="mr-1 h-4 w-4" />
          Price: {sortOrder === 'asc' ? 'Low to High' : 'High to Low'}
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">No products are currently listed.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => (
              <Card key={product.id} className="flex flex-col">
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={`${product.brand} ${product.model}`}
                    className="w-full h-48 object-cover rounded-t-xl"
                  />
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{product.brand} {product.model}</CardTitle>
                  </div>
                  <Badge variant="secondary">{getTypeLabel(product.type)}</Badge>
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">HP:</span>{' '}
                      <span className="font-medium">{product.horsepower}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">BTU:</span>{' '}
                      <span className="font-medium">{product.btuCapacity.toLocaleString()}</span>
                    </div>
                  </div>
                  {product.description && (
                    <CardDescription className="line-clamp-2">
                      {product.description}
                    </CardDescription>
                  )}
                </CardContent>
                <CardFooter>
                  <span className="text-lg font-bold text-primary">
                    {formatPrice(product.price)}
                  </span>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} products)
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
