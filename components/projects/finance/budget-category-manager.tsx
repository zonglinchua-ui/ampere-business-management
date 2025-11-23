
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter,
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  Plus, 
  Edit, 
  Trash2, 
  MoreHorizontal, 
  Settings,
  Eye,
  EyeOff,
  Palette,
  Tag
} from 'lucide-react'
import { toast } from 'sonner'

interface BudgetCategory {
  id: string
  name: string
  code: string
  description?: string
  color?: string
  icon?: string
  isActive: boolean
  isDefault: boolean
  createdAt: string
  User: { name?: string; firstName?: string; lastName?: string }
  _count: {
    ProjectBudget: number
    ProjectTransaction: number
  }
}

interface BudgetCategoryManagerProps {
  trigger?: React.ReactNode
}

const DEFAULT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
]

const ICON_OPTIONS = [
  { value: 'package', label: 'Package' },
  { value: 'wrench', label: 'Tools' },
  { value: 'users', label: 'People' },
  { value: 'truck', label: 'Transport' },
  { value: 'building', label: 'Building' },
  { value: 'file-text', label: 'Document' },
  { value: 'dollar-sign', label: 'Money' },
  { value: 'shield', label: 'Shield' },
  { value: 'zap', label: 'Energy' },
  { value: 'star', label: 'Star' },
]

export function BudgetCategoryManager({ trigger }: BudgetCategoryManagerProps) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [systemCategories, setSystemCategories] = useState<any[]>([])
  const [showInactive, setShowInactive] = useState(false)
  
  // Category form states
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    color: DEFAULT_COLORS[0],
    icon: ICON_OPTIONS[0].value,
  })

  // Delete confirmation
  const [categoryToDelete, setCategoryToDelete] = useState<BudgetCategory | null>(null)

  const userRole = session?.user?.role
  const canManage = ['FINANCE', 'SUPERADMIN'].includes(userRole || '')

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/budget-categories?includeInactive=${showInactive}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }

      const data = await response.json()
      setSystemCategories(data.systemCategories)
      setCategories(data.customCategories)
    } catch (error) {
      console.error('Error fetching categories:', error)
      toast.error('Failed to load budget categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchCategories()
    }
  }, [open, showInactive])

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || (!selectedCategory && !formData.code.trim())) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const url = selectedCategory 
        ? `/api/budget-categories/${selectedCategory.id}`
        : '/api/budget-categories'
      
      const method = selectedCategory ? 'PUT' : 'POST'
      
      const payload = selectedCategory 
        ? {
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            color: formData.color,
            icon: formData.icon,
          }
        : {
            name: formData.name.trim(),
            code: formData.code.toUpperCase().trim(),
            description: formData.description.trim() || undefined,
            color: formData.color,
            icon: formData.icon,
          }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${selectedCategory ? 'update' : 'create'} category`)
      }

      toast.success(`Category ${selectedCategory ? 'updated' : 'created'} successfully`)
      setShowCategoryDialog(false)
      setSelectedCategory(null)
      setFormData({
        name: '',
        code: '',
        description: '',
        color: DEFAULT_COLORS[0],
        icon: ICON_OPTIONS[0].value,
      })
      fetchCategories()
    } catch (error) {
      console.error('Error saving category:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save category')
    }
  }

  const handleEditCategory = (category: BudgetCategory) => {
    setSelectedCategory(category)
    setFormData({
      name: category.name,
      code: category.code,
      description: category.description || '',
      color: category.color || DEFAULT_COLORS[0],
      icon: category.icon || ICON_OPTIONS[0].value,
    })
    setShowCategoryDialog(true)
  }

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return

    try {
      const response = await fetch(`/api/budget-categories/${categoryToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete category')
      }

      toast.success('Category deleted successfully')
      setCategoryToDelete(null)
      fetchCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete category')
    }
  }

  const handleToggleActive = async (category: BudgetCategory) => {
    try {
      const response = await fetch(`/api/budget-categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !category.isActive })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update category')
      }

      toast.success(`Category ${category.isActive ? 'deactivated' : 'activated'} successfully`)
      fetchCategories()
    } catch (error) {
      console.error('Error toggling category status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update category')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Manage Categories
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Budget Category Management</DialogTitle>
            <DialogDescription>
              Manage custom budget categories for your projects. System categories cannot be modified.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Controls */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowInactive(!showInactive)}
                >
                  {showInactive ? (
                    <>
                      <EyeOff className="mr-2 h-4 w-4" />
                      Hide Inactive
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Show Inactive
                    </>
                  )}
                </Button>
              </div>
              {canManage && (
                <Button onClick={() => setShowCategoryDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Custom Category
                </Button>
              )}
            </div>

            {/* System Categories */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-600">System Categories (Built-in)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {systemCategories.map((category) => (
                  <div 
                    key={category.value}
                    className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{category.label}</div>
                      <div className="text-xs text-gray-500">{category.description}</div>
                    </div>
                    <Badge variant="secondary">System</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Categories */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-600">Custom Categories</h4>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Tag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No custom categories created</p>
                  <p className="text-sm">Create custom categories to organize your project budgets</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {category.color && (
                                <div 
                                  className="w-3 h-3 rounded-full border"
                                  style={{ backgroundColor: category.color }}
                                />
                              )}
                              <span className="font-medium">{category.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                              {category.code}
                            </code>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate">
                              {category.description || 'No description'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{category._count.ProjectBudget} budgets</div>
                              <div className="text-xs text-gray-500">
                                {category._count.ProjectTransaction} transactions
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={category.isActive ? "default" : "secondary"}>
                              {category.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => handleEditCategory(category)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleActive(category)}>
                                    {category.isActive ? (
                                      <EyeOff className="mr-2 h-4 w-4" />
                                    ) : (
                                      <Eye className="mr-2 h-4 w-4" />
                                    )}
                                    {category.isActive ? 'Deactivate' : 'Activate'}
                                  </DropdownMenuItem>
                                  {category._count.ProjectBudget === 0 && category._count.ProjectTransaction === 0 && (
                                    <DropdownMenuItem 
                                      onClick={() => setCategoryToDelete(category)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Form Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmitCategory}>
            <DialogHeader>
              <DialogTitle>
                {selectedCategory ? 'Edit Category' : 'Create Custom Category'}
              </DialogTitle>
              <DialogDescription>
                {selectedCategory 
                  ? 'Update the category details below.'
                  : 'Create a new custom budget category for your projects.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Custom Materials"
                  required
                />
              </div>
              
              {!selectedCategory && (
                <div className="grid gap-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') 
                    }))}
                    placeholder="e.g., CUSTOM_MATERIALS"
                    required
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500">
                    Uppercase letters, numbers and underscores only. Cannot be changed after creation.
                  </p>
                </div>
              )}
              
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description for this category..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="color">Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {DEFAULT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.color === color ? 'border-gray-900' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                      />
                    ))}
                  </div>
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full h-10"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="icon">Icon</Label>
                  <select
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowCategoryDialog(false)
                  setSelectedCategory(null)
                  setFormData({
                    name: '',
                    code: '',
                    description: '',
                    color: DEFAULT_COLORS[0],
                    icon: ICON_OPTIONS[0].value,
                  })
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {selectedCategory ? 'Update Category' : 'Create Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "{categoryToDelete?.name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
