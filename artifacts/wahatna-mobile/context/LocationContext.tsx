import * as Location from "expo-location";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const BG_LOCATION_TASK = "wahatna-bg-location";

interface GeoPoint { lat: number; lon: number; accuracy?: number }

interface LocationContextValue {
  lastLocation: GeoPoint | null;
  isTracking: boolean;
  hasPermission: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

const locationListeners: Array<(loc: GeoPoint) => void> = [];

if (Platform.OS !== "web") {
  try {
    const TaskManager = require("expo-task-manager");
    TaskManager.defineTask(BG_LOCATION_TASK, ({ data, error }: { data: { locations: Location.LocationObject[] }; error: unknown }) => {
      if (error || !data) return;
      const locations = data.locations;
      if (locations?.length) {
        const { latitude: lat, longitude: lon, accuracy } = locations[0].coords;
        locationListeners.forEach(fn => fn({ lat, lon, accuracy: accuracy ?? undefined }));
      }
    });
  } catch {}
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [lastLocation, setLastLocation] = useState<GeoPoint | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const handler = (loc: GeoPoint) => setLastLocation(loc);
    locationListeners.push(handler);
    return () => {
      const idx = locationListeners.indexOf(handler);
      if (idx >= 0) locationListeners.splice(idx, 1);
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") return false;
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== "granted") { setHasPermission(false); return false; }
    setHasPermission(true);
    return true;
  }, []);

  const startTracking = useCallback(async () => {
    if (Platform.OS === "web") return;
    const ok = hasPermission || await requestPermission();
    if (!ok) return;
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLastLocation({ lat: current.coords.latitude, lon: current.coords.longitude });
    } catch {}

    try {
      const { status: bg } = await Location.requestBackgroundPermissionsAsync();
      if (bg === "granted") {
        const TaskManager = require("expo-task-manager");
        const running = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
        if (!running) {
          await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000,
            distanceInterval: 100,
            showsBackgroundLocationIndicator: true,
          });
        }
      } else {
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 60000, distanceInterval: 100 },
          loc => setLastLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude })
        );
      }
    } catch {}
    setIsTracking(true);
  }, [hasPermission, requestPermission]);

  const stopTracking = useCallback(async () => {
    if (Platform.OS === "web") return;
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
      if (running) await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
    } catch {}
    if (watchRef.current) { watchRef.current.remove(); watchRef.current = null; }
    setIsTracking(false);
  }, []);

  return (
    <LocationContext.Provider value={{ lastLocation, isTracking, hasPermission, startTracking, stopTracking, requestPermission }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be inside LocationProvider");
  return ctx;
}
