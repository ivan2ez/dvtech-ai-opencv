import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
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

const serviceRequestSchema = z.object({
  serviceType: z.enum(['installation', 'maintenance', 'repair'], {
    required_error: 'Please select a service type',
  }),
  acDetails: z
    .string()
    .min(1, 'AC details are required')
    .max(1000, 'AC details must be 1000 characters or less'),
});

type ServiceRequestFormValues = z.infer<typeof serviceRequestSchema>;

const SERVICE_TYPES = [
  { value: 'installation', label: 'Installation', placeholder: 'Describe where you want the AC installed (room size, location, preferred brand/type, etc.)' },
  { value: 'maintenance', label: 'Maintenance', placeholder: 'Describe your AC unit (brand, model, last maintenance date) and any concerns.' },
  { value: 'repair', label: 'Repair', placeholder: 'Describe the issue — is the AC not cooling? Making noise? Leaking? Include brand/model if known.' },
] as const;

export function ServiceRequestForm() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const form = useForm<ServiceRequestFormValues>({
    resolver: zodResolver(serviceRequestSchema) as unknown as Resolver<ServiceRequestFormValues>,
    defaultValues: {
      serviceType: 'installation',
      acDetails: '',
    },
  });

  const acDetailsValue = form.watch('acDetails');
  const serviceTypeValue = form.watch('serviceType');

  const currentPlaceholder = SERVICE_TYPES.find((t) => t.value === serviceTypeValue)?.placeholder
    ?? 'Describe your AC unit details (brand, model, issue, location, etc.)';

  async function onSubmit(values: ServiceRequestFormValues) {
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await createServiceRequest(values);
      setSuccessMessage('Service request submitted successfully!');
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
        setErrorMessage(responseData.message || 'Failed to submit service request.');
      } else {
        setErrorMessage('Failed to submit service request. Please try again.');
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
                      >
                        {SERVICE_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
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
