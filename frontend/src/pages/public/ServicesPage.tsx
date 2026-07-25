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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
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

  const sortLabel = sortOrder === 'asc' ? 'Price: Low to High' : sortOrder === 'desc' ? 'Price: High to Low' : 'Default Order';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Our Services</h1>
        <p className="text-muted-foreground">
          Professional air conditioning services for your home or business
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={cycleSortOrder}>
          <ArrowUpDown className="mr-1 h-4 w-4" />
          {sortLabel}
        </Button>
      </div>

      {/* Result count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''} available
        </p>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Loading services...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">
            {searchQuery ? 'No services match your search.' : 'No services are currently available.'}
          </p>
          {searchQuery && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => {
            const Icon = getServiceIcon(service.name);
            return (
              <Card key={service.id} className="flex flex-col hover:border-primary/50 hover:shadow-md transition-all">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{service.name}</CardTitle>
                      <CardDescription className="mt-1">{service.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1" />
                <CardFooter className="flex items-center justify-between">
                  <div>
                    <span className="text-xl font-bold text-primary">{formatPrice(service.price)}</span>
                    <p className="text-xs text-muted-foreground">Starting price</p>
                  </div>
                  {isAuthenticated && user?.role === 'customer' && (
                    <Button asChild size="sm">
                      <Link to="/service-request">Book Now</Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
