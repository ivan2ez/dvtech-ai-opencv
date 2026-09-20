import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AuthRequestError, toAuthRequestError } from '@/contexts/AuthContext';
import { requestRegistrationOtpApi } from '@/services/authApi';
import { GmailVerificationDialog } from '@/components/auth/GmailVerificationDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be at most 100 characters'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    // Verified separately by OTP, so it must be a real Gmail mailbox.
    gmail: z
      .string()
      .min(1, 'Gmail is required')
      .email('Please enter a valid email address')
      .refine((v) => /@(gmail|googlemail)\.com$/i.test(v.trim()), {
        message: 'Must be a Gmail address (e.g. you@gmail.com)',
      }),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one digit'),
    confirmPassword: z
      .string()
      .min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

/** Form fields a backend field-error can be mapped back onto. */
const MAPPABLE_FIELDS = ['name', 'email', 'gmail', 'password'] as const;
type MappableField = (typeof MAPPABLE_FIELDS)[number];

export function RegisterForm() {
  const { register, error: authError } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Gmail verification step. The account is only created once the code emailed
  // to the entered Gmail address has been accepted by the backend.
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpMeta, setOtpMeta] = useState({
    maskedGmail: '',
    expiresInMinutes: 10,
    resendAvailableInSeconds: 60,
    delivered: true,
  });

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      gmail: '',
      password: '',
      confirmPassword: '',
    },
    // Validate on blur, then re-validate live as the user corrects input.
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  /**
   * Maps backend field errors onto the form.
   * Returns true when at least one was tied to a visible field.
   */
  const applyFieldErrors = (fieldErrors: Array<{ field: string; message: string }>): boolean => {
    let mapped = false;
    for (const fe of fieldErrors) {
      if ((MAPPABLE_FIELDS as readonly string[]).includes(fe.field)) {
        form.setError(fe.field as MappableField, { type: 'server', message: fe.message });
        mapped = true;
      }
    }
    return mapped;
  };

  const reportError = (err: unknown) => {
    if (err instanceof AuthRequestError) {
      if (!applyFieldErrors(err.fieldErrors)) {
        setServerError(err.message);
      }
      toast.error(err.message);
      return;
    }
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    setServerError(message);
    toast.error(message);
  };

  /** Asks the backend to email a verification code to the entered Gmail. */
  const sendVerificationCode = async (email: string, gmail: string) => {
    const result = await requestRegistrationOtpApi(email, gmail);
    setOtpMeta({
      maskedGmail: result.maskedGmail,
      expiresInMinutes: result.expiresInMinutes,
      resendAvailableInSeconds: result.resendAvailableInSeconds,
      delivered: result.delivered,
    });
    return result;
  };

  // Step 1: validate the form, then request the code and open the dialog.
  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await sendVerificationCode(values.email, values.gmail);
      setOtpDialogOpen(true);
    } catch (err: unknown) {
      reportError(toAuthRequestError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: the dialog submits the code; the account is created here.
  const handleVerify = async (code: string) => {
    const values = form.getValues();
    try {
      await register({
        name: values.name,
        email: values.email,
        password: values.password,
        gmail: values.gmail,
        gmailOtp: code,
      });
    } catch (err: unknown) {
      // A bad code stays in the dialog. Anything tied to another field means
      // the form itself needs fixing, so close the dialog and surface it there.
      if (err instanceof AuthRequestError) {
        const otpError = err.fieldErrors.find((fe) => fe.field === 'gmailOtp');
        if (otpError) {
          throw new Error(otpError.message);
        }
        setOtpDialogOpen(false);
        reportError(err);
        return;
      }
      setOtpDialogOpen(false);
      reportError(err);
      return;
    }

    setOtpDialogOpen(false);
    toast.success('Account created successfully. Welcome!');
    navigate('/dashboard');
  };

  const handleResend = async () => {
    const values = form.getValues();
    try {
      await sendVerificationCode(values.email, values.gmail);
      toast.success('A new code is on its way.');
    } catch (err: unknown) {
      const mapped = toAuthRequestError(err);
      throw new Error(mapped.message);
    }
  };

  const displayError = serverError || authError;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>
          Enter your details to create a new account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {displayError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {displayError}
              </div>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Juan Dela Cruz"
                      autoComplete="name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gmail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@gmail.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    We'll email a 6-digit code here to verify your account. Notifications are
                    sent to this address.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="Create a password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending code...' : 'Create Account'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>

      <GmailVerificationDialog
        open={otpDialogOpen}
        onOpenChange={setOtpDialogOpen}
        maskedGmail={otpMeta.maskedGmail}
        expiresInMinutes={otpMeta.expiresInMinutes}
        resendCooldownSeconds={otpMeta.resendAvailableInSeconds}
        onVerify={handleVerify}
        onResend={handleResend}
        deliveryWarning={
          otpMeta.delivered
            ? null
            : 'Email delivery is not configured on the server, so the code could not be sent. Ask an administrator to set RESEND_API_KEY.'
        }
      />
    </Card>
  );
}
