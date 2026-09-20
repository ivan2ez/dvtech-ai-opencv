import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MailQuestionMark, CheckCircle2Icon } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { forgotPasswordApi } from '@/services/authApi';

const forgotSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  // Dev-only reset link, returned by the API until email delivery is set up.
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const form = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotFormValues) {
    try {
      const res = await forgotPasswordApi(values.email);
      setDevResetUrl(res.resetUrl ?? null);
      setSubmitted(true);
    } catch {
      // Interceptor already surfaces a toast; keep the page usable.
      toast.error('Something went wrong. Please try again.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailQuestionMark className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            Enter your account email and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                <CheckCircle2Icon className="h-5 w-5 shrink-0" />
                <p>
                  If an account exists for that email, a password reset link has been generated.
                  Please check your inbox.
                </p>
              </div>

              {devResetUrl && (
                <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-900/20">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    Development mode
                  </p>
                  <p className="mt-1 text-amber-700 dark:text-amber-400">
                    Email delivery isn't configured, so here's your reset link:
                  </p>
                  <Link
                    to={devResetUrl.replace(/^https?:\/\/[^/]+/, '')}
                    className="mt-2 block break-all text-primary underline-offset-4 hover:underline"
                  >
                    {devResetUrl}
                  </Link>
                </div>
              )}

              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Back to Sign In</Link>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Sending…' : 'Send Reset Link'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Remember your password?{' '}
                  <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
