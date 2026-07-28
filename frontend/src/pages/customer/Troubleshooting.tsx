import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CheckCircle,
  Wrench,
  ShieldAlert,
  Lightbulb,
  Upload,
  X,
} from 'lucide-react';
import {
  submitTroubleshooting,
  type TroubleshootingResult,
} from '@/services/aiApi';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

const AC_TYPES = [
  { value: '', label: 'Select AC type (optional)' },
  { value: 'split-type', label: 'Split-Type' },
  { value: 'window-type', label: 'Window-Type' },
  { value: 'floor-standing', label: 'Floor-Standing' },
];

const COMMON_SYMPTOMS = [
  'Not cooling',
  'Unusual noise',
  'Water leaking',
  'Bad smell',
  'AC won\'t turn on',
  'Weak airflow',
  'Ice forming on unit',
  'Remote not working',
];

function getSeverityConfig(severity: TroubleshootingResult['severity']) {
  switch (severity) {
    case 'low':
      return {
        label: 'Low',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        icon: CheckCircle,
      };
    case 'moderate':
      return {
        label: 'Moderate',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        icon: AlertTriangle,
      };
    case 'high':
      return {
        label: 'High',
        className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
        icon: AlertTriangle,
      };
    case 'critical':
      return {
        label: 'Critical',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        icon: ShieldAlert,
      };
  }
}

export function Troubleshooting() {
  const [issue, setIssue] = useState('');
  const [acType, setAcType] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<TroubleshootingResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleSymptom(symptom: string) {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
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

  function removeImage() {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!issue.trim()) {
      setErrorMessage('Please describe the issue you are experiencing.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setResult(null);

    try {
      const response = await submitTroubleshooting({
        issue: issue.trim(),
        acType: acType || undefined,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : undefined,
        image: selectedImage || undefined,
      });
      setResult(response);
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
        setErrorMessage(responseData.message || 'Failed to analyze the issue. Please try again.');
      } else {
        setErrorMessage('Failed to analyze the issue. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setIssue('');
    setAcType('');
    setBrand('');
    setModel('');
    setSelectedSymptoms([]);
    setSelectedImage(null);
    setImageError('');
    setErrorMessage('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            AC Troubleshooting
          </CardTitle>
          <CardDescription>
            Describe your air conditioning issue and our AI will diagnose the problem
            and suggest fixes you can try.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Issue description */}
            <div className="space-y-2">
              <label htmlFor="issue" className="text-sm font-medium leading-none">
                Describe the Issue <span className="text-destructive">*</span>
              </label>
              <textarea
                id="issue"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="e.g. My AC is making a loud buzzing noise and not cooling the room properly..."
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {issue.length}/2000
              </p>
            </div>

            {/* Common symptoms */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Common Symptoms (select any that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMON_SYMPTOMS.map((symptom) => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleSymptom(symptom)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selectedSymptoms.includes(symptom)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {symptom}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* AC Details (optional) */}
            <div className="space-y-4">
              <p className="text-sm font-medium leading-none text-muted-foreground">
                AC Unit Details (optional — helps improve diagnosis accuracy)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="acType" className="text-xs font-medium text-muted-foreground">
                    AC Type
                  </label>
                  <select
                    id="acType"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={acType}
                    onChange={(e) => setAcType(e.target.value)}
                  >
                    {AC_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="brand" className="text-xs font-medium text-muted-foreground">
                    Brand
                  </label>
                  <Input
                    id="brand"
                    placeholder="e.g. Daikin"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="model" className="text-xs font-medium text-muted-foreground">
                    Model
                  </label>
                  <Input
                    id="model"
                    placeholder="e.g. FTKF35A"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Image upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Upload Photo (optional)
              </label>
              <p className="text-xs text-muted-foreground">
                A photo of the AC unit or the issue can help the AI provide a more accurate diagnosis.
              </p>
              {!selectedImage ? (
                <div
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload (JPEG or PNG, max 10MB)
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedImage.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleImageChange}
                className="hidden"
              />
              {imageError && (
                <p className="text-sm font-medium text-destructive">{imageError}</p>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Analyzing issue...' : 'Diagnose Issue'}
              </Button>
              {(issue || selectedSymptoms.length > 0 || result) && (
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Result Card */}
      {result && <TroubleshootingResultCard result={result} />}
    </div>
  );
}

function TroubleshootingResultCard({ result }: { result: TroubleshootingResult }) {
  const severityConfig = getSeverityConfig(result.severity);
  const SeverityIcon = severityConfig.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Diagnosis Result</CardTitle>
          <Badge className={severityConfig.className}>
            <SeverityIcon className="h-3 w-3 mr-1" />
            {severityConfig.label} Severity
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Diagnosis */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            Diagnosis
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.diagnosis}
          </p>
        </div>

        <Separator />

        {/* Possible Causes */}
        {result.possibleCauses.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Possible Causes</h3>
            <ul className="space-y-1.5">
              {result.possibleCauses.map((cause, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary font-medium mt-0.5 shrink-0">{i + 1}.</span>
                  {cause}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* Suggested Fixes */}
        {result.suggestedFixes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              What You Can Try
            </h3>
            <ul className="space-y-2">
              {result.suggestedFixes.map((fix, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  {fix}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* Technician recommendation */}
        <div className={`rounded-lg p-4 ${
          result.requiresTechnician
            ? 'bg-orange-50 border border-orange-200 dark:bg-orange-900/10 dark:border-orange-800'
            : 'bg-green-50 border border-green-200 dark:bg-green-900/10 dark:border-green-800'
        }`}>
          <div className="flex items-start gap-3">
            {result.requiresTechnician ? (
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${
                result.requiresTechnician
                  ? 'text-orange-800 dark:text-orange-300'
                  : 'text-green-800 dark:text-green-300'
              }`}>
                {result.requiresTechnician
                  ? 'Professional technician service recommended'
                  : 'This issue may be resolvable without a technician'}
              </p>
              <p className={`text-xs mt-1 ${
                result.requiresTechnician
                  ? 'text-orange-700 dark:text-orange-400'
                  : 'text-green-700 dark:text-green-400'
              }`}>
                {result.requiresTechnician
                  ? 'We recommend booking a service request so one of our technicians can assist you.'
                  : 'Try the suggested fixes above. If the issue persists, consider booking a service request.'}
              </p>
            </div>
          </div>
        </div>

        {/* Additional notes */}
        {result.additionalNotes && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Additional Notes</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {result.additionalNotes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
