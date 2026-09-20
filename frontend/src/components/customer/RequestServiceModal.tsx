import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { createServiceRequest } from '@/services/serviceRequestApi';
import { getServiceTypes } from '@/services/serviceTypeApi';
import type { ServiceType } from '@/types';

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const requestServiceSchema = z.object({
  serviceType: z.string().trim().min(1, 'Please select a service type').max(100),
  acDetails: z
    .string()
    .trim()
    .min(10, 'Please provide at least 10 characters describing your AC needs')
    .max(1000, 'AC details must be 1000 characters or less'),
  serviceStreet: z.string().trim().min(1, 'Street is required').max(255),
  serviceBarangay: z.string().trim().min(1, 'Barangay is required').max(255),
  serviceCity: z.string().trim().min(1, 'City is required').max(255),
  serviceProvince: z.string().trim().min(1, 'Province is required').max(255),
  contactNumber: z
    .string()
    .trim()
    .regex(/^\d{11}$/, 'Contact number must be exactly 11 digits'),
  serviceRequiredDate: z
    .string()
    .trim()
    .min(1, 'Please select a service required date')
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), { message: 'Please select a valid date' })
    .refine((v) => v >= getTodayString(), {
      message: 'Service required date must be today or later',
    }),
  serviceRequiredTime: z.enum(['morning', 'afternoon'], {
    message: 'Please choose a preferred time',
  }),
});

type RequestServiceValues = z.infer<typeof requestServiceSchema>;

const TIME_SLOT_OPTIONS = [
  { value: 'morning' as const, label: 'Morning', range: '8:00 AM to 11:59 AM' },
  { value: 'afternoon' as const, label: 'Afternoon', range: '12:00 PM to 5:00 PM' },
];

interface RequestServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Service name to preselect (derived from the diagnosed symptom, e.g.
   * "Repair" or "Cleaning"). Matched against the live service catalog.
   */
  suggestedService: string;
  /** Optional prefill for the AC details field (e.g. the diagnosed issue). */
  initialDetails?: string;
}

/**
 * In-place service booking modal launched from the Repair Tips page. Prefills
 * the service (by diagnosed symptom) and the customer's saved address/contact,
 * so booking a technician is one short step away from the diagnosis — no page
 * change. Installation is intentionally out of scope here (troubleshooting maps
 * only to Repair/Cleaning).
 */
export function RequestServiceModal({
  open,
  onOpenChange,
  suggestedService,
  initialDetails,
}: RequestServiceModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [services, setServices] = useState<ServiceType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [unavailableServiceName, setUnavailableServiceName] = useState('');

  const form = useForm<RequestServiceValues>({
    resolver: zodResolver(requestServiceSchema) as unknown as Resolver<RequestServiceValues>,
    defaultValues: {
      serviceType: '',
      acDetails: '',
      serviceStreet: '',
      serviceBarangay: '',
      serviceCity: '',
      serviceProvince: '',
      contactNumber: '',
      serviceRequiredDate: '',
      serviceRequiredTime: 'morning',
    },
  });

  // On open: load the active services, preselect the suggested one, and prefill
  // address/contact + details from what we already know.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setErrorMessage('');
    setUnavailableServiceName('');
    form.reset({
      serviceType: '',
      acDetails: initialDetails?.trim() ? initialDetails.trim().slice(0, 1000) : '',
      serviceStreet: user?.street ?? '',
      serviceBarangay: user?.barangay ?? '',
      serviceCity: user?.city ?? '',
      serviceProvince: user?.province ?? '',
      contactNumber: user?.contactNumber ?? '',
      serviceRequiredDate: '',
      serviceRequiredTime: 'morning',
    });

    async function loadServices() {
      try {
        const data = await getServiceTypes();
        const active = data.filter((s) => s.isActive);
        if (cancelled) return;
        setServices(active);

        const wanted = suggestedService.trim().toLowerCase();
        const match =
          active.find((s) => s.name.trim().toLowerCase() === wanted) ??
          active.find((s) => s.name.trim().toLowerCase().includes(wanted)) ??
          active.find((s) => wanted.includes(s.name.trim().toLowerCase()));

        if (!match && suggestedService) {
          setUnavailableServiceName(suggestedService);
        }
        const initial = match ?? active[0];
        if (initial) {
          form.setValue('serviceType', initial.name, { shouldValidate: false });
        }
      } catch (err) {
        console.error('Failed to load services:', err);
      }
    }
    void loadServices();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suggestedService, initialDetails]);

  const todayString = getTodayString();

  async function onSubmit(values: RequestServiceValues) {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await createServiceRequest(values);
      toast.success('Service request submitted successfully!');
      onOpenChange(false);
      navigate('/my-requests');
    } catch (error: unknown) {
      let msg = 'Failed to submit service request. Please try again.';
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response
      ) {
        const data = (error.response as { data: { message?: string } }).data;
        if (data.message) msg = data.message;
      }
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Service</DialogTitle>
          <DialogDescription>
            Book a technician for this issue. We've preselected the recommended service.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {errorMessage}
          </div>
        )}
        {unavailableServiceName && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <span className="font-medium">{unavailableServiceName}</span> is currently unavailable,
            so it can't be booked. Please choose another service below.
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="serviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Type</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      {...field}
                    >
                      {services.length === 0 && (
                        <option value="" disabled>
                          Loading services…
                        </option>
                      )}
                      {services.map((service) => (
                        <option key={service.id} value={service.name}>
                          {service.name}
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
              name="acDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      placeholder="Describe your AC unit and the issue (brand, model, symptoms, location, etc.)"
                      maxLength={1000}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="serviceStreet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street</FormLabel>
                    <FormControl>
                      <Input placeholder="House no. & street" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceBarangay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barangay</FormLabel>
                    <FormControl>
                      <Input placeholder="Barangay" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City / Municipality</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceProvince"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Province</FormLabel>
                    <FormControl>
                      <Input placeholder="Province" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contactNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Number</FormLabel>
                  <FormControl>
                    <Input placeholder="09XXXXXXXXX" maxLength={11} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="serviceRequiredDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Date</FormLabel>
                    <FormControl>
                      <Input type="date" min={todayString} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceRequiredTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Time</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        {...field}
                      >
                        {TIME_SLOT_OPTIONS.map((slot) => (
                          <option key={slot.value} value={slot.value}>
                            {slot.label} ({slot.range})
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
