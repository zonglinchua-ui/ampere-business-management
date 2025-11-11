
'use client'

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { 
  LayoutDashboard, 
  Users, 
  FolderOpen, 
  FileText, 
  Settings, 
  LogOut, 
  User,
  Menu,
  Bell,
  Search,
  Moon,
  Sun,
  BarChart3,
  Building2,
  Store,
  Briefcase,
  Calculator,
  CreditCard,
  Bot,
  CheckSquare,
  Wrench,
  FileCheck
} from "lucide-react"
import { useTheme } from "next-themes"
import { Input } from "@/components/ui/input"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { SyncProgressIndicator } from "@/components/sync-progress-indicator"

interface MainLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["SUPERADMIN", "PROJECT_MANAGER", "FINANCE", "SALES"] },
  { name: "Contacts", href: "/contacts", icon: Users, roles: ["SUPERADMIN", "PROJECT_MANAGER", "FINANCE", "SALES"] },
  { name: "Tenders", href: "/tenders", icon: Briefcase, roles: ["SUPERADMIN", "SALES"] },
  { name: "Quotations", href: "/quotations", icon: Calculator, roles: ["SUPERADMIN", "SALES"] },
  { name: "Projects", href: "/projects", icon: FolderOpen, roles: ["SUPERADMIN", "PROJECT_MANAGER", "FINANCE", "SALES"] },
  { name: "Tasks", href: "/tasks", icon: CheckSquare, roles: ["SUPERADMIN", "PROJECT_MANAGER"] },
  { name: "Servicing & Maintenance", href: "/servicing", icon: Wrench, roles: ["SUPERADMIN", "PROJECT_MANAGER"] },
  { name: "Finance", href: "/finance", icon: CreditCard, roles: ["SUPERADMIN", "FINANCE", "PROJECT_MANAGER"] },
  { name: "AI Assistant", href: "/ai-assistant", icon: Bot, roles: ["SUPERADMIN", "PROJECT_MANAGER", "FINANCE", "SALES"] },
  { name: "Reports", href: "/reports", icon: BarChart3, roles: ["SUPERADMIN", "FINANCE", "SALES", "PROJECT_MANAGER"] },
  { name: "Company Profile", href: "/company-profile", icon: Building2, roles: ["SUPERADMIN", "SALES"] },
  { name: "BCA Workhead", href: "/bca-workhead", icon: FileCheck, roles: ["SUPERADMIN"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["SUPERADMIN"] },
]

const vendorNavigation = [
  { name: "My Portal", href: "/vendor-portal", icon: Store, roles: ["SUPPLIER"] },
]

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: session } = useSession() || {}
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const userRole = session?.user?.role
  const isSupplier = userRole === "SUPPLIER"
  
  const filteredNavigation = isSupplier 
    ? vendorNavigation.filter(item => item.roles.includes(userRole || ""))
    : navigation.filter(item => item.roles.includes(userRole || ""))

  const handleSignOut = () => {
    signOut({ callbackUrl: "/auth/login" })
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "SUPERADMIN":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "PROJECT_MANAGER":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "FINANCE":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "SALES":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "SUPPLIER":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    }
  }

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case "SUPERADMIN":
        return "Super Admin"
      case "PROJECT_MANAGER":
        return "Project Manager"
      case "FINANCE":
        return "Finance"
      case "SALES":
        return "Sales"
      case "SUPPLIER":
        return "Supplier"
      default:
        return role
    }
  }

  if (!session) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          {/* Logo */}
          <div className="flex h-16 flex-shrink-0 items-center px-6 bg-red-600">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span className="text-red-600 font-bold text-lg">A</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Ampere</h1>
                <p className="text-red-100 text-xs">Engineering</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {filteredNavigation.map((item) => {
              const isActive = pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <item.icon className={`mr-3 h-5 w-5 ${
                    isActive ? "text-red-600 dark:text-red-400" : "text-gray-400"
                  }`} />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User profile */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={session.user?.image || ""} />
                <AvatarFallback className="bg-red-600 text-white">
                  {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {session.user?.name}
                </p>
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${getRoleColor(userRole || "")}`}
                >
                  {getRoleDisplay(userRole || "")}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            {/* Mobile menu button */}
            <div className="flex items-center space-x-4">
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="lg:hidden">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <div className="flex h-full flex-col bg-white dark:bg-gray-800">
                    {/* Mobile logo */}
                    <div className="flex h-16 items-center px-6 bg-red-600">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                          <span className="text-red-600 font-bold text-lg">A</span>
                        </div>
                        <div>
                          <h1 className="text-white font-bold text-lg">Ampere</h1>
                          <p className="text-red-100 text-xs">Engineering</p>
                        </div>
                      </div>
                    </div>

                    {/* Mobile navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-2">
                      {filteredNavigation.map((item) => {
                        const isActive = pathname?.startsWith(item.href)
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                              isActive
                                ? "bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400"
                                : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                            }`}
                          >
                            <item.icon className={`mr-3 h-5 w-5 ${
                              isActive ? "text-red-600 dark:text-red-400" : "text-gray-400"
                            }`} />
                            {item.name}
                          </Link>
                        )
                      })}
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Search */}
              <div className="hidden sm:flex sm:items-center sm:space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>

            {/* Right side items */}
            <div className="flex items-center space-x-4">
              {/* Xero Sync Progress Indicator */}
              {(userRole === 'SUPERADMIN' || userRole === 'FINANCE' || userRole === 'PROJECT_MANAGER') && (
                <SyncProgressIndicator />
              )}

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>

              {/* Notifications - Only for Super Admins */}
              {userRole === 'SUPERADMIN' && <NotificationBell />}

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.user?.image || ""} />
                      <AvatarFallback className="bg-red-600 text-white">
                        {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{session.user?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.user?.email}
                      </p>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs w-fit ${getRoleColor(userRole || "")}`}
                      >
                        {getRoleDisplay(userRole || "")}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
