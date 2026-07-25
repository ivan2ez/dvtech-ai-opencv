import { useCallback, useEffect, useState } from 'react';
import { ArrowUpDown, Package, ChevronLeft, ChevronRight, XIcon } from 'lucide-react';

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { AirconProduct, PaginatedResponse } from '@/types';
import { getProducts, getProductImages, type ProductImageData } from '@/services/productApi';
import { getBrands, type Brand } from '@/services/brandApi';

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

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

function getImageSrc(imageUrl: string): string {
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
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
  const [brandFilter, setBrandFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [brands, setBrands] = useState<Brand[]>([]);

  // Product detail dialog
  const [selectedProduct, setSelectedProduct] = useState<AirconProduct | null>(null);
  const [productImages, setProductImages] = useState<ProductImageData[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

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
    void getBrands().then(setBrands).catch(() => {});
  }, [fetchProducts]);


  function handleTypeChange(value: string | null) {
    setTypeFilter(!value || value === '__all__' ? '' : value);
  }

  function handleBrandChange(value: string | null) {
    setBrandFilter(!value || value === '__all__' ? '' : value);
  }

  function clearFilters() {
    setTypeFilter('');
    setBrandFilter('');
  }

  function toggleSortOrder() {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  async function handleOpenProduct(product: AirconProduct) {
    setSelectedProduct(product);
    setActiveImageIndex(0);
    setIsLoadingImages(true);
    try {
      const images = await getProductImages(product.id);
      setProductImages(images);
    } catch {
      setProductImages([]);
    } finally {
      setIsLoadingImages(false);
    }
  }

  function handleCloseProduct() {
    setSelectedProduct(null);
    setProductImages([]);
    setActiveImageIndex(0);
  }

  function nextImage() {
    setActiveImageIndex((prev) => (prev + 1) % productImages.length);
  }

  function prevImage() {
    setActiveImageIndex((prev) => (prev - 1 + productImages.length) % productImages.length);
  }

  // Client-side brand filter
  const displayedProducts = brandFilter
    ? products.filter((p) => p.brand === brandFilter)
    : products;

  const hasActiveFilters = typeFilter !== '' || brandFilter !== '';

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
            <SelectValue>
              {typeFilter ? PRODUCT_TYPES.find(t => t.value === typeFilter)?.label : 'All Types'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_TYPES.map((t) => (
              <SelectItem key={t.value || '__all__'} value={t.value || '__all__'}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={brandFilter || '__all__'} onValueChange={handleBrandChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue>
              {brandFilter || 'All Brands'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.name}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={toggleSortOrder}>
          <ArrowUpDown className="mr-1 h-4 w-4" />
          Price: {sortOrder === 'asc' ? 'Low to High' : 'High to Low'}
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <XIcon className="mr-1 h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Result Count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          Showing {displayedProducts.length} of {pagination.totalItems} product{pagination.totalItems !== 1 ? 's' : ''}
          {hasActiveFilters && ' (filtered)'}
        </p>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">No products match your filters.</p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedProducts.map((product) => (
              <Card
                key={product.id}
                className="flex flex-col cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                onClick={() => void handleOpenProduct(product)}
              >
                {product.imageUrl ? (
                  <div className="relative overflow-hidden rounded-t-xl bg-muted">
                    <img
                      src={product.imageUrl}
                      alt={`${product.brand} ${product.model}`}
                      className="w-full h-48 object-contain"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-muted rounded-t-xl flex items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{product.brand} {product.model}</CardTitle>
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
                <CardFooter className="flex items-center justify-between">
                  <span className="text-lg font-bold text-primary">
                    {formatPrice(product.price)}
                  </span>
                  <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    View Details →
                  </span>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
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

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) handleCloseProduct(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedProduct.brand} {selectedProduct.model}</DialogTitle>
              </DialogHeader>

              {/* Image Gallery */}
              {isLoadingImages ? (
                <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Loading images...</p>
                </div>
              ) : productImages.length > 0 ? (
                <div className="space-y-3">
                  {/* Main Image */}
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <img
                      src={getImageSrc(productImages[activeImageIndex].imageUrl)}
                      alt={`${selectedProduct.brand} ${selectedProduct.model} - Image ${activeImageIndex + 1}`}
                      className="w-full h-64 sm:h-80 object-cover"
                    />
                    {productImages.length > 1 && (
                      <>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 hover:bg-white shadow"
                          onClick={prevImage}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 hover:bg-white shadow"
                          onClick={nextImage}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          {activeImageIndex + 1} / {productImages.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Thumbnails */}
                  {productImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {productImages.map((img, index) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setActiveImageIndex(index)}
                          className={`shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                            index === activeImageIndex ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'
                          }`}
                        >
                          <img
                            src={getImageSrc(img.imageUrl)}
                            alt={`Thumbnail ${index + 1}`}
                            className="w-16 h-16 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                </div>
              ) : selectedProduct.imageUrl ? (
                <img
                  src={selectedProduct.imageUrl}
                  alt={`${selectedProduct.brand} ${selectedProduct.model}`}
                  className="w-full h-64 object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                  <Package className="h-16 w-16 text-muted-foreground/50" />
                </div>
              )}

              {/* Product Details */}
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{getTypeLabel(selectedProduct.type)}</Badge>
                  <Badge variant="outline">{selectedProduct.brand}</Badge>
                  <span className="text-2xl font-bold text-primary ml-auto">{formatPrice(selectedProduct.price)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <span className="text-muted-foreground">Horsepower</span>
                    <p className="font-bold text-lg">{selectedProduct.horsepower} HP</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <span className="text-muted-foreground">BTU Capacity</span>
                    <p className="font-bold text-lg">{selectedProduct.btuCapacity.toLocaleString()}</p>
                  </div>
                </div>

                {selectedProduct.description && (
                  <div>
                    <p className="text-sm font-medium mb-1">Description</p>
                    <p className="text-sm text-muted-foreground">{selectedProduct.description}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
