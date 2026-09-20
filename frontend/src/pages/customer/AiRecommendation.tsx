import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowDown } from 'lucide-react';

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import {
  submitRoomAssessment,
  type RoomAssessmentResponse,
  type OpenCVAnalysis,
  type TieredProductInfo,
} from '@/services/aiApi';
import { createQuotation } from '@/services/quotationApi';
import { getApiErrorMessage } from '@/lib/utils';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

// Per the revisions: no upper limits on area, ceiling height, or occupancy.
// Only letters (non-numbers) and non-positive values are rejected. Daily usage
// is capped at 24 since a day has 24 hours.
const roomAssessmentSchema = z.object({
  area: z
    .number({ error: 'Area is required and must be a number' })
    .gt(0, 'Area must be greater than 0'),
  ceilingHeight: z
    .number({ error: 'Ceiling height is required and must be a number' })
    .gt(0, 'Ceiling height must be greater than 0'),
  occupancy: z
    .number({ error: 'Occupancy is required and must be a number' })
    .int('Must be a whole number')
    .gt(0, 'Occupancy must be greater than 0'),
  dailyUsage: z
    .number({ error: 'Daily usage must be a number' })
    .min(0, 'Daily usage cannot be negative')
    .max(24, 'Daily usage cannot exceed 24 hours'),
  sunlightLevel: z.enum(['low', 'medium', 'high'], {
    error: 'Please select a sunlight level',
  }),
});

type RoomAssessmentFormValues = z.infer<typeof roomAssessmentSchema>;

const SUNLIGHT_LEVELS = [
  { value: 'low', label: 'Low — shaded, minimal direct sunlight' },
  { value: 'medium', label: 'Medium — some direct sunlight during the day' },
  { value: 'high', label: 'High — heavy sun exposure most of the day' },
] as const;

const TIER_LABELS: Record<string, string> = {
  entry: 'Entry Level',
  mid: 'Mid Level',
  premium: 'Premium',
};

const TIER_BADGE_CLASS: Record<string, string> = {
  entry: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  mid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  premium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

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
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<RoomAssessmentResponse | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Product whose "Request Quotation" modal is open.
  const [quoteProduct, setQuoteProduct] = useState<TieredProductInfo | null>(null);
  // Optional customer note carried on the quotation request.
  const [quoteDetails, setQuoteDetails] = useState('');
  // In-flight state + inline error for the quotation submission.
  const [isRequestingQuote, setIsRequestingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  // --- C2: bring the AI result into view (Req 2) ---
  // Container + heading of the result card; used to scroll/focus on a new result.
  const resultRef = useRef<HTMLDivElement>(null);
  const resultHeadingRef = useRef<HTMLDivElement>(null);
  // Tracks whether the top of the result is currently outside the viewport,
  // which drives the floating "Result ready" hint control (Req 2.2, 2.3).
  const [resultOffscreen, setResultOffscreen] = useState(false);
  // The recommendation id we last scrolled to, so we only scroll on a *new*
  // result rather than on every render (Req 2.6).
  const lastScrolledIdRef = useRef<number | null>(null);
  // Guards against concurrent submissions while a request is in flight (Req 2.7).
  const inFlightRef = useRef(false);

  /** Returns the scroll behavior honoring the user's reduced-motion setting (Req 2.4). */
  function getScrollBehavior(): ScrollBehavior {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return 'auto';
    }
    return 'smooth';
  }

  /** Scrolls the result container into view. */
  const scrollToResult = useCallback(() => {
    resultRef.current?.scrollIntoView({
      behavior: getScrollBehavior(),
      block: 'start',
    });
  }, []);

  // On loading -> loaded of a NEW recommendation id, scroll the result into view
  // and move focus to the heading without triggering the browser-native focus
  // scroll (Req 2.1, 2.5, 2.6). Failures never reach here (result stays null),
  // so scroll position is left unchanged on failure (Req 2.8).
  const currentResultId = result?.recommendation.id ?? null;
  useEffect(() => {
    if (currentResultId === null) return;
    if (lastScrolledIdRef.current === currentResultId) return;
    lastScrolledIdRef.current = currentResultId;
    // Defer to the next frame so the result container is mounted/laid out.
    requestAnimationFrame(() => {
      scrollToResult();
      resultHeadingRef.current?.focus({ preventScroll: true });
    });
  }, [currentResultId, scrollToResult]);

  // Observe the result container so the "Result ready" hint appears only while
  // the top of the result is off-screen and hides when it scrolls into view
  // (Req 2.2, 2.3).
  useEffect(() => {
    const el = resultRef.current;
    if (!el) {
      setResultOffscreen(false);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setResultOffscreen(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentResultId]);

  const form = useForm<RoomAssessmentFormValues>({
    resolver: zodResolver(roomAssessmentSchema) as unknown as Resolver<RoomAssessmentFormValues>,
    defaultValues: {
      area: undefined,
      ceilingHeight: undefined,
      occupancy: undefined,
      dailyUsage: 8,
      sunlightLevel: 'medium',
    },
  });

  /**
   * Submits a quotation request for the chosen unit (C4 write path — Req 4).
   * The brand/model come from the selected product; the customer may add an
   * optional note. On success we close the dialog and send them to My
   * Quotations to track it; on failure the server message is shown inline.
   */
  async function requestQuotation(product: TieredProductInfo) {
    if (isRequestingQuote) return;
    setIsRequestingQuote(true);
    setQuoteError('');
    try {
      const details = quoteDetails.trim();
      await createQuotation({
        brand: product.brand,
        model: product.model,
        details: details.length > 0 ? details : undefined,
      });
      setQuoteProduct(null);
      setQuoteDetails('');
      toast.success('Quotation requested — track it in My Quotations');
      navigate('/my-quotations');
    } catch (error: unknown) {
      setQuoteError(
        getApiErrorMessage(error, 'Failed to request a quotation. Please try again.'),
      );
    } finally {
      setIsRequestingQuote(false);
    }
  }

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
    // Reject additional submissions while a request is already in flight (Req 2.7).
    if (inFlightRef.current) return;
    inFlightRef.current = true;
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
      toast.success('AI recommendation generated successfully!');
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
        const msg = responseData.message || 'Failed to get AI recommendation.';
        setErrorMessage(msg);
        toast.error(msg);
      } else {
        setErrorMessage('Failed to get AI recommendation. Please try again.');
        toast.error('Failed to get AI recommendation. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
      inFlightRef.current = false;
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
                name="dailyUsage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Daily Usage (hours per day)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g. 8"
                        step="0.5"
                        min={0}
                        max={24}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      How many hours a day will the AC run? Heavy use (8+ hours) favors an inverter
                      unit for lower electricity cost. Max 24 hours.
                    </p>
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
        <Card ref={resultRef}>
          <CardHeader>
            <CardTitle
              className="text-xl"
              tabIndex={-1}
              ref={resultHeadingRef}
              aria-live="polite"
            >
              AI Recommendation Result
            </CardTitle>
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
                <p className="text-lg font-bold capitalize">{result.recommendation.unitType}</p>
                <span
                  className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    result.recommendation.isInverterRecommended
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {result.recommendation.isInverterRecommended ? 'Inverter' : 'Non-Inverter'}
                </span>
              </div>
            </div>

            {/* Computation breakdown — table style so the customer sees exactly
                how the BTU total was derived (#16). */}
            {result.recommendation.computationBreakdown?.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">How we computed this</h3>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Factor</th>
                        <th className="px-3 py-2 text-left font-medium">Formula</th>
                        <th className="px-3 py-2 text-right font-medium">BTU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.recommendation.computationBreakdown.map((line, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{line.label}</td>
                          <td className="px-3 py-2 text-muted-foreground">{line.formula}</td>
                          <td className="px-3 py-2 text-right font-medium">
                            {line.btu.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td className="px-3 py-2" colSpan={2}>
                          Total
                        </td>
                        <td className="px-3 py-2 text-right">
                          {result.recommendation.totalBtu.toLocaleString()} BTU
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* OpenCV Image Analysis Panel — only shown when an image was uploaded */}
            {result.opencvAnalysis && (
              <div className="rounded-lg border p-4">
                <OpenCVMetricsPanel data={result.opencvAnalysis} />
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Why this recommendation</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {result.recommendation.reasoning}
              </p>
              {result.recommendation.unitTypeRationale && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {result.recommendation.unitTypeRationale}
                </p>
              )}
            </div>

            {/* Electrical & breaker tips (#17) */}
            {(result.recommendation.electricalTips?.length > 0 ||
              result.recommendation.breakerTips?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {result.recommendation.electricalTips?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                    <h3 className="font-semibold text-sm text-amber-900 dark:text-amber-300">
                      Electrical Tips
                    </h3>
                    <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-amber-800 dark:text-amber-400">
                      {result.recommendation.electricalTips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.recommendation.breakerTips?.length > 0 && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
                    <h3 className="font-semibold text-sm text-orange-900 dark:text-orange-300">
                      Breaker Tips
                    </h3>
                    <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-orange-800 dark:text-orange-400">
                      {result.recommendation.breakerTips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {result.recommendation.troubleshootingNotes && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Additional Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {result.recommendation.troubleshootingNotes}
                </p>
              </div>
            )}

            {/* Multi-unit alternative for large/commercial spaces (#19) */}
            {result.recommendation.requiresMultiUnit &&
              result.recommendation.multiUnitAlternatives?.length > 0 && (
                <div className="space-y-2">
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                    This space needs more cooling than any single unit we carry provides. Here are
                    multi-unit combinations that meet the requirement:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.recommendation.multiUnitAlternatives.map((alt) => (
                      <div key={alt.productId} className="rounded-lg border p-4 space-y-1">
                        <p className="font-medium">
                          {alt.quantity} x {alt.brand} {alt.model}
                        </p>
                        <p className="text-sm text-muted-foreground">{alt.description}</p>
                        <div className="grid grid-cols-2 gap-1 text-sm text-muted-foreground pt-1">
                          <span>{alt.horsepower} HP each</span>
                          <span>{alt.combinedBtu.toLocaleString()} BTU total</span>
                          <span>₱{alt.price.toLocaleString()} each</span>
                          <span className="font-medium text-foreground">
                            ₱{alt.combinedPrice.toLocaleString()} total
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Recommended products, grouped as Entry / Mid / Premium options (#18) */}
            {result.recommendation.tieredProducts?.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">
                  Recommended Units{' '}
                  <span className="font-normal text-muted-foreground">
                    ({result.recommendation.tieredProducts.length} options)
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {result.recommendation.tieredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setQuoteProduct(product)}
                      className="flex flex-col rounded-lg border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
                    >
                      <span
                        className={`mb-2 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          TIER_BADGE_CLASS[product.tier] ?? TIER_BADGE_CLASS.mid
                        }`}
                      >
                        {TIER_LABELS[product.tier] ?? 'Option'}
                      </span>
                      <span className="font-medium">
                        {product.brand} {product.model}
                      </span>
                      <span className="mt-1 text-sm capitalize text-muted-foreground">
                        {product.type} · {product.horsepower} HP · {product.unitType}
                      </span>
                      <span className="mt-1 text-sm text-muted-foreground">
                        {product.btuCapacity.toLocaleString()} BTU
                      </span>
                      <span className="mt-2 text-lg font-bold">
                        ₱{product.price.toLocaleString()}
                      </span>
                      <span className="mt-2 text-xs font-medium text-primary">
                        View & Request Quotation →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Product detail + Request Quotation modal */}
      <Dialog
        open={quoteProduct !== null}
        onOpenChange={(open) => {
          if (!open) {
            setQuoteProduct(null);
            setQuoteDetails('');
            setQuoteError('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {quoteProduct ? `${quoteProduct.brand} ${quoteProduct.model}` : ''}
            </DialogTitle>
          </DialogHeader>
          {quoteProduct && (
            <div className="space-y-3">
              <span
                className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  TIER_BADGE_CLASS[quoteProduct.tier] ?? TIER_BADGE_CLASS.mid
                }`}
              >
                {TIER_LABELS[quoteProduct.tier] ?? 'Option'}
              </span>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <span className="capitalize">Type: {quoteProduct.type}</span>
                <span>Horsepower: {quoteProduct.horsepower} HP</span>
                <span>BTU: {quoteProduct.btuCapacity.toLocaleString()}</span>
                <span className="capitalize">Unit: {quoteProduct.unitType}</span>
              </div>
              <p className="text-lg font-bold">₱{quoteProduct.price.toLocaleString()}</p>
              {quoteProduct.description && (
                <p className="text-sm text-muted-foreground">{quoteProduct.description}</p>
              )}

              {/* Optional note carried on the quotation request. */}
              <div className="space-y-1.5 pt-1">
                <label htmlFor="quote-details" className="text-sm font-medium">
                  Additional details (optional)
                </label>
                <textarea
                  id="quote-details"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="Anything specific about your space or budget?"
                  maxLength={2000}
                  value={quoteDetails}
                  onChange={(e) => setQuoteDetails(e.target.value)}
                />
              </div>

              {quoteError && (
                <p className="text-sm font-medium text-destructive">{quoteError}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQuoteProduct(null)}
              disabled={isRequestingQuote}
            >
              Close
            </Button>
            <Button
              onClick={() => quoteProduct && void requestQuotation(quoteProduct)}
              disabled={isRequestingQuote}
            >
              {isRequestingQuote ? 'Requesting...' : 'Request Quotation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating "Result ready" hint — visible only while the result top is
          off-screen; clicking it scrolls to the result (Req 2.2, 2.3). */}
      {result && resultOffscreen && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Button
            type="button"
            onClick={scrollToResult}
            className="shadow-lg rounded-full"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
            Result ready
          </Button>
        </div>
      )}
    </div>
  );
}
