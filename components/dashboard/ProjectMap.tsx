
'use client';

import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, User, TrendingUp, Building, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Define libraries as a constant outside component to prevent unnecessary reloads
const GOOGLE_MAPS_LIBRARIES: string[] = [];

const containerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '0.5rem',
};

// Optimized map options to reduce API calls and improve performance
const mapOptions: google.maps.MapOptions = {
  zoomControl: true,
  streetViewControl: false, // Disabled to save API calls
  mapTypeControl: false, // Disabled to save API calls
  fullscreenControl: true,
  rotateControl: false, // Disabled
  scaleControl: false, // Disabled
  panControl: false, // Disabled
  gestureHandling: 'auto',
  // Disable all layers except the base map
  styles: [
    {
      featureType: 'poi', // Disable points of interest
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'transit', // Disable transit
      stylers: [{ visibility: 'off' }],
    },
  ],
  // Use light style for faster loading
  mapTypeId: 'roadmap',
  disableDefaultUI: false,
  clickableIcons: false, // Disable clicking on POI icons to save API calls
}

interface Project {
  id: string;
  projectNumber: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  progress: number;
  status: string;
  manager?: {
    firstName?: string;
    lastName?: string;
    name?: string;
  };
  customer?: {
    name: string;
  };
}

interface ProjectMapProps {
  projects?: Project[];
}

export default function ProjectMap({ projects = [] }: ProjectMapProps) {
  const [selected, setSelected] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  
  // Cache the map instance to avoid re-initialization
  const mapRef = useRef<google.maps.Map | null>(null);
  
  // Get API key from environment
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  
  // Lazy load Google Maps API only when needed
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    // Only load required libraries - use constant to prevent reloads
    libraries: GOOGLE_MAPS_LIBRARIES as any, // No additional libraries needed
  });

  // Check if API key is configured
  useEffect(() => {
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      console.error('Google Maps API key not found:', apiKey);
      setError('Google Maps API key is not configured. Please add a valid API key to your environment variables.')
    } else {
      console.log('Google Maps API key found and configured');
    }
  }, [apiKey])

  // Handle load errors
  useEffect(() => {
    if (loadError) {
      setError('Failed to load Google Maps. Please check your API key and try again.')
      console.error('Google Maps load error:', loadError)
    }
  }, [loadError])

  // Memoize filtered projects to avoid recalculation
  const projectsWithLocation = useMemo(() => {
    return projects.filter(
      (p) => p.latitude != null && p.longitude != null
    );
  }, [projects]);

  // Memoize center calculation
  const center = useMemo(() => {
    if (projectsWithLocation.length > 0) {
      return {
        lat: projectsWithLocation[0].latitude!,
        lng: projectsWithLocation[0].longitude!,
      };
    }
    return { lat: 1.3521, lng: 103.8198 }; // Default Singapore center
  }, [projectsWithLocation]);

  // Optimized marker icon function (static URLs, no API calls)
  const getMarkerIcon = useCallback((progress: number): string => {
    if (progress < 30) {
      return 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
    } else if (progress < 70) {
      return 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
    } else if (progress < 100) {
      return 'http://maps.google.com/mapfiles/ms/icons/orange-dot.png';
    } else {
      return 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
    }
  }, []);

  // Optimized status color function
  const getStatusColor = useCallback((status: string): string => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'PLANNING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'ON_HOLD':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  }, []);

  const getManagerName = useCallback((manager?: Project['manager']): string => {
    if (!manager) return 'N/A';
    return manager.firstName && manager.lastName
      ? `${manager.firstName} ${manager.lastName}`
      : manager.name || 'N/A';
  }, []);

  // Handle map load and cache instance
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapInstance(map);
    console.log('Map loaded and cached');
  }, []);

  // Handle map unmount
  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
    setMapInstance(null);
  }, []);

  // Update markers without re-initializing map
  useEffect(() => {
    if (mapInstance && projectsWithLocation.length > 0) {
      // Fit bounds to show all markers
      const bounds = new google.maps.LatLngBounds();
      projectsWithLocation.forEach((project) => {
        if (project.latitude && project.longitude) {
          bounds.extend(
            new google.maps.LatLng(project.latitude, project.longitude)
          );
        }
      });
      mapInstance.fitBounds(bounds);
    }
  }, [mapInstance, projectsWithLocation]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Ongoing Projects Map
          </CardTitle>
          <CardDescription>Visual overview of all active project sites</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[500px] bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="text-center max-w-md px-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-400 font-medium mb-2">Map Error</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
              {error.includes('API key') && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-left">
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                    Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env file
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Ongoing Projects Map
          </CardTitle>
          <CardDescription>Visual overview of all active project sites</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[500px] bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">Loading map...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Ongoing Projects Map
        </CardTitle>
        <CardDescription>
          {projectsWithLocation.length > 0 
            ? `Visual overview of ${projectsWithLocation.length} active project sites with coordinates`
            : 'No projects with location coordinates yet'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {projectsWithLocation.length === 0 ? (
          <div className="flex items-center justify-center h-[500px] bg-gray-100 dark:bg-gray-800 rounded-lg">
            <div className="text-center max-w-lg px-6">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-medium text-lg mb-2">
                No Projects with Location Coordinates
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Projects need geocoded addresses to appear on the map. Add or edit projects with complete addresses to enable map display.
              </p>
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-left">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">
                  💡 To enable map display:
                </p>
                <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                  <li>Create or edit a project</li>
                  <li>Add a complete address in the "Project Location" section</li>
                  <li>Save the project - the system will automatically geocode the address</li>
                  <li>Projects with valid coordinates will appear on this map</li>
                </ol>
              </div>
            </div>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={11}
            options={mapOptions}
            onLoad={onMapLoad}
            onUnmount={onMapUnmount}
          >
            {projectsWithLocation.map((project) => (
              <Marker
                key={project.id}
                position={{ lat: project.latitude!, lng: project.longitude! }}
                onClick={() => setSelected(project)}
                icon={{
                  url: getMarkerIcon(project.progress),
                }}
                title={project.name}
              />
            ))}

            {selected && (
              <InfoWindow
                position={{ lat: selected.latitude!, lng: selected.longitude! }}
                onCloseClick={() => setSelected(null)}
              >
                <div className="p-2 min-w-[250px]">
                  <h3 className="font-semibold text-lg mb-2">{selected.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <Building className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Project #</p>
                        <p className="text-gray-600">{selected.projectNumber}</p>
                      </div>
                    </div>
                    
                    {selected.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Location</p>
                          <p className="text-gray-600">{selected.address}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Manager</p>
                        <p className="text-gray-600">{getManagerName(selected.manager)}</p>
                      </div>
                    </div>
                    
                    {selected.customer && (
                      <div className="flex items-start gap-2">
                        <Building className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Customer</p>
                          <p className="text-gray-600">{selected.customer.name}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 pt-2">
                      <TrendingUp className="h-4 w-4 text-gray-500" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">Progress</span>
                          <span className="font-semibold">{selected.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${selected.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <Badge className={getStatusColor(selected.status)}>
                        {selected.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
        
        {/* Legend */}
        {projectsWithLocation.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Starting (0-30%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>In Progress (30-70%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>Near Completion (70-99%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Completed (100%)</span>
            </div>
          </div>
        )}
        
        {/* API Usage Notice */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            <strong>Optimization Active:</strong> Map uses cached coordinates and minimal API features to stay within the free Google Maps tier ($200/month credit).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
