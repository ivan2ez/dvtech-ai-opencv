import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Calendar, MapPin, Phone } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
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
import { getProducts } from '@/services/productApi';
import type { AirconProduct, ServiceType } from '@/types';

// Local "today" as YYYY-MM-DD, used both as the date input's `min` (which grays
// out earlier days in the native picker) and for validation.
function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Open the native date picker when the user clicks anywhere in the field, not
// just the calendar icon. `showPicker()` is supported in all modern browsers;
// we guard it in case it's unavailable or throws (e.g. not user-activated).
function openDatePicker(container: HTMLElement): void {
  const input = container.querySelector<HTMLInputElement>('input[type="date"]');
  if (!input) return;
  input.focus();
  try {
    input.showPicker?.();
  } catch {
    // Ignore — the input is focused, so keyboard entry still works.
  }
}

const serviceRequestSchema = z.object({
  serviceType: z
    .string()
    .trim()
    .min(1, 'Please select a service type')
    .max(100, 'Service type must be 100 characters or less'),
  acDetails: z
    .string()
    .trim()
    .min(10, 'Please provide at least 10 characters describing your AC needs')
    .max(1000, 'AC details must be 1000 characters or less'),
  serviceStreet: z
    .string()
    .trim()
    .min(1, 'Street is required')
    .max(255, 'Street must be 255 characters or less'),
  serviceBarangay: z
    .string()
    .trim()
    .min(1, 'Barangay is required')
    .max(255, 'Barangay must be 255 characters or less'),
  serviceCity: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(255, 'City must be 255 characters or less'),
  serviceProvince: z
    .string()
    .trim()
    .min(1, 'Province is required')
    .max(255, 'Province must be 255 characters or less'),
  contactNumber: z
    .string()
    .trim()
    .min(1, 'Contact number is required')
    .regex(/^\d{11}$/, 'Contact number must be exactly 11 digits'),
  serviceRequiredDate: z
    .string()
    .trim()
    .min(1, 'Please select a service required date')
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), { message: 'Please select a valid date' })
    .refine((v) => v >= getTodayString(), {
      message: 'Service required date must be today or later',
    }),
  // Paired with the date above. Together they become the admin's
  // "Required Date and Time", so nothing has to be keyed in twice.
  serviceRequiredTime: z.enum(['morning', 'afternoon'], {
    message: 'Please choose a preferred time',
  }),
  // AC unit selection — only required when the service type is Installation.
  installBrand: z.string().trim().max(100).optional().default(''),
  installModel: z.string().trim().max(100).optional().default(''),
}).superRefine((data, ctx) => {
  if (data.serviceType.trim().toLowerCase() === 'installation') {
    if (!data.installBrand || data.installBrand.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['installBrand'],
        message: 'Please select a brand for installation',
      });
    }
    if (!data.installModel || data.installModel.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['installModel'],
        message: 'Please select a model for installation',
      });
    }
  }
});

type ServiceRequestFormValues = z.infer<typeof serviceRequestSchema>;

const INSTALLATION_SERVICE_NAME = 'installation';
const DEFAULT_PLACEHOLDER = 'Describe your AC unit details (brand, model, issue, location, etc.)';

/** The two half-day windows a technician can be booked into. */
const TIME_SLOT_OPTIONS = [
  { value: 'morning' as const, label: 'Morning', range: '8:00 AM to 11:59 AM' },
  { value: 'afternoon' as const, label: 'Afternoon', range: '12:00 PM to 5:00 PM' },
];

export function ServiceRequestForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // When the user arrives via a "Book Now" button on the Services page, the
  // clicked service name is passed in router state — preselect that exact
  // service in the dropdown once the service list loads.
  const navState = location.state as
    | { serviceName?: string; installBrand?: string; installModel?: string }
    | null;
  const preselectedServiceName = navState?.serviceName;
  // Set when arriving from "Request Quotation" on the AI recommendation page —
  // preselect the exact unit the customer wants a quote for.
  const preselectedBrand = navState?.installBrand;
  const preselectedModel = navState?.installModel;

  const [services, setServices] = useState<ServiceType[]>([]);
  const [products, setProducts] = useState<AirconProduct[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  /**
   * Set when the customer arrived via "Book Now" for a service that is no
   * longer available (an admin marked it Unavailable in the meantime). Without
   * this the dropdown would silently fall back to a different service.
   */
  const [unavailableServiceName, setUnavailableServiceName] = useState('');

  // Only offer "use my saved address" when the profile has a COMPLETE address
  // (all four parts). A partial profile address would prefill + disable the
  // fields and then fail the server's all-required validation with no way to
  // edit, so we require completeness before showing the shortcut.
  const hasProfileAddress = !!(
    user?.street && user?.barangay && user?.city && user?.province
  );
  const hasProfileContact = !!user?.contactNumber;
  const [useProfileAddress, setUseProfileAddress] = useState(hasProfileAddress);
  const [useProfileContact, setUseProfileContact] = useState(hasProfileContact);

  const form = useForm<ServiceRequestFormValues>({
    resolver: zodResolver(serviceRequestSchema) as unknown as Resolver<ServiceRequestFormValues>,
    defaultValues: {
      serviceType: '',
      acDetails: '',
      serviceStreet: '',
      serviceBarangay: '',
      serviceCity: '',
      serviceProvince: '',
      contactNumber: '',
      installBrand: preselectedBrand ?? '',
      installModel: preselectedModel ?? '',
      serviceRequiredDate: '',
      serviceRequiredTime: 'morning',
    },
  });

  // Load the active services for the dropdown, then preselect either the
  // service passed from "Book Now" (by exact name) or the first available one.
  useEffect(() => {
    let cancelled = false;
    async function loadServices() {
      try {
        const data = await getServiceTypes();
        const active = data.filter((s) => s.isActive);
        if (cancelled) return;
        setServices(active);

        const current = form.getValues('serviceType');
        if (current) return; // user already picked something

        // A "Request Quotation" deep-link (brand + model in state) implies an
        // Installation request, so target that service name when present.
        const targetName = preselectedServiceName
          ?? (preselectedBrand || preselectedModel ? INSTALLATION_SERVICE_NAME : undefined);

        // Match the target service by exact name first, then fall back to a
        // partial match so a mapped label like "Cleaning" still resolves to a
        // catalog service named "General Cleaning".
        const wanted = targetName?.trim().toLowerCase();
        const match = wanted
          ? active.find((s) => s.name.trim().toLowerCase() === wanted) ??
            active.find((s) => s.name.trim().toLowerCase().includes(wanted)) ??
            active.find((s) => wanted.includes(s.name.trim().toLowerCase()))
          : undefined;

        // The requested service was withdrawn between browsing and booking.
        if (preselectedServiceName && !match) {
          setUnavailableServiceName(preselectedServiceName);
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
  }, [preselectedServiceName, preselectedBrand, preselectedModel]);

  // Load active AC products so the customer can pick the exact brand + model to
  // install. Brand/model are free strings on the product, so we derive the
  // brand list and per-brand model list from the product catalog itself.
  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        const response = await getProducts({ pageSize: 200 });
        if (cancelled) return;
        setProducts(response.data.filter((p) => p.isActive));
      } catch (err) {
        console.error('Failed to load products:', err);
      }
    }
    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefill the service address from the customer's profile on first load (and
  // whenever they re-check "use my saved address").
  useEffect(() => {
    if (useProfileAddress && user) {
      form.setValue('serviceStreet', user.street ?? '', { shouldValidate: false });
      form.setValue('serviceBarangay', user.barangay ?? '', { shouldValidate: false });
      form.setValue('serviceCity', user.city ?? '', { shouldValidate: false });
      form.setValue('serviceProvince', user.province ?? '', { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useProfileAddress, user?.street, user?.barangay, user?.city, user?.province]);

  // Prefill the contact number from the customer's profile.
  useEffect(() => {
    if (useProfileContact && user) {
      form.setValue('contactNumber', user.contactNumber ?? '', { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useProfileContact, user?.contactNumber]);

  const acDetailsValue = form.watch('acDetails');
  const serviceTypeValue = form.watch('serviceType');
  const installBrandValue = form.watch('installBrand');

  const selectedService = services.find((s) => s.name === serviceTypeValue);
  const currentPlaceholder = selectedService?.description || DEFAULT_PLACEHOLDER;

  const todayString = getTodayString();

  const isInstallation = serviceTypeValue.trim().toLowerCase() === INSTALLATION_SERVICE_NAME;

  // Unique, sorted brand names drawn from the active product catalog.
  const brandOptions = Array.from(new Set(products.map((p) => p.brand.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b)
  );

  // Models available for the currently selected brand (sorted, de-duplicated).
  const modelOptions = installBrandValue
    ? Array.from(
        new Set(
          products
            .filter((p) => p.brand.trim() === installBrandValue.trim())
            .map((p) => p.model.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b))
    : [];

  function handleToggleUseProfileAddress(checked: boolean) {
    setUseProfileAddress(checked);
    if (!checked) {
      // Switching to a different address — clear the prefilled values.
      form.setValue('serviceStreet', '', { shouldValidate: false });
      form.setValue('serviceBarangay', '', { shouldValidate: false });
      form.setValue('serviceCity', '', { shouldValidate: false });
      form.setValue('serviceProvince', '', { shouldValidate: false });
    }
  }

  function handleToggleUseProfileContact(checked: boolean) {
    setUseProfileContact(checked);
    if (!checked) {
      // Switching to a different contact number — clear the prefilled value.
      form.setValue('contactNumber', '', { shouldValidate: false });
    }
  }

  async function onSubmit(values: ServiceRequestFormValues) {
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await createServiceRequest(values);
      setSuccessMessage('Service request submitted successfully!');
      toast.success('Service request submitted successfully!');
      form.reset();
      setTimeout(() => {
        navigate('/my-requests');
      }, 1500);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'data' in error.response
      ) {
        const responseData = (error.response as { data: { message?: string } }).data;
        const msg = responseData.message || 'Failed to submit service request.';
        setErrorMessage(msg);
        toast.error(msg);
      } else {
        setErrorMessage('Failed to submit service request. Please try again.');
        toast.error('Failed to submit service request. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Submit Service Request</CardTitle>
          <CardDescription>
            Tell us about the service you need and we'll get back to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {errorMessage}
            </div>
          )}
          {unavailableServiceName && (
            <div
              role="status"
              className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            >
              <span className="font-medium">{unavailableServiceName}</span> is currently
              unavailable, so it can't be booked. Please choose another service below.
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        onChange={(e) => {
                          field.onChange(e);
                          // Changing the service resets only the details field;
                          // contact number and address are left untouched.
                          form.setValue('acDetails', '', { shouldValidate: false });
                          // Clear the AC selection unless the new service is Installation.
                          if (e.target.value.trim().toLowerCase() !== INSTALLATION_SERVICE_NAME) {
                            form.setValue('installBrand', '', { shouldValidate: false });
                            form.setValue('installModel', '', { shouldValidate: false });
                          }
                        }}
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

              {/* AC unit selection — shown only for Installation so the
                  technician knows exactly which brand/model to install. */}
              {isInstallation && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">AC Unit to Install</p>
                    <p className="text-xs text-muted-foreground">
                      Choose the brand and model you'd like installed so the technician can prepare.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-3">
                    <FormField
                      control={form.control}
                      name="installBrand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand</FormLabel>
                          <FormControl>
                            <select
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                // Brand changed — reset the model so it can't
                                // point at a model from a different brand.
                                form.setValue('installModel', '', { shouldValidate: false });
                              }}
                            >
                              <option value="">Select a brand…</option>
                              {brandOptions.map((brand) => (
                                <option key={brand} value={brand}>
                                  {brand}
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
                      name="installModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <select
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!installBrandValue}
                              {...field}
                            >
                              <option value="">
                                {installBrandValue ? 'Select a model…' : 'Select a brand first'}
                              </option>
                              {modelOptions.map((model) => (
                                <option key={model} value={model}>
                                  {model}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="acDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AC Details</FormLabel>
                    <FormControl>
                      <textarea
                        className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder={currentPlaceholder}
                        maxLength={1000}
                        {...field}
                      />
                    </FormControl>
                    <div className="flex justify-between">
                      <FormMessage />
                      <span className="text-xs text-muted-foreground">
                        {acDetailsValue.length}/1000
                      </span>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceRequiredDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Required Date</FormLabel>
                    <FormControl>
                      <div
                        className="date-field group relative w-full sm:w-64"
                        onClick={(e) => openDatePicker(e.currentTarget)}
                      >
                        <Input
                          type="date"
                          min={todayString}
                          className="date-input h-10 w-full cursor-pointer pr-10"
                          {...field}
                        />
                        <Calendar
                          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-hover:text-foreground"
                          aria-hidden="true"
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      When would you like the service performed? Must be today or a future date.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preferred time slot — half-day windows the technician works. */}
              <FormField
                control={form.control}
                name="serviceRequiredTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Time</FormLabel>
                    <FormControl>
                      <div
                        role="radiogroup"
                        aria-label="Preferred time"
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                      >
                        {TIME_SLOT_OPTIONS.map((option) => {
                          const isSelected = field.value === option.value;
                          return (
                            <label
                              key={option.value}
                              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                  : 'border-input hover:bg-muted/50'
                              }`}
                            >
                              <input
                                type="radio"
                                className="mt-0.5 h-4 w-4"
                                name={field.name}
                                value={option.value}
                                checked={isSelected}
                                onChange={() => field.onChange(option.value)}
                                onBlur={field.onBlur}
                              />
                              <span>
                                <span className="block text-sm font-medium">{option.label}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {option.range}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Your date and time are sent to the admin together as the required schedule.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contact Number */}
              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Phone className="h-4 w-4" />
                    Contact Number
                  </p>
                  <p className="text-xs text-muted-foreground">
                    How the technician can reach you for this request. This is required.
                  </p>
                </div>

                {hasProfileContact && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={useProfileContact}
                      onChange={(e) => handleToggleUseProfileContact(e.target.checked)}
                    />
                    Use my saved profile contact number
                  </label>
                )}

                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="e.g. 09171234567"
                          disabled={useProfileContact}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Service Address */}
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <MapPin className="h-4 w-4" />
                      Service Address
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Where should the technician go? This is required.
                    </p>
                  </div>
                </div>

                {hasProfileAddress && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={useProfileAddress}
                      onChange={(e) => handleToggleUseProfileAddress(e.target.checked)}
                    />
                    Use my saved profile address
                  </label>
                )}

                <FormField
                  control={form.control}
                  name="serviceStreet"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="House no., street name"
                          disabled={useProfileAddress}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="serviceBarangay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Barangay</FormLabel>
                        <FormControl>
                          <Input placeholder="Barangay" disabled={useProfileAddress} {...field} />
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
                          <Input placeholder="City" disabled={useProfileAddress} {...field} />
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
                          <Input placeholder="Province" disabled={useProfileAddress} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/my-requests')}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
