import { useState, useRef } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
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
import { Input } from '@/components/ui/input';

import { submitRoomAssessment, type RoomAssessmentResponse } from '@/services/aiApi';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

const roomAssessmentSchema = z.object({
  serviceRequestId: z
    .number({ required_error: 'Service Request ID is required', invalid_type_error: 'Must be a number' })
    .int('Must be a whole number')
    .positive('Must be a positive number'),
  area: z
    .number({ required_error: 'Area is required', invalid_type_error: 'Must be a number' })
    .min(1, 'Area must be at least 1 sq meter')
    .max(1000, 'Area must be at most 1000 sq meters'),
  ceilingHeight: z
    .number({ required_error: 'Ceiling height is required', invalid_type_error: 'Must be a number' })
    .min(1, 'Ceiling height must be at least 1 meter')
    .max(10, 'Ceiling height must be at most 10 meters'),
  occupancy: z
    .number({ required_error: 'Occupancy is required', invalid_type_error: 'Must be a number' })
    .int('Must be a whole number')
    .min(1, 'Occupancy must be at least 1')
    .max(500, 'Occupancy must be at most 500'),
  sunlightLevel: z.enum(['low', 'moderate', 'high'], {
    required_error: 'Please select a sunlight level',
  }),
});

type RoomAssessmentFormValues = z.infer<typeof roomAssessmentSchema>;

const SUNLIGHT_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
] as const;

export function AiRecommendation() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<RoomAssessmentResponse | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<RoomAssessmentFormValues>({
    resolver: zodResolver(roomAssessmentSchema) as unknown as Resolver<RoomAssessmentFormValues>,
    defaultValues: {
      serviceRequestId: undefined,
      area: undefined,
      ceilingHeight: undefined,
      occupancy: undefined,
      sunlightLevel: 'moderate',
    },
  });

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageError('');
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedImage(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Only JPEG and PNG images are accepted.');
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('Image must be less than 10MB.');
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedImage(file);
  }

  async function onSubmit(values: RoomAssessmentFormValues) {
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    setResult(null);

    try {
      const response = await submitRoomAssessment({
        ...values,
        image: selectedImage || undefined,
      });
      setResult(response);
      setSuccessMessage('AI recommendation generated successfully!');
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
        setErrorMessage(responseData.message || 'Failed to get AI recommendation.');
      } else {
        setErrorMessage('Failed to get AI recommendation. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">AI Room Assessment & Recommendation</CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}
          {successMessage && !result && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {successMessage}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="serviceRequestId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Request ID</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter your service request ID"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Area (sq meters)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1 - 1000"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ceilingHeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ceiling Height (meters)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1 - 10"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="occupancy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Occupancy (number of people)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1 - 500"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sunlightLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sunlight Level</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        {...field}
                      >
                        {SUNLIGHT_LEVELS.map((level) => (
                          <option key={level.value} value={level.value}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="room-image">
                  Room Image (optional)
                </label>
                <Input
                  id="room-image"
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                />
                {imageError && (
                  <p className="text-sm font-medium text-destructive">{imageError}</p>
                )}
                {selectedImage && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Analyzing... This may take up to 30 seconds' : 'Get AI Recommendation'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">AI Recommendation Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              {successMessage}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">Total BTU Required</p>
                <p className="text-2xl font-bold">{result.recommendation.totalBtu.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">Recommended HP</p>
                <p className="text-2xl font-bold">{result.recommendation.recommendedHp}</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-sm text-muted-foreground">Unit Type</p>
                <p className="text-2xl font-bold">{result.recommendation.unitType}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Reasoning</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {result.recommendation.reasoning}
              </p>
            </div>

            {result.recommendation.troubleshootingNotes && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Troubleshooting Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {result.recommendation.troubleshootingNotes}
                </p>
              </div>
            )}

            {result.recommendation.product && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Matched Product</h3>
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="font-medium">
                    {result.recommendation.product.brand} {result.recommendation.product.model}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <span>Type: {result.recommendation.product.type}</span>
                    <span>Horsepower: {result.recommendation.product.horsepower} HP</span>
                    <span>BTU Capacity: {result.recommendation.product.btuCapacity.toLocaleString()}</span>
                    <span>Price: ₱{result.recommendation.product.price.toLocaleString()}</span>
                  </div>
                  {result.recommendation.product.description && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {result.recommendation.product.description}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
