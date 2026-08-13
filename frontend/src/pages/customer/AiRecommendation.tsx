import { useState, useRef } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
import { Input } from '@/components/ui/input';

import { submitRoomAssessment, type RoomAssessmentResponse, type OpenCVAnalysis } from '@/services/aiApi';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

const roomAssessmentSchema = z.object({
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
  { value: 'low', label: 'Low — shaded, minimal direct sunlight' },
  { value: 'moderate', label: 'Moderate — some direct sunlight during the day' },
  { value: 'high', label: 'High — heavy sun exposure most of the day' },
] as const;

// --- OpenCV Metrics Panel ---

function levelBadge(value: string, levels: Record<string, string>) {
  const cls = levels[value] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {value}
    </span>
  );
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? 'bg-red-400' : pct >= 40 ? 'bg-amber-400' : 'bg-green-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function OpenCVMetricsPanel({ data }: { data: OpenCVAnalysis }) {
  const sunlightColors: Record<string, string> = {
    low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  };

  const insulationColors: Record<string, string> = {
    good: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    fair: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    poor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-sm">OpenCV Image Analysis</h3>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          Computer Vision
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Objective measurements extracted from your room photo. These metrics directly influenced the BTU calculation above.
      </p>

      {/* Top stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 text-center space-y-1">
          <p className="text-xs text-muted-foreground">Windows Detected</p>
          <p className="text-2xl font-bold">{data.windowCount}</p>
        </div>
        <div className="rounded-lg border p-3 text-center space-y-1">
          <p className="text-xs text-muted-foreground">Sunlight</p>
          <div className="flex justify-center pt-1">
            {levelBadge(data.sunlightExposure, sunlightColors)}
          </div>
        </div>
        <div className="rounded-lg border p-3 text-center space-y-1">
          <p className="text-xs text-muted-foreground">Insulation</p>
          <div className="flex justify-center pt-1">
            {levelBadge(data.insulationQuality, insulationColors)}
          </div>
        </div>
        <div className="rounded-lg border p-3 text-center space-y-1">
          <p className="text-xs text-muted-foreground">Heat Sources</p>
          <p className="text-2xl font-bold">{data.heatSources.length}</p>
        </div>
      </div>

      {/* Heat sources list */}
      {data.heatSources.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Detected Heat Sources</p>
          <div className="flex flex-wrap gap-1.5">
            {data.heatSources.map((source) => (
              <span
                key={source}
                className="rounded-full border bg-muted px-2.5 py-0.5 text-xs capitalize"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Score bars */}
      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Pixel-level Measurements
        </p>
        <ScoreBar value={data.brightnessScore} label="Brightness Score" />
        <ScoreBar value={data.contrastScore} label="Contrast Score" />
        <ScoreBar value={data.warmAreaRatio} label="Warm Area Ratio (heat gain)" />

        {data.details?.insulationMetrics && (
          <>
            <ScoreBar
              value={data.details.insulationMetrics.edgeDensity}
              label="Edge Density (surface roughness)"
            />
            <ScoreBar
              value={data.details.insulationMetrics.colorConsistency}
              label="Color Consistency (lighting uniformity)"
            />
          </>
        )}
      </div>

      {/* Interpretation note */}
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 space-y-1">
        <p className="font-medium">How this affects your recommendation</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
          {data.warmAreaRatio > 0.3 && (
            <li>High warm area ratio (+heat gain adjustment applied to BTU)</li>
          )}
          {data.insulationQuality === 'poor' && (
            <li>Poor insulation detected (+10–15% BTU adjustment applied)</li>
          )}
          {data.heatSources.length > 2 && (
            <li>Multiple heat sources detected (internal heat load factored in)</li>
          )}
          {data.windowCount > 1 && (
            <li>{data.windowCount} windows detected (solar heat gain included)</li>
          )}
          {data.warmAreaRatio <= 0.3 &&
            data.insulationQuality !== 'poor' &&
            data.heatSources.length <= 2 &&
            data.windowCount <= 1 && (
              <li>No major adjustment factors detected — standard BTU formula applied</li>
            )}
        </ul>
      </div>
    </div>
  );
}

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
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">AI Room Assessment & Recommendation</CardTitle>
          <CardDescription>
            Fill in your room details and our AI will recommend the best AC unit for your space.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {errorMessage}
            </div>
          )}
          {successMessage && !result && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
              {successMessage}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Area (sq meters)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 25"
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
                        placeholder="e.g. 2.7"
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
                        placeholder="e.g. 4"
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
                <p className="text-xs text-muted-foreground">
                  Upload a photo of your room for more accurate AI analysis.
                </p>
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
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
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

            {/* OpenCV Image Analysis Panel — only shown when an image was uploaded */}
            {result.opencvAnalysis && (
              <div className="rounded-lg border p-4">
                <OpenCVMetricsPanel data={result.opencvAnalysis} />
              </div>
            )}

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
