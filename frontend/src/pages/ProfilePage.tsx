import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  BadgeCheck,
  CalendarDays,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { changePasswordApi, requestProfileGmailOtpApi } from '@/services/authApi';
import { toAuthRequestError } from '@/contexts/AuthContext';
import { GmailVerificationDialog } from '@/components/auth/GmailVerificationDialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';

// --- Helpers ---

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case 'admin':
      return 'destructive' as const;
    case 'technician':
      return 'secondary' as const;
    default:
      return 'default' as const;
  }
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as Record<string, unknown>).response === 'object'
  ) {
    const response = (err as { response: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
}

// --- Schemas ---

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  // Autofilled from registration. Changing it requires a fresh OTP.
  gmail: z
    .string()
    .trim()
    .min(1, 'Gmail is required')
    .email('Please enter a valid email address')
    .refine((v) => /@(gmail|googlemail)\.com$/i.test(v.trim()), {
      message: 'Must be a Gmail address (e.g. you@gmail.com)',
    }),
  contactNumber: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{11}$/.test(v), {
      message: 'Contact number must be exactly 11 digits',
    }),
  street: z.string().trim().max(255, 'Street must be at most 255 characters'),
  barangay: z.string().trim().max(255, 'Barangay must be at most 255 characters'),
  city: z.string().trim().max(255, 'City must be at most 255 characters'),
  province: z.string().trim().max(255, 'Province must be at most 255 characters'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/\d/, 'Must contain at least one digit'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

// --- Page ---

export function ProfilePage() {
  const { user, updateProfile } = useAuth();

  // Gmail change verification. A new Gmail is only saved once the code emailed
  // to it has been accepted, so the profile can't be updated unverified.
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpMeta, setOtpMeta] = useState({
    maskedGmail: '',
    expiresInMinutes: 10,
    resendAvailableInSeconds: 60,
    delivered: true,
  });
  const [pendingValues, setPendingValues] = useState<ProfileFormValues | null>(null);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      gmail: user?.gmail ?? '',
      contactNumber: user?.contactNumber ?? '',
      street: user?.street ?? '',
      barangay: user?.barangay ?? '',
      city: user?.city ?? '',
      province: user?.province ?? '',
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    // Validate on blur, then re-validate live as the user corrects input.
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  // Keep the profile form in sync if the user loads/changes after mount.
  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name,
        email: user.email,
        gmail: user.gmail ?? '',
        contactNumber: user.contactNumber ?? '',
        street: user.street ?? '',
        barangay: user.barangay ?? '',
        city: user.city ?? '',
        province: user.province ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, user?.email, user?.gmail, user?.contactNumber, user?.street, user?.barangay, user?.city, user?.province]);

  if (!user) {
    return null;
  }

  const isProfileDirty = profileForm.formState.isDirty;
  const isSavingProfile = profileForm.formState.isSubmitting;
  const isChangingPassword = passwordForm.formState.isSubmitting;

  /** True when the form's Gmail differs from the one already on the account. */
  function isGmailChanged(values: ProfileFormValues): boolean {
    const current = (user?.gmail ?? '').trim().toLowerCase();
    return values.gmail.trim().toLowerCase() !== current;
  }

  /** Persists the profile, optionally carrying the OTP for a Gmail change. */
  async function persistProfile(values: ProfileFormValues, gmailOtp?: string) {
    const updated = await updateProfile({
      name: values.name,
      email: values.email,
      gmail: values.gmail,
      gmailOtp,
      contactNumber: values.contactNumber,
      street: values.street,
      barangay: values.barangay,
      city: values.city,
      province: values.province,
    });
    profileForm.reset({
      name: updated.name,
      email: updated.email,
      gmail: updated.gmail ?? '',
      contactNumber: updated.contactNumber ?? '',
      street: updated.street ?? '',
      barangay: updated.barangay ?? '',
      city: updated.city ?? '',
      province: updated.province ?? '',
    });
  }

  /** Asks the backend to email a code to the newly entered Gmail address. */
  async function sendGmailCode(gmail: string) {
    const result = await requestProfileGmailOtpApi(gmail);
    setOtpMeta({
      maskedGmail: result.maskedGmail,
      expiresInMinutes: result.expiresInMinutes,
      resendAvailableInSeconds: result.resendAvailableInSeconds,
      delivered: result.delivered,
    });
  }

  async function onSaveProfile(values: ProfileFormValues) {
    // Changing the Gmail address re-runs the OTP process before anything saves.
    if (isGmailChanged(values)) {
      try {
        await sendGmailCode(values.gmail);
        setPendingValues(values);
        setOtpDialogOpen(true);
      } catch (err) {
        const mapped = toAuthRequestError(err);
        const gmailError = mapped.fieldErrors.find((fe) => fe.field === 'gmail');
        if (gmailError) {
          profileForm.setError('gmail', { type: 'server', message: gmailError.message });
        }
        toast.error(mapped.message);
      }
      return;
    }

    try {
      await persistProfile(values);
      toast.success('Profile updated successfully.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update profile. Please try again.'));
    }
  }

  /** Called by the dialog with the entered code; throws to show errors inline. */
  async function handleVerifyGmail(code: string) {
    if (!pendingValues) return;

    try {
      await persistProfile(pendingValues, code);
    } catch (err) {
      const mapped = toAuthRequestError(err);
      const otpError = mapped.fieldErrors.find((fe) => fe.field === 'gmailOtp');
      if (otpError) {
        // Keep the dialog open so the code can be re-entered.
        throw new Error(otpError.message);
      }
      setOtpDialogOpen(false);
      const gmailError = mapped.fieldErrors.find((fe) => fe.field === 'gmail');
      if (gmailError) {
        profileForm.setError('gmail', { type: 'server', message: gmailError.message });
      }
      toast.error(mapped.message);
      return;
    }

    setOtpDialogOpen(false);
    setPendingValues(null);
    toast.success('Profile and Gmail address updated successfully.');
  }

  async function handleResendGmailCode() {
    if (!pendingValues) return;
    try {
      await sendGmailCode(pendingValues.gmail);
      toast.success('A new code is on its way.');
    } catch (err) {
      throw new Error(toAuthRequestError(err).message);
    }
  }

  async function onChangePassword(values: PasswordFormValues) {
    try {
      await changePasswordApi({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed successfully.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to change password. Please try again.'));
    }
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal information and account security.
        </p>
      </div>

      {/* Profile summary header */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 pt-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <span className="text-xl font-semibold">{user.name}</span>
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">
                {user.role}
              </Badge>
              {user.isActive ? (
                <Badge className="bg-green-600 hover:bg-green-600">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
          </div>
          <div className="sm:ml-auto grid gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="capitalize">{user.role} account</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>Member since {formatDate(user.createdAt)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Edit profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4" />
              Edit Profile
            </CardTitle>
            <CardDescription>Update your display name, email, contact number, and address.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your name" autoComplete="name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="gmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        Gmail
                        {user.gmailVerified && (
                          <span className="inline-flex items-center gap-1 text-xs font-normal text-green-600 dark:text-green-500">
                            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            Verified
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@gmail.com"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Where system notifications are sent. Changing it requires a new 6-digit
                        verification code.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        Contact Number
                      </FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="e.g. 09171234567" autoComplete="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5" />
                    Address
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Used to prefill your service requests and help match nearby technicians.
                  </p>
                </div>
                <FormField
                  control={profileForm.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street</FormLabel>
                      <FormControl>
                        <Input placeholder="House no., street name" autoComplete="address-line1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField
                    control={profileForm.control}
                    name="barangay"
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
                    control={profileForm.control}
                    name="city"
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
                    control={profileForm.control}
                    name="province"
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

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!isProfileDirty || isSavingProfile}
                    onClick={() =>
                      profileForm.reset({
                        name: user.name,
                        email: user.email,
                        gmail: user.gmail ?? '',
                        contactNumber: user.contactNumber ?? '',
                        street: user.street ?? '',
                        barangay: user.barangay ?? '',
                        city: user.city ?? '',
                        province: user.province ?? '',
                      })
                    }
                  >
                    Reset
                  </Button>
                  <Button type="submit" disabled={!isProfileDirty || isSavingProfile}>
                    {isSavingProfile ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              Change Password
            </CardTitle>
            <CardDescription>
              Use at least 8 characters with an uppercase letter, a lowercase letter, and a digit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder="Enter current password"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder="Enter new password"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder="Re-enter new password"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-1">
                  <Button type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? 'Updating…' : 'Update Password'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <GmailVerificationDialog
        open={otpDialogOpen}
        onOpenChange={(open) => {
          setOtpDialogOpen(open);
          if (!open) setPendingValues(null);
        }}
        maskedGmail={otpMeta.maskedGmail}
        expiresInMinutes={otpMeta.expiresInMinutes}
        resendCooldownSeconds={otpMeta.resendAvailableInSeconds}
        onVerify={handleVerifyGmail}
        onResend={handleResendGmailCode}
        title="Verify your new Gmail"
        submitLabel="Verify & Save"
        deliveryWarning={
          otpMeta.delivered
            ? null
            : 'Email delivery is not configured on the server, so the code could not be sent. Ask an administrator to set RESEND_API_KEY.'
        }
      />
    </div>
  );
}
