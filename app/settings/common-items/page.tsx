
'use client'

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, Package, TrendingUp, DollarSign, Search } from "lucide-react"
import { format } from "date-fns"

interface CommonItem {
  id: string
  description: string
  category: string
  unit: string
  averageUnitPrice: number
  lastUnitPrice: number
  usageCount: number
  lastUsedAt: string
  createdAt: string
  User?: {
    firstName: string
    lastName: string
  }
}

const itemCategories = [
  { value: "MATERIALS", label: "Materials" },
  { value: "SERVICES", label: "Services" },
  { value: "SUBCONTRACTORS", label: "Subcontractors" },
  { value: "MISCELLANEOUS", label: "Miscellaneous" }
]

const units = [
  "pcs", "units", "hours", "days", "sqm", "m", "kg", "lots", "set", "package", "nos."
]

export default function CommonItemsPage() {
  const { data: session } = useSession()
  const [items, setItems] = useState<CommonItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CommonItem | null>(null)
  const [itemToDelete, setItemToDelete] = useState<CommonItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [formData, setFormData] = useState({
    description: "",
    category: "MATERIALS",
    unit: "pcs",
    defaultPrice: ""
  })

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/common-items?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (item?: CommonItem) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        description: item.description,
        category: item.category,
        unit: item.unit,
        defaultPrice: item.averageUnitPrice.toString()
      })
    } else {
      setEditingItem(null)
      setFormData({
        description: "",
        category: "MATERIALS",
        unit: "pcs",
        defaultPrice: ""
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingItem(null)
  }

  const handleSave = async () => {
    if (!formData.description || !formData.defaultPrice) {
      alert('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const url = editingItem 
        ? `/api/common-items/${editingItem.id}` 
        : '/api/common-items'
      
      const method = editingItem ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchItems()
        handleCloseDialog()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save item')
      }
    } catch (error) {
      console.error('Error saving item:', error)
      alert('Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!itemToDelete) return

    setSaving(true)
    try {
      const response = await fetch(`/api/common-items/${itemToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchItems()
        setDeleteDialogOpen(false)
        setItemToDelete(null)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete item')
      }
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item')
    } finally {
      setSaving(false)
    }
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'MATERIALS': 'bg-blue-100 text-blue-700',
      'SERVICES': 'bg-green-100 text-green-700',
      'SUBCONTRACTORS': 'bg-purple-100 text-purple-700',
      'MISCELLANEOUS': 'bg-gray-100 text-gray-700'
    }
    return colors[category] || colors['MISCELLANEOUS']
  }

  const filteredItems = items.filter(item =>
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center text-2xl">
                  <Package className="mr-2 h-6 w-6" />
                  Common Items Database
                </CardTitle>
                <CardDescription className="mt-2">
                  Manage commonly used items for quotations. These items will appear in autocomplete suggestions when creating quotations.
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Items</p>
                <p className="text-2xl font-bold text-blue-600">{items.length}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Materials</p>
                <p className="text-2xl font-bold text-green-600">
                  {items.filter(i => i.category === 'MATERIALS').length}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Services</p>
                <p className="text-2xl font-bold text-purple-600">
                  {items.filter(i => i.category === 'SERVICES').length}
                </p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Usage</p>
                <p className="text-2xl font-bold text-orange-600">
                  {items.reduce((sum, item) => sum + item.usageCount, 0)}
                </p>
              </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Default Price</TableHead>
                    <TableHead>Last Price</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        {searchQuery ? 'No items match your search' : 'No items yet. Add your first common item!'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium max-w-md">
                          {item.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getCategoryColor(item.category)}>
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>
                          <div className="flex items-center text-green-600 font-medium">
                            <DollarSign className="h-3 w-3" />
                            {item.averageUnitPrice.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-blue-600 font-medium">
                            <DollarSign className="h-3 w-3" />
                            {item.lastUnitPrice.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <TrendingUp className="h-4 w-4 mr-1 text-gray-400" />
                            {item.usageCount}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {item.lastUsedAt ? (() => {
                            try {
                              return format(new Date(item.lastUsedAt), 'MMM dd, yyyy')
                            } catch (error) {
                              return '-'
                            }
                          })() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setItemToDelete(item)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </DialogTitle>
              <DialogDescription>
                {editingItem 
                  ? 'Update the item details below' 
                  : 'Add a new common item to the database'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Description *
                </label>
                <Input
                  placeholder="e.g., LED Downlight 10W"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Category *
                  </label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {itemCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Unit *
                  </label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Default Unit Price *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.defaultPrice}
                  onChange={(e) => setFormData({ ...formData, defaultPrice: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be suggested when adding this item to quotations
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingItem ? 'Update' : 'Add Item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Item</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this item? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {itemToDelete && (
              <div className="py-4">
                <p className="font-medium">{itemToDelete.description}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Category: {itemToDelete.category} • Unit: {itemToDelete.unit} • Used {itemToDelete.usageCount} times
                </p>
              </div>
            )}
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setItemToDelete(null)
                }}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete} 
                disabled={saving}
              >
                {saving ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
