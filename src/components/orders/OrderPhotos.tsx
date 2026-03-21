'use client'
import { useState, useEffect, useRef } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Photo {
  id: string
  filename: string
  storage_path: string
  created_at: string
}

interface Props {
  orderId: string
}

export default function OrderPhotos({ orderId }: Props) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => { loadPhotos() }, [orderId])

  async function loadPhotos() {
    const { data } = await supabase
      .from('order_photos')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at')
    if (!data) return
    setPhotos(data)

    // Fetch signed URLs
    const urls: Record<string, string> = {}
    await Promise.all(data.map(async (p: Photo) => {
      const { data: signed } = await supabase.storage
        .from('documents')
        .createSignedUrl(p.storage_path, 3600)
      if (signed) urls[p.id] = signed.signedUrl
    }))
    setPhotoUrls(urls)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('order_id', orderId)
      const res = await fetch('/api/photos/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await loadPhotos()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this photo?')) return
    const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPhotos(prev => prev.filter(p => p.id !== id))
      setPhotoUrls(prev => { const n = { ...prev }; delete n[id]; return n })
    }
  }

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={15} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Photos</h2>
          <span className="text-xs text-gray-400">({photos.length})</span>
        </div>
        <label className={`btn-secondary text-xs py-1.5 flex items-center gap-1.5 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          {uploading ? 'Uploading…' : 'Add photo'}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleUpload}
          />
        </label>
      </div>

      {error && <p className="px-5 py-2 text-xs text-red-600 bg-red-50">{error}</p>}

      {photos.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Camera size={20} className="mx-auto text-gray-300 mb-2" />
          <p className="text-xs text-gray-400">No photos yet — tap "Add photo" to take or upload one</p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {photos.map(photo => (
            <div key={photo.id} className="relative group aspect-square">
              {photoUrls[photo.id] ? (
                <img
                  src={photoUrls[photo.id]}
                  alt={photo.filename}
                  className="w-full h-full object-cover rounded-md cursor-pointer border border-gray-200 hover:border-gray-400 transition-colors"
                  onClick={() => setLightbox(photoUrls[photo.id])}
                />
              ) : (
                <div className="w-full h-full bg-gray-100 rounded-md flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              )}
              <button
                onClick={() => handleDelete(photo.id)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/40 rounded-full p-1.5 hover:bg-black/70"
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightbox}
            alt="Photo"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
