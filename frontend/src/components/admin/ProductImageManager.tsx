import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, StarIcon, TrashIcon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import {
  getProductImages,
  uploadProductImages,
  setCoverImage,
  deleteProductImage,
  type ProductImageData,
} from '@/services/productApi';
import { validateImageFile } from '@/utils/fileValidation';

const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ProductImageManagerProps {
  productId: number;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

export function ProductImageManager({ productId, productName, open, onOpenChange }: ProductImageManagerProps) {
  const [images, setImages] = useState<ProductImageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'cover'; imageId: number } | null>(null);

  const fetchImages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProductImages(productId);
      setImages(data);
    } catch {
      setError('Failed to load images.');
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (open) {
      void fetchImages();
    }
  }, [open, fetchImages]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);

    // Validate each selected file client-side before uploading.
    const selected = Array.from(files);
    const valid: File[] = [];
    const rejected: string[] = [];
    for (const file of selected) {
      const err = validateImageFile(file, {
        maxMB: 5,
        types: PRODUCT_IMAGE_TYPES,
        typeLabel: 'JPEG, PNG, or WebP',
      });
      if (err) {
        rejected.push(file.name);
      } else {
        valid.push(file);
      }
    }

    if (rejected.length > 0) {
      const msg = `Skipped ${rejected.length} file(s) (must be JPEG, PNG, or WebP under 5MB): ${rejected.join(', ')}`;
      setError(msg);
      toast.error(msg);
    }

    if (valid.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const count = valid.length;
      await uploadProductImages(productId, valid);
      await fetchImages();
      toast.success(count === 1 ? 'Image uploaded.' : `${count} images uploaded.`);
    } catch {
      setError('Failed to upload images. Ensure files are JPEG, PNG, or WebP under 5MB.');
      toast.error('Failed to upload images. Ensure files are JPEG, PNG, or WebP under 5MB.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    const actionType = confirmAction.type;
    try {
      if (actionType === 'cover') {
        await setCoverImage(productId, confirmAction.imageId);
      } else {
        await deleteProductImage(productId, confirmAction.imageId);
      }
      setConfirmAction(null);
      await fetchImages();
      toast.success(actionType === 'cover' ? 'Cover image updated.' : 'Image deleted.');
    } catch {
      setError(actionType === 'cover' ? 'Failed to set cover image.' : 'Failed to delete image.');
      toast.error(actionType === 'cover' ? 'Failed to set cover image.' : 'Failed to delete image.');
      setConfirmAction(null);
    }
  }

  function getImageSrc(imageUrl: string): string {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${API_BASE}${imageUrl}`;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Images — {productName}</DialogTitle>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Upload Area */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => void handleUpload(e)}
              className="hidden"
              id="product-image-upload"
            />
            <div
              className="cursor-pointer flex flex-col items-center gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isUploading ? 'Uploading...' : 'Click to upload images (JPEG, PNG, WebP — max 5MB each)'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={(e) => {
                  // Prevent the parent div's handler from firing a second click.
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Select Files
              </Button>
            </div>
          </div>

          {/* Image Grid */}
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Loading images...</p>
          ) : images.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No images uploaded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={`relative group rounded-lg overflow-hidden border-2 ${
                    image.isCover ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img
                    src={getImageSrc(image.imageUrl)}
                    alt={`Product image ${image.id}`}
                    className="w-full h-32 object-cover"
                  />
                  {image.isCover && (
                    <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded font-medium">
                      Cover
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    {!image.isCover && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white text-black hover:bg-white/90 w-full max-w-[120px]"
                        onClick={() => setConfirmAction({ type: 'cover', imageId: image.id })}
                        title="Set as cover"
                      >
                        <StarIcon className="h-4 w-4 mr-1" />
                        Set Cover
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="bg-red-600 text-white hover:bg-red-700 w-full max-w-[120px]"
                      onClick={() => setConfirmAction({ type: 'delete', imageId: image.id })}
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === 'delete' ? 'Delete Image' : 'Set as Cover'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction?.type === 'delete'
              ? 'Are you sure you want to delete this image? This action cannot be undone.'
              : 'Are you sure you want to set this image as the product cover?'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.type === 'delete' ? 'destructive' : 'default'}
              onClick={() => void handleConfirmAction()}
            >
              {confirmAction?.type === 'delete' ? 'Delete' : 'Set as Cover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
