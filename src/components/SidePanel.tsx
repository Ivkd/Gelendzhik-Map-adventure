import React, { useEffect, useState, useRef } from 'react'
import {
  addPhotoToMarker,
  getPhotosForMarker,
  syncPhotosForMarker,
  deletePhoto,
  deleteMarker,
  MarkerPhoto,
  MarkerRecord
} from '../db'
import { compressImage } from '../imageUtils'

interface Props {
  marker: MarkerRecord | null
  onClose: () => void
  onDeleted: () => void
}

export default function SidePanel({ marker, onClose, onDeleted }: Props) {
  const [photos, setPhotos] = useState<MarkerPhoto[]>([])
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!marker) {
      setPhotos([])
      return
    }
    syncPhotosForMarker(marker.id).then(setPhotos)
  }, [marker])

  useEffect(() => {
    const urls: Record<string, string> = {}
    photos.forEach((p) => {
      urls[p.id] = URL.createObjectURL(p.blob)
    })
    setObjectUrls(urls)
    return () => {
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u))
    }
  }, [photos])

  if (!marker) return null

  const handleAddFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      const compressed = await compressImage(file, 1600, 0.8)
      // создаём новый File, чтобы сохранить имя
      const compressedFile = new File([compressed], file.name, {
        type: 'image/jpeg',
      })
      await addPhotoToMarker(marker.id, compressedFile)
    }

    const updated = await getPhotosForMarker(marker.id)
    setPhotos(updated)
    e.target.value = ''
  }

  const handleDeletePhoto = async (photoId: string) => {
    await deletePhoto(photoId)
    const updated = await getPhotosForMarker(marker.id)
    setPhotos(updated)
  }

  const handleDeleteMarker = async () => {
    const confirmed = window.confirm(`Удалить метку "${marker.title}" со всеми фотографиями?`)
    if (!confirmed) return
    setDeleting(true)
    await deleteMarker(marker.id)
    setDeleting(false)
    onDeleted()
  }

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <h2>{marker.title}</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      {marker.description && (
        <p className="side-panel-desc">{marker.description}</p>
      )}

      <div className="photo-grid">
        {photos.length === 0 && (
          <p className="no-photos">Пока нет фотографий</p>
        )}
        {photos.map((p) => (
          <div key={p.id} className="photo-item">
            <img src={objectUrls[p.id]} alt={p.name} />
            <button className="delete-photo-btn" onClick={() => handleDeletePhoto(p.id)}>
              Удалить
            </button>
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleAddFile}
      />
      <button
        className="add-file-btn"
        onClick={() => fileInputRef.current?.click()}
      >
        + Добавить файл из галереи
      </button>

      <button
        className="delete-marker-btn"
        onClick={handleDeleteMarker}
        disabled={deleting}
      >
        {deleting ? 'Удаление...' : 'Удалить метку'}
      </button>
    </div>
  )
}

