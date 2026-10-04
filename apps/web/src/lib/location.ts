import type { UserLocation } from "@ks1j/shared";

export type LocationError = "LOCATION_UNAVAILABLE" | "LOCATION_PERMISSION_DENIED" | "LOCATION_TIMEOUT" | "LOCATION_UNKNOWN_ERROR";

/** One-off device position. Used for a single search and never stored or sent anywhere. */
export function getCurrentUserLocation(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return reject(new Error("LOCATION_UNAVAILABLE" satisfies LocationError));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyMeters: p.coords.accuracy }),
      (e) => {
        const code: LocationError =
          e.code === e.PERMISSION_DENIED ? "LOCATION_PERMISSION_DENIED" : e.code === e.POSITION_UNAVAILABLE ? "LOCATION_UNAVAILABLE" : e.code === e.TIMEOUT ? "LOCATION_TIMEOUT" : "LOCATION_UNKNOWN_ERROR";
        reject(new Error(code));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
