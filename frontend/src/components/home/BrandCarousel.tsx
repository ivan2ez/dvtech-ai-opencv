import { useEffect, useState } from 'react';
import { getBrands, type Brand } from '@/services/brandApi';

export function BrandCarousel() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getBrands()
      .then((data) => {
        const activeBrands = data.filter((b) => b.isActive);
        setBrands(activeBrands);
      })
      .catch(() => {
        // Silently fail — section just won't show
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || brands.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-16 bg-muted/20 border-y border-border/40">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
          Trusted Brands We Carry
        </p>

        {/* Responsive logo grid — all brands visible, no motion, scannable */}
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
          {brands.map((brand) => (
            <BrandItem key={brand.id} brand={brand} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BrandItem({ brand }: { brand: Brand }) {
  return (
    <div className="group flex items-center justify-center h-20 md:h-24 rounded-xl border border-border/50 bg-card/50 px-4 transition-all duration-300 hover:border-border hover:bg-card hover:shadow-sm">
      {brand.logoUrl ? (
        <img
          src={brand.logoUrl}
          alt={brand.name}
          className="h-10 md:h-12 w-auto max-w-[130px] object-contain grayscale opacity-70 transition-all duration-300 group-hover:grayscale-0 group-hover:opacity-100"
          loading="lazy"
        />
      ) : (
        <span className="text-sm md:text-base font-semibold text-muted-foreground whitespace-nowrap transition-colors duration-300 group-hover:text-foreground">
          {brand.name}
        </span>
      )}
    </div>
  );
}
