
'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  LayoutDashboard,
  Calendar,
  FileText,
  Wrench,
  TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"

export function ServicingNavigation() {
  const pathname = usePathname()
  
  const isActive = (path: string) => {
    if (path === '/servicing' && pathname === '/servicing') return true
    if (path !== '/servicing' && pathname.startsWith(path)) return true
    return false
  }

  return (
    <div className="mb-6 border-b">
      <div className="flex space-x-1 overflow-x-auto pb-px">
        <Link 
          href="/servicing" 
          className={cn(
            "flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            isActive('/servicing') && pathname === '/servicing'
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Dashboard
        </Link>
        
        <Link 
          href="/servicing/calendar" 
          className={cn(
            "flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            isActive('/servicing/calendar')
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Calendar
        </Link>
        
        <Link 
          href="/servicing/contracts" 
          className={cn(
            "flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            isActive('/servicing/contracts')
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <FileText className="mr-2 h-4 w-4" />
          Contracts
        </Link>
        
        <Link 
          href="/servicing/jobs" 
          className={cn(
            "flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            isActive('/servicing/jobs')
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <Wrench className="mr-2 h-4 w-4" />
          Jobs
        </Link>
        
        <Link 
          href="/servicing/reports" 
          className={cn(
            "flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            isActive('/servicing/reports')
              ? "border-primary text-primary" 
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Reports
        </Link>
      </div>
    </div>
  )
}
