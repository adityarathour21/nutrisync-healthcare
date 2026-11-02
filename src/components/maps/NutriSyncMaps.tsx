import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation } from 'lucide-react';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || '';

export interface SelectedAddressResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  postalCode?: string;
}

function PlacesAutocompleteInner({
  onSelect,
}: {
  onSelect: (res: SelectedAddressResult) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!placesLib || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let active = true;
    setLoading(true);

    AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: query,
      sessionToken: sessionTokenRef.current,
    })
      .then((res) => {
        if (active) {
          setSuggestions(res.suggestions || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Autocomplete error:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [placesLib, query]);

  const handleChoose = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
        });

        const lat = place.location?.lat() ?? 12.9716;
        const lng = place.location?.lng() ?? 77.5946;
        const postalComp = place.addressComponents?.find((c) => c.types.includes('postal_code'));

        onSelect({
          formattedAddress:
            place.formattedAddress || suggestion.placePrediction.text?.text || query,
          lat,
          lng,
          postalCode: postalComp?.longText || undefined,
        });

        setQuery('');
        setSuggestions([]);
        sessionTokenRef.current = null;
      } catch (err) {
        console.error('Place fetchFields error:', err);
      }
    },
    [onSelect, query]
  );

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search street or landmark via Google Places..."
          className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
        />
      </div>
      {loading && (
        <p className="mt-1 text-xs text-slate-500">Searching Google Places...</p>
      )}
      {suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
          {suggestions.map((sug, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => void handleChoose(sug)}
                className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-slate-900 transition-colors"
              >
                {sug.placePrediction?.text?.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const PlacesAddressAutocomplete: React.FC<{
  onSelect: (res: SelectedAddressResult) => void;
}> = ({ onSelect }) => {
  if (!MAPS_API_KEY) {
    return (
      <p className="text-xs text-slate-500">
        Google Maps API key not configured — enter your street address manually below.
      </p>
    );
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY} language="en" region="IN">
      <PlacesAutocompleteInner onSelect={onSelect} />
    </APIProvider>
  );
};

function RoutePolylineOverlay({
  origin,
  destination,
  onSummary,
}: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  onSummary: (summary: { distanceKm: string; durationMins: number } | null, err: string | null) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map || !routesLib) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const request = {
      origin,
      destination,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    (routesLib.Route as unknown as {
      computeRoutes: (req: unknown) => Promise<{
        routes?: {
          distanceMeters?: number;
          durationMillis?: number;
          viewport?: google.maps.LatLngBounds;
          createPolylines: () => google.maps.Polyline[];
        }[];
      }>;
    })
      .computeRoutes(request)
      .then(({ routes }) => {
        if (!routes || routes.length === 0) {
          onSummary(null, 'No driving route available for these coordinates.');
          return;
        }
        const primary = routes[0];
        const lines = primary.createPolylines();
        lines.forEach((line) => {
          line.setOptions({
            strokeColor: '#059669',
            strokeWeight: 5,
          });
          line.setMap(map);
        });
        polylinesRef.current = lines;

        if (primary.viewport) {
          map.fitBounds(primary.viewport);
        }

        onSummary(
          {
            distanceKm: ((primary.distanceMeters ?? 0) / 1000).toFixed(1),
            durationMins: Math.max(1, Math.round((primary.durationMillis ?? 0) / 60000)),
          },
          null
        );
      })
      .catch((err: unknown) => {
        console.error('Routes API computeRoutes error:', err);
        onSummary(
          null,
          'Unable to load route data. Please check your network or Google Maps Routes API configuration.'
        );
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, origin, destination, onSummary]);

  return null;
}

export const DeliveryRouteMap: React.FC<{
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
}> = ({ pickup, dropoff }) => {
  const [summary, setSummary] = useState<{ distanceKm: string; durationMins: number } | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const handleSummary = useCallback(
    (s: { distanceKm: string; durationMins: number } | null, err: string | null) => {
      setSummary(s);
      setRouteError(err);
    },
    []
  );

  if (!MAPS_API_KEY) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Google Maps Navigation Unconfigured</p>
        <p className="mt-1 text-xs">
          Set <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to render live interactive dispatch routes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-emerald-600" />
          <span className="font-medium text-slate-900">{pickup.label}</span>
          <span aria-hidden="true">→</span>
          <span className="font-medium text-slate-900">{dropoff.label}</span>
        </div>
        {summary && (
          <div className="font-mono tabular-nums text-slate-700">
            <span>{summary.distanceKm} km</span>
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span>~{summary.durationMins} min drive</span>
          </div>
        )}
      </div>

      {routeError && (
        <p className="text-xs text-amber-700">{routeError}</p>
      )}

      <div className="w-full h-[380px] rounded-xl overflow-hidden border border-slate-200">
        <APIProvider apiKey={MAPS_API_KEY} language="en" region="IN">
          <Map
            defaultCenter={pickup}
            defaultZoom={13}
            mapId="DEMO_MAP_ID"
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <AdvancedMarker position={pickup} title={pickup.label}>
              <Pin background="#0f172a" glyphColor="#ffffff" borderColor="#0f172a" />
            </AdvancedMarker>
            <AdvancedMarker position={dropoff} title={dropoff.label}>
              <Pin background="#059669" glyphColor="#ffffff" borderColor="#047857" />
            </AdvancedMarker>
            <RoutePolylineOverlay
              origin={{ lat: pickup.lat, lng: pickup.lng }}
              destination={{ lat: dropoff.lat, lng: dropoff.lng }}
              onSummary={handleSummary}
            />
          </Map>
        </APIProvider>
      </div>
    </div>
  );
};
