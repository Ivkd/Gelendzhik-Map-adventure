import React, { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import markerIconPng from 'leaflet/dist/images/marker-icon.png'
import markerIconRetinaPng from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowPng from 'leaflet/dist/images/marker-shadow.png'
import { MarkerRecord, getAllMarkers, syncMarkersFromServer, pushPendingMarkers } from './db'
import SidePanel from './components/SidePanel'
import AddMarkerModal from './components/AddMarkerModal'

const markerIcon = new L.Icon({
  iconUrl: markerIconPng,
  iconRetinaUrl: markerIconRetinaPng,
  shadowUrl: markerShadowPng,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

const GELENDZHIK_CENTER: [number, number] = [44.5622, 38.0759]

// Обрабатывает клики по карте: снимает выделение метки либо,
// если активирован режим добавления, открывает модалку создания новой метки
function ClickHandler({
  onSelect,
  addMode,
  onMapClickForNewMarker,
}: {
  onSelect: (id: string | null) => void
  addMode: boolean
  onMapClickForNewMarker: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      if (addMode) {
        onMapClickForNewMarker(e.latlng.lat, e.latlng.lng)
      } else {
        onSelect(null)
      }
    },
  })
  return null
}

export default function App() {
  const [markers, setMarkers] = useState<MarkerRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [addMode, setAddMode] = useState(false)
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null)

  const reloadMarkers = useCallback(async () => {
    const local = await getAllMarkers()
    setMarkers(local)
  }, [])

  useEffect(() => {
    syncMarkersFromServer().then(setMarkers)

    const on = async () => {
      setIsOnline(true)
      await pushPendingMarkers()
      const updated = await syncMarkersFromServer()
      setMarkers(updated)
    }
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [reloadMarkers])

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const handleMapClickForNewMarker = useCallback((lat: number, lng: number) => {
    setPendingCoords({ lat, lng })
    setAddMode(false)
  }, [])

  const handleMarkerCreated = useCallback(async () => {
    setPendingCoords(null)
    await reloadMarkers()
  }, [reloadMarkers])

  const selectedMarker = markers.find((m) => m.id === selectedId) || null

  return (
    <div className="app-root">
      <div className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
        {isOnline ? 'Онлайн' : 'Офлайн-режим'}
      </div>

      <button
        className={`add-marker-toggle-btn ${addMode ? 'active' : ''}`}
        onClick={() => setAddMode((prev) => !prev)}
      >
        {addMode ? 'Кликните на карту...' : '+ Добавить метку'}
      </button>

      <MapContainer
        center={GELENDZHIK_CENTER}
        zoom={13}
        zoomControl={false}
        className="map-container"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <ClickHandler
          onSelect={setSelectedId}
          addMode={addMode}
          onMapClickForNewMarker={handleMapClickForNewMarker}
        />
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={markerIcon}
            eventHandlers={{
              click: () => handleMarkerClick(m.id),
            }}
          />
        ))}
      </MapContainer>

      <SidePanel
        marker={selectedMarker}
        onClose={() => setSelectedId(null)}
        onDeleted={async () => {
          setSelectedId(null)
          await reloadMarkers()
        }}
      />

      {pendingCoords && (
        <AddMarkerModal
          lat={pendingCoords.lat}
          lng={pendingCoords.lng}
          onCreated={handleMarkerCreated}
          onCancel={() => setPendingCoords(null)}
        />
      )}
    </div>
  )
}
