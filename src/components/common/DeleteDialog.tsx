import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, Trash2, Lock } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onDelete: () => Promise<void>;
  onPermanentDelete: () => Promise<void>;
}

export function DeleteDialog({ open, onOpenChange, itemName, onDelete, onPermanentDelete }: DeleteDialogProps) {
  const [mode, setMode] = useState<'choose' | 'delete' | 'permanent'>('choose');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: settings } = useSettings();

  const handleClose = () => {
    setMode('choose');
    setPassword('');
    onOpenChange(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete();
      handleClose();
    } catch {
      // error handled by mutation
    }
    setLoading(false);
  };

  const handlePermanentDelete = async () => {
    const deletePassword = (settings as any)?.delete_password;
    if (!deletePassword) {
      toast.error('Set a delete password in Settings first');
      return;
    }
    if (password !== deletePassword) {
      toast.error('Incorrect delete password');
      return;
    }
    setLoading(true);
    try {
      await onPermanentDelete();
      handleClose();
    } catch {
      // error handled by mutation
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'permanent' ? (
              <><AlertTriangle className="w-5 h-5 text-destructive" /> Permanent Delete</>
            ) : (
              <><Trash2 className="w-5 h-5" /> Delete "{itemName}"</>
            )}
          </DialogTitle>
        </DialogHeader>

        {mode === 'choose' && (
          <div className="space-y-3">
            <DialogDescription>Choose delete type:</DialogDescription>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 h-auto py-3" 
              onClick={() => setMode('delete')}
            >
              <Trash2 className="w-4 h-4" />
              <div className="text-left">
                <div className="font-medium">Delete</div>
                <div className="text-xs text-muted-foreground">Restore stock and remove record</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 h-auto py-3 border-destructive/50 text-destructive hover:bg-destructive/10" 
              onClick={() => setMode('permanent')}
            >
              <AlertTriangle className="w-4 h-4" />
              <div className="text-left">
                <div className="font-medium">Permanent Delete</div>
                <div className="text-xs">Requires delete password from Settings</div>
              </div>
            </Button>
          </div>
        )}

        {mode === 'delete' && (
          <div className="space-y-3">
            <DialogDescription>
              Are you sure you want to delete "{itemName}"? Stock will be restored to respective batches.
            </DialogDescription>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
                {loading ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === 'permanent' && (
          <div className="space-y-3">
            <DialogDescription>
              This will permanently delete "{itemName}" and all associated data. Enter your delete password:
            </DialogDescription>
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Delete password"
                className="pl-8 h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handlePermanentDelete()}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setMode('choose')}>Back</Button>
              <Button variant="destructive" size="sm" onClick={handlePermanentDelete} disabled={loading || !password}>
                {loading ? 'Deleting...' : 'Permanently Delete'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
