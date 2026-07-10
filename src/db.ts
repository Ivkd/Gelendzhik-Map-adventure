import { openDB, IDBPDatabase } from 'idb'
import { supabase, STORAGE_BUCKET } from './supabaseClient'

export interface MarkerRecord {
  id: string
  lat: number
  lng: number
  title: string
  description?: string
  createdAt: number
  pendingSync?: boolean
}

export interface MarkerPhoto {
  id: string
  markerId: string
  blob: Blob
  name: string
  storagePath?: string
  pendingUpload?: boolean
}

const DB_NAME = 'gelendzhik-map-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('markers')) {
          db.createObjectStore('markers', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('photos')) {
          const store = db.createObjectStore('photos', { keyPath: 'id' })
          store.createIndex('markerId', 'markerId')
        }
      },
    })
  }
  return dbPromise
}

function generateId(): string {
  return crypto.randomUUID()
}

function isOnline(): boolean {
  return navigator.onLine
}

// ---------- МЕТКИ ----------

export async function createMarker(data: {
  lat: number
  lng: number
  title: string
  description?: string
}): Promise<MarkerRecord> {
  const marker: MarkerRecord = {
    id: generateId(),
    lat: data.lat,
    lng: data.lng,
    title: data.title,
    description: data.description,
    createdAt: Date.now(),
    pendingSync: !isOnline(),
  }

  const db = await getDb()
  await db.put('markers', marker)

  if (isOnline()) {
    const { error } = await supabase.from('markers').insert({
      id: marker.id,
      lat: marker.lat,
      lng: marker.lng,
      title: marker.title,
      description: marker.description ?? null,
    })
    if (error) {
      marker.pendingSync = true
      await db.put('markers', marker)
    }
  }

  return marker
}

export async function getAllMarkers(): Promise<MarkerRecord[]> {
  const db = await getDb()
  return db.getAll('markers')
}

export async function deleteMarker(id: string): Promise<void> {
  const db = await getDb()

  const photos = await getPhotosForMarker(id)
  for (const photo of photos) {
    await deletePhoto(photo.id)
  }

  await db.delete('markers', id)

  if (isOnline()) {
    await supabase.from('markers').delete().eq('id', id)
  }
}

// Подтягивает метки из Supabase и обновляет локальный кэш (вызывать при старте и при восстановлении сети)
export async function syncMarkersFromServer(): Promise<MarkerRecord[]> {
  if (!isOnline()) {
    return getAllMarkers()
  }

  const { data, error } = await supabase.from('markers').select('*')
  if (error || !data) {
    return getAllMarkers()
  }

  const db = await getDb()
  for (const row of data) {
    const existing = await db.get('markers', row.id)
    if (!existing || !existing.pendingSync) {
      await db.put('markers', {
        id: row.id,
        lat: row.lat,
        lng: row.lng,
        title: row.title,
        description: row.description ?? undefined,
        createdAt: new Date(row.created_at).getTime(),
        pendingSync: false,
      })
    }
  }

  return getAllMarkers()
}

// Досылает на сервер метки, созданные offline (вызывать при восстановлении сети)
export async function pushPendingMarkers(): Promise<void> {
  if (!isOnline()) return

  const db = await getDb()
  const all: MarkerRecord[] = await db.getAll('markers')
  const pending = all.filter((m) => m.pendingSync)

  for (const marker of pending) {
    const { error } = await supabase.from('markers').insert({
      id: marker.id,
      lat: marker.lat,
      lng: marker.lng,
      title: marker.title,
      description: marker.description ?? null,
    })
    if (!error) {
      marker.pendingSync = false
      await db.put('markers', marker)
    }
  }

  const photoDb = await getDb()
  const allPhotos: MarkerPhoto[] = await photoDb.getAll('photos')
  const pendingPhotos = allPhotos.filter((p) => p.pendingUpload)

  for (const photo of pendingPhotos) {
    await uploadPhotoToServer(photo)
  }
}

// ---------- ФОТОГРАФИИ ----------

async function uploadPhotoToServer(photo: MarkerPhoto): Promise<void> {
  const path = `${photo.markerId}/${photo.id}.jpg`

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, photo.blob, { contentType: 'image/jpeg', upsert: true })

  if (uploadError) {
    console.error('Ошибка загрузки фото в Storage:', uploadError)
    return
  }

  const { error: dbError } = await supabase.from('marker_photos').insert({
    id: photo.id,
    marker_id: photo.markerId,
    storage_path: path,
  })

  if (dbError) {
    console.error('Ошибка записи в marker_photos:', dbError)
    await supabase.storage.from(STORAGE_BUCKET).remove([path])
    return
  }

  const db = await getDb()
  photo.pendingUpload = false
  photo.storagePath = path
  await db.put('photos', photo)
}

export async function getPhotosForMarker(markerId: string): Promise<MarkerPhoto[]> {
  const db = await getDb()
  const all: MarkerPhoto[] = await db.getAllFromIndex('photos', 'markerId', markerId)
  return all
}

export async function deletePhoto(photoId: string): Promise<void> {
  const db = await getDb()
  const photo: MarkerPhoto | undefined = await db.get('photos', photoId)

  if (photo?.storagePath && isOnline()) {
    await supabase.storage.from(STORAGE_BUCKET).remove([photo.storagePath])
    await supabase.from('marker_photos').delete().eq('id', photoId)
  }

  await db.delete('photos', photoId)
}

// Подтягивает фото конкретной метки с сервера (для второго устройства)
export async function syncPhotosForMarker(markerId: string): Promise<MarkerPhoto[]> {
  if (!isOnline()) {
    return getPhotosForMarker(markerId)
  }

  const { data, error } = await supabase
    .from('marker_photos')
    .select('*')
    .eq('marker_id', markerId)

  if (error || !data) {
    return getPhotosForMarker(markerId)
  }

  const db = await getDb()
  const existing = await getPhotosForMarker(markerId)
  const existingIds = new Set(existing.map((p) => p.id))

  for (const row of data) {
    if (!existingIds.has(row.id)) {
      const { data: fileData } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(row.storage_path)

      if (fileData) {
        await db.put('photos', {
          id: row.id,
          markerId: row.marker_id,
          blob: fileData,
          name: row.storage_path.split('/').pop() ?? 'photo.jpg',
          storagePath: row.storage_path,
          pendingUpload: false,
        })
      }
    }
  }

  return getPhotosForMarker(markerId)
}

export async function addPhotoToMarker(markerId: string, file: File): Promise<MarkerPhoto> {
  const photo: MarkerPhoto = {
    id: generateId(),
    markerId,
    blob: file,
    name: file.name,
    pendingUpload: !isOnline(),
  }

  const db = await getDb()
  await db.put('photos', photo)

  if (isOnline()) {
    await uploadPhotoToServer(photo)
  }

  return photo
}