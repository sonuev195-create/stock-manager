import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useBulkCreateCategories, type Category } from '@/hooks/useCategories';
import { FolderTree, Plus, Pencil, Trash2, Upload, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function CategoryDialog() {
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkText, setBulkText] = useState('');
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();
  const bulkCreateCategories = useBulkCreateCategories();

  const resetForm = () => {
    setName('');
    setDescription('');
    setEditingCategory(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingCategory) {
      await updateCategory.mutateAsync({ id: editingCategory.id, name, description });
    } else {
      await createCategory.mutateAsync({ name, description });
    }
    resetForm();
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setShowAddForm(true);
    setShowBulkUpload(false);
  };

  const handleDelete = async () => {
    if (deleteCategory) {
      await deleteCategoryMutation.mutateAsync(deleteCategory.id);
      setDeleteCategory(null);
    }
  };

  const handleBulkUpload = async () => {
    const lines = bulkText.split('\n').filter(line => line.trim());
    const categoriesToCreate = lines.map(line => {
      const [name, description] = line.split(',').map(s => s.trim());
      return { name, description: description || null };
    }).filter(c => c.name);
    
    if (categoriesToCreate.length > 0) {
      await bulkCreateCategories.mutateAsync(categoriesToCreate);
      setBulkText('');
      setShowBulkUpload(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <FolderTree className="w-3.5 h-3.5" />
            Categories
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FolderTree className="w-4 h-4" />
              Manage Categories
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-2 mb-3">
            <Button 
              size="sm" 
              className="h-7 gap-1" 
              onClick={() => { setShowAddForm(true); setShowBulkUpload(false); resetForm(); }}
            >
              <Plus className="w-3 h-3" /> Add Category
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 gap-1"
              onClick={() => { setShowBulkUpload(true); setShowAddForm(false); resetForm(); }}
            >
              <Upload className="w-3 h-3" /> Bulk Upload
            </Button>
          </div>

          {showAddForm && (
            <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-accent/30 rounded-md mb-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{editingCategory ? 'Edit Category' : 'Add Category'}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name *</Label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="h-8 text-sm" 
                    placeholder="Category name"
                    required 
                  />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    className="h-8 text-sm" 
                    placeholder="Optional description"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" className="h-7" disabled={createCategory.isPending || updateCategory.isPending}>
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </form>
          )}

          {showBulkUpload && (
            <div className="space-y-3 p-3 bg-accent/30 rounded-md mb-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Bulk Upload Categories</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowBulkUpload(false)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <Textarea 
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Enter categories (one per line)&#10;Format: Name, Description&#10;Example:&#10;Electronics, Electronic items&#10;Groceries, Food and beverages"
                className="min-h-[120px] text-sm"
              />
              <Button size="sm" className="h-7" onClick={handleBulkUpload} disabled={bulkCreateCategories.isPending}>
                Upload Categories
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-auto border rounded-md">
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : categories?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No categories. Add your first category above.</TableCell>
                  </TableRow>
                ) : (
                  categories?.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-muted-foreground">{category.description || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(category)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteCategory(category)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteCategory?.name}"? Items in this category will become uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
