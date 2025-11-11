/**
 * Google Maps Configuration
 * 
 * This file provides access to the Google Maps API key.
 * The API key is stored in the environment variable NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 */

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export const isGoogleMapsConfigured = (): boolean => {
  return Boolean(GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE');
};

export const getGoogleMapsApiKey = (): string => {
  if (!isGoogleMapsConfigured()) {
    console.error('Google Maps API key is not configured');
    return '';
  }
  return GOOGLE_MAPS_API_KEY;
};
