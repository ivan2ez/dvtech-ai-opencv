import { useCallback, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusIcon, PencilIcon, TrashIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import type { BtuFactor } from '@/types';
import {
  getBtuFactors,
  createBtuFactor,
  updateBtuFactor,
  deleteBtuFactor,
} from '@/services/btuFactorApi';

const btuFactorSchema = z.object({
  factorName: z.string().min(1, 'Factor name is required').max(100),
  factorValue: z.coerce.number().min(0.01).max(100),
  description: z.string().max(500).optional(),
});

type BtuFactorFormValues = z.infer<typeof btuFactorSchema>;

export function ManageBtuFactors() {
  const [factors, setFactors] = useState<BtuFactor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFactor, setEditingFactor] = useState<BtuFactor | null>(null);

  const form = useForm<BtuFactorFormValues>({
    resolver: zodResolver(btuFactorSchema) as unknown as Resolver<BtuFactorFormValues>,
    defaultValues: {
      factorName: '',
      factorValue: 1,
      description: '',
    },
  });

  const fetchFactors = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getBtuFactors();
      setFactors(data);
    } catch (error) {
      console.error('Failed to fetch BTU factors:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFactors();
  }, [fetchFactors]);

  function handleOpenCreate() {
    setEditingFactor(null);
    form.reset({
      factorName: '',
      factorValue: 1,
      description: '',
    });
    setDialogOpen(true);
  }

  function handleOpenEdit(factor: BtuFactor) {
    setEditingFactor(factor);
    form.reset({
      factorName: factor.factorName,
      factorValue: factor.factorValue,
      description: factor.description ?? '',
    });
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Are you sure you want to delete this BTU factor?')) return;
    try {
      await deleteBtuFactor(id);
      await fetchFactors();
    } catch (error) {
      console.error('Failed to delete BTU factor:', error);
    }
  }

  async function onSubmit(values: BtuFactorFormValues) {
    try {
      if (editingFactor) {
        await updateBtuFactor(editingFactor.id, values);
      } else {
        await createBtuFactor(values);
      }
      setDialogOpen(false);
      await fetchFactors();
    } catch (error) {
      console.error('Failed to save BTU factor:', error);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manage BTU Factors</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={handleOpenCreate} />}>
            <PlusIcon data-icon="inline-start" />
            Add BTU Factor
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingFactor ? 'Edit BTU Factor' : 'Add New BTU Factor'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="factorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Factor Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Sun Exposure" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="factorValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Factor Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="100"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingFactor ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading BTU factors...</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Factor Name</TableHead>
              <TableHead>Factor Value</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {factors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No BTU factors found.
                </TableCell>
              </TableRow>
            ) : (
              factors.map((factor) => (
                <TableRow key={factor.id}>
                  <TableCell className="font-medium">{factor.factorName}</TableCell>
                  <TableCell>{factor.factorValue}</TableCell>
                  <TableCell>{factor.description ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleOpenEdit(factor)}
                        aria-label={`Edit ${factor.factorName}`}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => void handleDelete(factor.id)}
                        aria-label={`Delete ${factor.factorName}`}
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
