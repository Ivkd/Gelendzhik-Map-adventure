import React, { useState, useRef } from 'react'
import { createMarker, addPhotoToMarker, MarkerRecord } from '../db'

interface Props {
  lat: number
  lng: number
  onCreated: (marker: MarkerRecord) => void
  onCancel: () => void
}

export default function AddMarkerModal({ lat, lng, onCreated, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [latValue, setLatValue] = useState(lat.toFixed(6))
  const [lngValue, setLngValue] = useState(lng.toFixed(6))
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    setFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    e.target.value = ''
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Введите название метки')
      return
    }
    const parsedLat = parseFloat(latValue)
    const parsedLng = parseFloat(lngValue)
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      alert('Координаты указаны неверно')
      return
    }

    setSaving(true)
    const marker = await createMarker({
      lat: parsedLat,
      lng: parsedLng,
      title: title.trim(),
      description: description.trim() || undefined,
    })

    for (const file of files) {
      await addPhotoToMarker(marker.id, file)
    }

    setSaving(false)
    onCreated(marker)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Новая метка</h2>

        <label className="modal-label">Название</label>
        <input
          className="modal-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например, Смотровая площадка"
        />

        <label className="modal-label">Описание</label>
        <textarea
          className="modal-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Короткое описание места"
        />

        <div className="modal-coords-row">
          <div className="modal-coord-field">
            <label className="modal-label">Широта (lat)</label>
            <input
              className="modal-input"
              type="text"
              value={latValue}
              onChange={(e) => setLatValue(e.target.value)}
            />
          </div>
          <div className="modal-coord-field">
            <label className="modal-label">Долгота (lng)</label>
            <input
              className="modal-input"
              type="text"
              value={lngValue}
              onChange={(e) => setLngValue(e.target.value)}
            />
          </div>
        </div>

        <label className="modal-label">Фотографии</label>
        <div className="modal-photo-preview-grid">
          {files.map((file, idx) => (
            <div key={idx} className="modal-photo-preview-item">
              <img src={URL.createObjectURL(file)} alt={file.name} />
              <button className="modal-remove-photo-btn" onClick={() => handleRemoveFile(idx)}>
                ×
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
          onChange={handleFilesSelected}
        />
        <button className="modal-add-photo-btn" onClick={() => fileInputRef.current?.click()}>
          + Добавить фото из галереи
        </button>

        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onCancel} disabled={saving}>
            Отмена
          </button>
          <button className="modal-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить метку'}
          </button>
        </div>
      </div>
    </div>
  )
}
