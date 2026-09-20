import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Package, ChevronLeft, ChevronRight, XIcon, Zap, Flame } from 'lucide-react';

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
  DialogFooter,
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

import { useScrollAnimation } from '@/hooks/useScrollAnimation';
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

function getImageSrc(imageUrl: string | undefined): string {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

export function ProductsPage() {
  const navigate = useNavigate();
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
  // 'default' keeps the admin best-selling weighting from the API; toggling
  // switches to an explicit price sort.
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default');
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
      };
      // Only send an explicit price sort when the customer chose one; otherwise
      // the API returns admin best-selling order (sort weight first).
      if (sortOrder !== 'default') {
        params.sortByPrice = sortOrder;
      }
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
    // Cycle: best-selling (default) -> price asc -> price desc -> back.
    setSortOrder((prev) => (prev === 'default' ? 'asc' : prev === 'asc' ? 'desc' : 'default'));
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

  /**
   * Sends the customer to the booking form pre-filled to quote this unit —
   * same deep-link pattern the AI recommendation page uses (Installation
   * service + brand/model in router state).
   */
  function requestQuotation(product: AirconProduct) {
    navigate('/service-request', {
      state: {
        serviceName: 'Installation',
        installBrand: product.brand,
        installModel: product.model,
      },
    });
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
    <div className="min-h-screen">
      {/* Hero Banner */}
      <section className="relative py-16 md:py-20 bg-gradient-to-b from-primary/5 to-background overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 h-[300px] w-[300px] rounded-full bg-primary/[0.04] blur-3xl" />
        </div>
        <div className="container relative mx-auto px-4 text-center space-y-4">
          <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wider">
            Product Catalog
          </Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
            AC Product Catalog
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg">
            Browse our curated selection of air conditioning units from top brands —
            split-type, window-type, and floor-standing models for every space.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-10 space-y-8 max-w-7xl">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
          <Select value={typeFilter || '__all__'} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-[170px] bg-background">
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
            <SelectTrigger className="w-[170px] bg-background">
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

          <Button variant="outline" size="sm" onClick={toggleSortOrder} className="bg-background">
            <ArrowUpDown className="mr-1.5 h-4 w-4" />
            {sortOrder === 'default'
              ? 'Best Selling'
              : `Price: ${sortOrder === 'asc' ? 'Low to High' : 'High to Low'}`}
          </Button>

          {hasActiveFilters && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={clearFilters}
            >
              <XIcon className="mr-1 h-3 w-3" />
              Clear filters
            </Badge>
          )}
        </div>

        {/* Content states */}
        {isLoading ? (
          <ProductsSkeleton />
        ) : displayedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-lg font-medium">No products match your filters.</p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <ProductGrid products={displayedProducts} onOpenProduct={handleOpenProduct} />

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => void fetchProducts(pagination.page - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => void fetchProducts(pagination.page + 1)}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) handleCloseProduct(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedProduct.brand} {selectedProduct.model}</DialogTitle>
              </DialogHeader>

              {/* Image Gallery */}
              {isLoadingImages ? (
                <div className="w-full h-64 sm:h-80 bg-muted rounded-lg animate-pulse" />
              ) : productImages.length > 0 ? (
                <div className="space-y-3">
                  {/* Main Image */}
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <img
                      src={getImageSrc(productImages[activeImageIndex]?.imageUrl)}
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
                            className="w-18 h-18 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : selectedProduct.imageUrl ? (
                <img
                  src={getImageSrc(selectedProduct.imageUrl)}
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
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedProduct.description}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseProduct}>
                  Close
                </Button>
                <Button onClick={() => requestQuotation(selectedProduct)}>
                  Request Quotation
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Product Grid with Scroll Animations ─── */
function ProductGrid({
  products,
  onOpenProduct,
}: {
  products: AirconProduct[];
  onOpenProduct: (product: AirconProduct) => void;
}) {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.05 });

  return (
    <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product, index) => (
        <Card
          key={product.id}
          className={`group flex flex-col cursor-pointer relative overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-500 border-border/50 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          style={{ transitionDelay: `${index * 60}ms` }}
          onClick={() => void onOpenProduct(product)}
        >
          {/* Image — imageUrl is kept in sync with the uploaded cover image by
              the backend. Resolve relative /uploads paths against the API. */}
          {product.imageUrl ? (
            <div className="relative overflow-hidden rounded-t-xl bg-muted/50">
              <img
                src={getImageSrc(product.imageUrl)}
                alt={`${product.brand} ${product.model}`}
                className="w-full h-52 object-contain p-2 group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.02] transition-colors" />
            </div>
          ) : (
            <div className="w-full h-52 bg-gradient-to-br from-muted/50 to-muted rounded-t-xl flex items-center justify-center">
              <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
                <Package className="h-7 w-7 text-muted-foreground/50" />
              </div>
            </div>
          )}

          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base leading-tight">{product.brand} {product.model}</CardTitle>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="secondary" className="text-xs">{getTypeLabel(product.type)}</Badge>
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-2 pb-3">
            {/* Specs as pills */}
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
                <Zap className="h-3 w-3" />
                <span className="font-medium">{product.horsepower} HP</span>
              </div>
              <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
                <Flame className="h-3 w-3" />
                <span className="font-medium">{product.btuCapacity.toLocaleString()} BTU</span>
              </div>
            </div>
            {product.description && (
              <CardDescription className="line-clamp-2 text-xs">
                {product.description}
              </CardDescription>
            )}
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-border/30">
            <span className="text-lg font-bold text-primary">
              {formatPrice(product.price)}
            </span>
            <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Request Quotation →
            </span>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

/* ─── Loading Skeleton ─── */
function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="flex flex-col animate-pulse overflow-hidden">
          <div className="w-full h-52 bg-muted rounded-t-xl" />
          <CardHeader className="pb-2">
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-5 w-20 rounded-full bg-muted mt-2" />
          </CardHeader>
          <CardContent className="flex-1 space-y-2 pb-3">
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-md bg-muted" />
              <div className="h-6 w-24 rounded-md bg-muted" />
            </div>
            <div className="h-3.5 w-full rounded bg-muted" />
            <div className="h-3.5 w-4/5 rounded bg-muted" />
          </CardContent>
          <CardFooter className="pt-0 border-t border-border/30">
            <div className="h-6 w-24 rounded bg-muted" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
