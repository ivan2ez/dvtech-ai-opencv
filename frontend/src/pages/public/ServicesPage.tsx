import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  Wind,
  Thermometer,
  Sparkles,
  Droplets,
  Truck,
  Fan,
  Gauge,
  Cog,
  MessageCircle,
  ArrowUpDown,
  SearchIcon,
  ArrowRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { useAuth } from '@/hooks/useAuth';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import type { ServiceType } from '@/types';
import { getServiceTypes } from '@/services/serviceTypeApi';

// Map service names to icons for visual differentiation
const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Installation': Wind,
  'Preventive Maintenance': Cog,
  'Repair': Wrench,
  'General Cleaning': Sparkles,
  'Freon Recharge': Droplets,
  'Relocation': Truck,
  'Duct Cleaning': Fan,
  'Thermostat Replacement': Thermometer,
  'Compressor Repair': Gauge,
  'Consultation': MessageCircle,
};

function getServiceIcon(name: string): React.ComponentType<{ className?: string }> {
  return SERVICE_ICONS[name] ?? Wrench;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(price);
}

type SortOrder = 'default' | 'asc' | 'desc';

export function ServicesPage() {
  const { isAuthenticated, user } = useAuth();
  const [services, setServices] = useState<ServiceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  useEffect(() => {
    async function fetchServices() {
      try {
        const data = await getServiceTypes();
        setServices(data.filter((s) => s.isActive));
      } catch (error) {
        console.error('Failed to fetch services:', error);
      } finally {
        setIsLoading(false);
      }
    }
    void fetchServices();
  }, []);

  function cycleSortOrder() {
    setSortOrder((prev) => {
      if (prev === 'default') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'default';
    });
  }

  const filteredServices = services
    .filter((s) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortOrder === 'asc') return a.price - b.price;
      if (sortOrder === 'desc') return b.price - a.price;
      return 0;
    });

  const sortLabel = sortOrder === 'asc' ? 'Price: Low to High' : sortOrder === 'desc' ? 'Price: High to Low' : 'Most Availed';

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <section className="relative py-16 md:py-20 bg-gradient-to-b from-primary/5 to-background overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 h-[300px] w-[300px] rounded-full bg-primary/[0.04] blur-3xl" />
        </div>
        <div className="container relative mx-auto px-4 text-center space-y-4">
          <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wider">
            Professional AC Services
          </Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
            Our Services
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg">
            Expert air conditioning installation, maintenance, and repair services
            for your home or business — backed by 30+ certified technicians.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-10 space-y-8 max-w-7xl">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={cycleSortOrder}>
            <ArrowUpDown className="mr-1.5 h-4 w-4" />
            {sortLabel}
          </Button>
        </div>

        {/* Content states */}
        {isLoading ? (
          <ServicesSkeleton />
        ) : filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Wrench className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-lg font-medium">
              {searchQuery ? 'No services match your search.' : 'No services are currently available.'}
            </p>
            {searchQuery && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <ServiceGrid
            services={filteredServices}
            isAuthenticated={isAuthenticated}
            userRole={user?.role ?? null}
          />
        )}

        {/* Guest CTA Banner */}
        {!isAuthenticated && !isLoading && filteredServices.length > 0 && (
          <GuestCTABanner />
        )}
      </section>
    </div>
  );
}

/* ─── Service Grid with Scroll Animations ─── */
function ServiceGrid({
  services,
  isAuthenticated,
  userRole,
}: {
  services: ServiceType[];
  isAuthenticated: boolean;
  userRole: string | null;
}) {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.05 });

  return (
    <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {services.map((service, index) => {
        const Icon = getServiceIcon(service.name);
        return (
          <Card
            key={service.id}
            className={`group flex flex-col relative overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-500 border-border/50 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ transitionDelay: `${index * 80}ms` }}
          >
            {/* Top accent line on hover */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <Badge variant="secondary" className="text-xs font-semibold shrink-0">
                  {formatPrice(service.price)}
                </Badge>
              </div>
              <CardTitle className="text-lg mt-3">{service.name}</CardTitle>
              <CardDescription className="text-sm leading-relaxed line-clamp-3">
                {service.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1" />

            {(userRole === 'customer' || !isAuthenticated) && (
              <CardFooter className="justify-center">
                {isAuthenticated && userRole === 'customer' ? (
                  <Button asChild size="sm" className="w-full">
                    <Link to="/service-request" state={{ serviceName: service.name }} className="flex w-full items-center justify-center gap-2">
                      Book Now <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" className="w-full">
                    <Link to="/register" className="flex w-full items-center justify-center gap-2">
                      Sign Up to Book <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </CardFooter>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Guest CTA Banner ─── */
function GuestCTABanner() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <div
      ref={ref}
      className={`mt-12 rounded-2xl bg-gradient-to-r from-primary to-primary/90 p-8 md:p-10 text-center space-y-4 transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
    >
      <h3 className="text-xl md:text-2xl font-bold text-primary-foreground">
        Ready to Book a Service?
      </h3>
      <p className="text-primary-foreground/80 max-w-lg mx-auto">
        Create a free account to book services, track your requests, and get AI-powered AC recommendations.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <Button size="lg" variant="secondary" asChild>
          <Link to="/register">
            <span className="inline-flex items-center gap-2">Create Free Account <ArrowRight className="h-4 w-4" /></span>
          </Link>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          asChild
        >
          <Link to="/login">Sign In</Link>
        </Button>
      </div>
    </div>
  );
}

/* ─── Loading Skeleton ─── */
function ServicesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="flex flex-col animate-pulse">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="h-12 w-12 rounded-xl bg-muted" />
              <div className="h-5 w-16 rounded-md bg-muted" />
            </div>
            <div className="h-5 w-3/4 rounded bg-muted mt-3" />
            <div className="space-y-2 mt-2">
              <div className="h-3.5 w-full rounded bg-muted" />
              <div className="h-3.5 w-5/6 rounded bg-muted" />
            </div>
          </CardHeader>
          <CardContent className="flex-1" />
          <CardFooter className="justify-center">
            <div className="h-9 w-full rounded-md bg-muted" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
