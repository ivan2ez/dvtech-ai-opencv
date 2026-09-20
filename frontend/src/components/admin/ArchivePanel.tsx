import { useCallback, useEffect, useState } from 'react';
import { RefreshCwIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

/** A column descriptor for the archive table. */
export interface ArchiveColumn<T> {
  header: string;
  /** Cell renderer for a row. */
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface ArchivePanelProps<T extends { id: number }> {
  /** Human label for the record kind, e.g. "product" (lowercase, singular). */
  itemLabel: string;
  /** Loads the archived rows. */
  fetchArchived: () => Promise<T[]>;
  /** Restores a row from the archive. */
  onRestore: (id: number) => Promise<void>;
  /** Permanently deletes a row from the archive. */
  onPermanentDelete: (id: number) => Promise<void>;
  /** Columns to display (id/archived actions are added automatically). */
  columns: ArchiveColumn<T>[];
  /**
   * A stable signal that, when changed by the parent, forces a refetch — e.g.
   * bump it after archiving a row elsewhere so the bin stays in sync.
   */
  refreshKey?: number;
}

/**
 * Shared admin "Recycle Bin" view: lists archived rows and offers Restore and
 * Permanent Delete (with confirmation) for each. Used across the admin manage
 * pages so the archive behavior and styling stay identical everywhere.
 */
export function ArchivePanel<T extends { id: number }>({
  itemLabel,
  fetchArchived,
  onRestore,
  onPermanentDelete,
  columns,
  refreshKey,
}: ArchivePanelProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<T | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await fetchArchived());
    } catch (err) {
      console.error(`Failed to load archived ${itemLabel}s:`, err);
      setError(`Failed to load the archive. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  }, [fetchArchived, itemLabel]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function handleRestore(item: T) {
    setIsMutating(true);
    try {
      await onRestore(item.id);
      await load();
      toast.success(`${capitalize(itemLabel)} restored.`);
    } catch (err) {
      console.error(`Failed to restore ${itemLabel}:`, err);
      toast.error(`Failed to restore the ${itemLabel}.`);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleConfirmPurge() {
    if (!purgeTarget) return;
    setIsMutating(true);
    try {
      await onPermanentDelete(purgeTarget.id);
      setPurgeTarget(null);
      await load();
      toast.success(`${capitalize(itemLabel)} permanently deleted.`);
    } catch (err) {
      console.error(`Failed to permanently delete ${itemLabel}:`, err);
      toast.error(`Failed to permanently delete the ${itemLabel}.`);
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Archived {itemLabel}s can be restored or permanently deleted.
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
          <RefreshCwIcon className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-center py-8 space-y-3">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading && !error && (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="text-center py-10">
          <p className="text-muted-foreground">The archive is empty.</p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((col) => (
                  <th key={col.header} className={`px-3 py-2 text-left font-medium ${col.className ?? ''}`}>
                    {col.header}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  {columns.map((col) => (
                    <td key={col.header} className={`px-3 py-2 ${col.className ?? ''}`}>
                      {col.render(item)}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => void handleRestore(item)}
                      >
                        <RotateCcwIcon className="h-4 w-4 mr-1" />
                        Restore
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => setPurgeTarget(item)}
                        aria-label={`Permanently delete ${itemLabel} #${item.id}`}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Permanent delete confirmation */}
      <Dialog open={purgeTarget !== null} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Permanently Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete this {itemLabel}? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeTarget(null)} disabled={isMutating}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmPurge()} disabled={isMutating}>
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
