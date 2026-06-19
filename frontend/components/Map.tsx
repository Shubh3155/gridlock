'use client';

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZoneFeatureCollection, ViolationPoint, ZoneFeature } from "../lib/types";

// Fix default leaflet icon issues (Marker shadow errors)
// Note: Since we are using custom styled polygons and heatmaps, markers are secondary,
// but fixing it ensures no console warnings are generated.
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

interface MapProps {
  zones: ZoneFeatureCollection | null;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  activeLayer: "historical" | "predicted";
  historicalPoints: ViolationPoint[];
  predictedPoints: ZoneFeature[];
}

export default function Map({
  zones,
  selectedZoneId,
  onSelectZone,
  activeLayer,
  historicalPoints,
  predictedPoints,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);

  // 1. Initialize Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    // Dynamically load leaflet.heat on client side
    require("leaflet.heat");

    // Initialize map centering Bengaluru
    const map = L.map(mapContainerRef.current, {
      center: [12.9716, 77.5946],
      zoom: 13,
      minZoom: 10,
      maxZoom: 17,
      zoomControl: false,
    });

    // Custom dark themed map tiles (CartoDB Dark Matter)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    // Standard zoom control positioned at top right
    L.control.zoom({ position: "topright" }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Center map on active zones if available
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zones || zones.features.length === 0) return;

    try {
      // Create temporary GeoJSON to calculate bounds
      const tempLayer = L.geoJSON(zones as any);
      const bounds = tempLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    } catch (e) {
      console.error("Error setting map bounds:", e);
    }
  }, [zones]);

  // 3. Render Heatmap Layer (Historical or Predicted)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing heatmap layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    let latLngWeightPoints: [number, number, number][] = [];

    if (activeLayer === "historical") {
      latLngWeightPoints = historicalPoints.map((pt) => [
        pt.latitude,
        pt.longitude,
        pt.violation_weight || 0.5,
      ]);
    } else if (activeLayer === "predicted") {
      latLngWeightPoints = predictedPoints.map((pt) => {
        const coords = pt.geometry.coordinates[0]; // Polygon outer boundary
        // Calculate center for heat point representation
        const lat = pt.properties.center?.lat || 12.9716;
        const lng = pt.properties.center?.lng || 77.5946;
        const score = pt.properties.priority_score || 5.0;
        return [lat, lng, score / 10.0];
      });
    }

    if (latLngWeightPoints.length > 0 && (L as any).heatLayer) {
      // Configure heat options based on active layers
      const heatOptions = {
        radius: activeLayer === "historical" ? 25 : 45,
        blur: activeLayer === "historical" ? 15 : 30,
        maxZoom: 15,
        max: 1.0,
        gradient:
          activeLayer === "historical"
            ? { 0.4: "#00dbe9", 0.65: "#feb700", 1.0: "#ffb4ab" } // Cyan -> Amber -> Red
            : { 0.4: "#2e3540", 0.7: "#feb700", 1.0: "#ffb4ab" }, // Dark -> Amber -> Red
      };

      const heat = (L as any).heatLayer(latLngWeightPoints, heatOptions);
      heat.addTo(map);
      heatLayerRef.current = heat;
    }
  }, [activeLayer, historicalPoints, predictedPoints]);

  // 4. Draw Zones GeoJSON Polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
      geojsonLayerRef.current = null;
    }

    if (!zones) return;

    const geojson = L.geoJSON(zones as any, {
      style: (feature: any) => {
        const score = feature.properties.priority_score || 0;
        const isSelected = selectedZoneId === feature.properties.zone_id;

        // Base color matching priority score
        let color = "#8fdb00"; // Low (Lime)
        if (score >= 7.0) color = "#ffb4ab"; // High (Red)
        else if (score >= 4.0) color = "#feb700"; // Med (Amber)

        return {
          fillColor: color,
          fillOpacity: isSelected ? 0.45 : 0.25,
          color: isSelected ? "#00f0ff" : color, // Cyan border for selected
          weight: isSelected ? 2.5 : 1.5,
          className: "transition-all duration-300",
        };
      },
      onEachFeature: (feature: any, layer: L.Layer) => {
        layer.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectZone(feature.properties.zone_id);

          // Smoothly pan map to polygon center
          const center = feature.properties.center;
          if (center && center.lat && center.lng) {
            map.panTo([center.lat, center.lng]);
          }
        });
      },
    });

    geojson.addTo(map);
    geojsonLayerRef.current = geojson;
  }, [zones, selectedZoneId, onSelectZone]);

  // 5. Pan to selected zone when selection changes externally
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zones || !selectedZoneId) return;

    const targetZone = zones.features.find(
      (f) => f.properties.zone_id === selectedZoneId
    );

    if (targetZone && targetZone.properties.center) {
      const { lat, lng } = targetZone.properties.center;
      map.setView([lat, lng], 14, { animate: true });
    }
  }, [selectedZoneId, zones]);

  return (
    <div className="w-full h-full relative border-r border-outline-variant bg-surface-container-lowest">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      {/* Background Dot overlay simulation for Hacker-Noir */}
      <div className="absolute inset-0 pointer-events-none opacity-10 z-10" style={{ backgroundImage: "radial-gradient(circle, #00dbe9 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
      <div className="scanline z-20 pointer-events-none"></div>
    </div>
  );
}
