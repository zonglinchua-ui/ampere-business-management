
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Mail, Building2, Calendar, Shield, Eye, EyeOff, Phone, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  whatsappNotifications: z.boolean().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  confirmPassword: z.string().optional()
}).refine((data) => {
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false
  }
  return true
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) {
    return false
  }
  return true
}, {
  message: "Current password is required to set new password",
  path: ["currentPassword"]
}).refine((data) => {
  // Validate phone number format if provided
  if (data.phone && data.phone.trim() !== '') {
    // Remove spaces and check if it matches Singapore format
    const cleanPhone = data.phone.replace(/\s/g, '')
    const phoneRegex = /^\+65\d{8}$/
    return phoneRegex.test(cleanPhone)
  }
  return true
}, {
  message: "Invalid phone number. Use Singapore format: +65 XXXX XXXX",
  path: ["phone"]
})

type ProfileFormData = z.infer<typeof profileSchema>

function getRoleDisplay(role: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (role) {
    case 'SUPERADMIN':
      return { label: 'Super Admin', variant: 'destructive' }
    case 'ADMIN':
      return { label: 'Admin', variant: 'destructive' }
    case 'PROJECT_MANAGER':
      return { label: 'Project Manager', variant: 'default' }
    case 'FINANCE':
      return { label: 'Finance', variant: 'secondary' }
    case 'VENDOR':
      return { label: 'Vendor', variant: 'outline' }
    default:
      return { label: role, variant: 'outline' }
  }
}

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema)
  })

  const newPassword = watch('newPassword')
  const whatsappNotifications = watch('whatsappNotifications')

  useEffect(() => {
    if (!session) {
      router.push('/auth/login')
      return
    }

    // Fetch user profile details
    fetchProfile()
  }, [session, router])

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/users/${session?.user?.id}`)
      if (response.ok) {
        const profile = await response.json()
        setUserProfile(profile)
        reset({
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          email: profile.email || '',
          phone: profile.phone || '',
          companyName: profile.companyName || '',
          whatsappNotifications: profile.whatsappNotifications ?? true
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      toast.error('Failed to load profile')
    }
  }

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true)
    
    try {
      const updateData: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        companyName: data.companyName,
        whatsappNotifications: data.whatsappNotifications ?? true
      }

      // Add password fields if changing password
      if (data.newPassword && data.currentPassword) {
        updateData.currentPassword = data.currentPassword
        updateData.newPassword = data.newPassword
      }

      const response = await fetch(`/api/users/${session?.user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update profile')
      }

      const updatedProfile = await response.json()
      setUserProfile(updatedProfile)
      
      // Update the session with new data
      await update({
        ...session,
        user: {
          ...session?.user,
          firstName: updatedProfile.firstName,
          lastName: updatedProfile.lastName,
          email: updatedProfile.email,
          phone: updatedProfile.phone,
          companyName: updatedProfile.companyName
        }
      })

      // Reset form with updated data
      reset({
        firstName: updatedProfile.firstName || '',
        lastName: updatedProfile.lastName || '',
        email: updatedProfile.email || '',
        phone: updatedProfile.phone || '',
        companyName: updatedProfile.companyName || '',
        whatsappNotifications: updatedProfile.whatsappNotifications ?? true,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })

      toast.success('Profile updated successfully')
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  if (!session || !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading profile...</p>
        </div>
      </div>
    )
  }

  const roleInfo = getRoleDisplay(userProfile.role)

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Profile</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account information and preferences
          </p>
        </div>

        {/* Profile Header */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={session.user?.image || ""} />
                <AvatarFallback className="bg-red-600 text-white text-xl">
                  {userProfile.firstName?.[0]}{userProfile.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {userProfile.firstName} {userProfile.lastName}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">{userProfile.email}</p>
                {userProfile.phone && (
                  <p className="text-sm text-gray-500 dark:text-gray-500 flex items-center mt-1">
                    <Phone className="h-3 w-3 mr-1" />
                    {userProfile.phone}
                  </p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-500">User ID: {userProfile.id}</p>
                <div className="flex items-center space-x-4 mt-2">
                  <Badge variant={roleInfo.variant}>
                    <Shield className="h-3 w-3 mr-1" />
                    {roleInfo.label}
                  </Badge>
                  {userProfile.companyName && (
                    <div className="flex items-center text-sm text-gray-500">
                      <Building2 className="h-3 w-3 mr-1" />
                      {userProfile.companyName}
                    </div>
                  )}
                  {userProfile.whatsappNotifications && userProfile.phone && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      WhatsApp Enabled
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <Calendar className="h-4 w-4 mr-2" />
                <span>
                  Member since {new Date(userProfile.createdAt).toLocaleDateString()}
                </span>
              </div>
              {userProfile.lastLoginAt && (
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <User className="h-4 w-4 mr-2" />
                  <span>
                    Last active {formatDistanceToNow(new Date(userProfile.lastLoginAt), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Update your personal information and security settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    {...register('firstName')}
                    placeholder="First name"
                  />
                  {errors.firstName && (
                    <p className="text-sm text-red-600">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    {...register('lastName')}
                    placeholder="Last name"
                  />
                  {errors.lastName && (
                    <p className="text-sm text-red-600">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="Email address"
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  {...register('phone')}
                  placeholder="+65 9123 4567"
                />
                <p className="text-xs text-gray-500">
                  Singapore format: +65 XXXX XXXX (e.g., +65 9123 4567)
                </p>
                {errors.phone && (
                  <p className="text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name (Optional)</Label>
                <Input
                  id="companyName"
                  {...register('companyName')}
                  placeholder="Company name"
                />
              </div>

              <Separator />

              {/* WhatsApp Notifications */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    WhatsApp Notifications
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Receive important alerts and updates via WhatsApp
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="h-5 w-5 text-green-600" />
                      <Label htmlFor="whatsappNotifications" className="font-medium cursor-pointer">
                        Enable WhatsApp Notifications
                      </Label>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {userProfile.phone 
                        ? 'Get notified about project updates, invoices, and alerts'
                        : 'Add your phone number above to enable WhatsApp notifications'}
                    </p>
                  </div>
                  <Switch
                    id="whatsappNotifications"
                    checked={whatsappNotifications ?? true}
                    onCheckedChange={(checked) => setValue('whatsappNotifications', checked, { shouldDirty: true })}
                    disabled={!userProfile.phone && !watch('phone')}
                  />
                </div>

                {!userProfile.phone && !watch('phone') && (
                  <Alert>
                    <AlertDescription>
                      Please add your phone number above to enable WhatsApp notifications.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Separator />

              {/* Password Change Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Change Password
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Leave password fields empty if you don't want to change your password
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      {...register('currentPassword')}
                      placeholder="Current password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.currentPassword && (
                    <p className="text-sm text-red-600">{errors.currentPassword.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      {...register('newPassword')}
                      placeholder="New password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.newPassword && (
                    <p className="text-sm text-red-600">{errors.newPassword.message}</p>
                  )}
                </div>

                {newPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        {...register('confirmPassword')}
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset()
                    fetchProfile()
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isDirty || isLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isLoading ? 'Updating...' : 'Update Profile'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
