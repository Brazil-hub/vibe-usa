import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress, reverseGeocode } from "../lib/geocoding";
import styles from "./LocationMapPicker.module.css";

// Pink SVG pin — no PNG files, no Vite asset issues
const PINK_PIN = L.divIcon({
  className: "",
  html: `<svg width="28" height="36" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 24 16 24S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="#ff3f8e" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="6" fill="white"/>
  </svg>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -36],
});

// Flies map to the given position (react-leaflet v4 pattern)
function MapController({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], 15, { duration: 0.8 });
    }
  }, [position, map]);
  return null;
}

// Handles clicks on the map to move the pin
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationMapPicker({ value, onChange }) {
  const [inputValue, setInputValue] = useState(value || "");
  const [position, setPosition] = useState(null);   // { lat, lng }
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const debounceRef = useRef(null);

  // Debounced forward geocode as user types
  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value;
      setInputValue(val);
      onChange(val, null, null); // propagate text immediately, clear coords

      clearTimeout(debounceRef.current);
      if (val.trim().length < 5) return;

      debounceRef.current = setTimeout(async () => {
        setIsGeocoding(true);
        const result = await geocodeAddress(val);
        setIsGeocoding(false);
        if (result) {
          const pos = { lat: result.lat, lng: result.lng };
          setPosition(pos);
          setShowMap(true);
          onChange(val, result.lat, result.lng);
        }
      }, 700);
    },
    [onChange]
  );

  // Dragging the marker → reverse geocode
  const handleMarkerDragEnd = useCallback(
    async (e) => {
      const { lat, lng } = e.target.getLatLng();
      setPosition({ lat, lng });
      setIsGeocoding(true);
      const address = await reverseGeocode(lat, lng);
      setIsGeocoding(false);
      const finalAddress = address || inputValue;
      setInputValue(finalAddress);
      onChange(finalAddress, lat, lng);
    },
    [inputValue, onChange]
  );

  // Clicking on the map → move pin + reverse geocode
  const handleMapClick = useCallback(
    async (lat, lng) => {
      setPosition({ lat, lng });
      setIsGeocoding(true);
      const address = await reverseGeocode(lat, lng);
      setIsGeocoding(false);
      const finalAddress = address || inputValue;
      setInputValue(finalAddress);
      onChange(finalAddress, lat, lng);
    },
    [inputValue, onChange]
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          placeholder="Address"
          value={inputValue}
          onChange={handleInputChange}
        />
        {isGeocoding && <span className={styles.spinner} />}
      </div>

      {showMap && (
        <div className={styles.mapWrap}>
          <MapContainer
            center={position ? [position.lat, position.lng] : [39.5, -98.35]}
            zoom={position ? 15 : 4}
            className={styles.map}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
            />
            <MapController position={position} />
            <MapClickHandler onMapClick={handleMapClick} />
            {position && (
              <Marker
                position={[position.lat, position.lng]}
                icon={PINK_PIN}
                draggable
                eventHandlers={{ dragend: handleMarkerDragEnd }}
              />
            )}
          </MapContainer>
          <p className={styles.hint}>Tap the map or drag the pin to adjust the location</p>
        </div>
      )}
    </div>
  );
}
