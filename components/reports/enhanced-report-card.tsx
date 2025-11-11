
'use client'

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { CheckCircle, Clock, AlertCircle, Play, Settings, FileText, FileBarChart, Eye, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReportData {
  id: string
  name: string
  description: string
  category: string
  type: 'financial' | 'project' | 'client' | 'operations'
  icon: any
  color: string
  fields: string[]
  lastGenerated?: string
  status: 'ready' | 'generating' | 'error'
}

interface EnhancedReportCardProps {
  report: ReportData
  isGenerating: boolean
  onQuickGenerate: (reportId: string, format: 'excel' | 'pdf') => void
  onConfigure: (report: ReportData) => void
  onPreview: (report: ReportData) => void
}

export function EnhancedReportCard({
  report,
  isGenerating,
  onQuickGenerate,
  onConfigure,
  onPreview
}: EnhancedReportCardProps) {
  const IconComponent = report.icon

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
      className="border rounded-lg p-5 hover:shadow-lg transition-all duration-200 bg-white dark:bg-gray-800"
    >
      <div className="flex items-start space-x-4">
        <div className={cn("p-3 rounded-lg flex-shrink-0", report.color)}>
          <IconComponent className="h-6 w-6" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-base truncate pr-2">{report.name}</h3>
            <Badge
              variant="outline"
              className={cn(
                "text-xs shrink-0",
                report.status === 'ready' ? 'border-green-200 text-green-700 bg-green-50' :
                report.status === 'generating' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                'border-red-200 text-red-700 bg-red-50'
              )}
            >
              {report.status === 'ready' && <CheckCircle className="w-3 h-3 mr-1" />}
              {report.status === 'generating' && <Clock className="w-3 h-3 mr-1" />}
              {report.status === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
              {report.status}
            </Badge>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
            {report.description}
          </p>

          {report.lastGenerated && (
            <p className="text-xs text-gray-500 mb-3">
              Last generated: {report.lastGenerated}
            </p>
          )}

          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={isGenerating}
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Quick Generate
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => onQuickGenerate(report.id, 'excel')}>
                  <FileText className="w-4 h-4 mr-2 text-green-600" />
                  <span>Generate Excel</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onQuickGenerate(report.id, 'pdf')}>
                  <FileBarChart className="w-4 h-4 mr-2 text-red-600" />
                  <span>Generate PDF</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onPreview(report)}>
                  <Eye className="w-4 h-4 mr-2 text-blue-600" />
                  <span>Preview PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onConfigure(report)}
              disabled={isGenerating}
              className="shrink-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
