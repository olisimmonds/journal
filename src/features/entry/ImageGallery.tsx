import { useEffect, useMemo, useRef, useState } from 'react'
import type { ImageAttachment } from '../../db/types'
import { ImageIcon, TrashIcon } from '../../components/icons'
import { ConfirmDialog } from '../../components/ConfirmDialog'

interface ImageGalleryProps {
  images: ImageAttachment[]
  onAddImages: (files: File[]) => void
  onRemoveImage: (imageId: string) => void
}

/** Renders an entry's attached images inline and lets the user add/remove them. */
export function ImageGallery({ images, onAddImages, onRemoveImage }: ImageGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((image) => (
            <ImageThumbnail
              key={image.id}
              image={image}
              onDelete={() => setPendingDeleteId(image.id)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-ink-secondary transition-colors duration-150 hover:border-ink-tertiary hover:text-ink-primary"
      >
        <ImageIcon />
        Add photos
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length > 0) onAddImages(files)
          event.target.value = ''
        }}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Remove this photo?"
        description="This cannot be undone."
        confirmLabel="Remove"
        destructive
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) onRemoveImage(pendingDeleteId)
          setPendingDeleteId(null)
        }}
      />
    </div>
  )
}

function ImageThumbnail({ image, onDelete }: { image: ImageAttachment; onDelete: () => void }) {
  // Computed during render (not state+effect) so the URL is available on the
  // very first paint; the effect below only handles cleanup, not setState.
  const objectUrl = useMemo(() => URL.createObjectURL(image.blob), [image.blob])

  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl])

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl bg-surface-2">
      <img src={objectUrl} alt="" className="size-full object-cover" loading="lazy" />
      <button
        type="button"
        onClick={onDelete}
        aria-label="Remove photo"
        className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-opacity duration-150"
      >
        <TrashIcon width={16} height={16} />
      </button>
    </div>
  )
}
