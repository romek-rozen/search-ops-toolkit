"use client";

import { useState, useEffect } from "react";

export interface CountryOption {
  name: string;
  code: number;
  countryCode: string;
}

export interface SerpLocationOption {
  name: string;
  code: number;
  countryCode: string;
  locationType: string;
}

export interface LanguageOption {
  name: string;
  code: string;
}

interface UseLocationDataOptions {
  /** localStorage key prefix — "search" or "reviews" */
  prefix: "search" | "reviews";
  /** Whether to load SERP locations (search page needs them, reviews page doesn't) */
  withSerpLocations?: boolean;
}

export function useLocationData({ prefix, withSerpLocations = false }: UseLocationDataOptions) {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [serpLocations, setSerpLocations] = useState<SerpLocationOption[]>([]);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [serpLocationsLoading, setSerpLocationsLoading] = useState(false);

  // Defaults (must be stable across server & client to avoid hydration mismatch)
  const defaultLanguage = prefix === "reviews" ? "Polish" : "English";
  const defaultLanguageCode = prefix === "reviews" ? "pl" : "en";

  const [selectedCountry, setSelectedCountry] = useState("United Kingdom");
  const [selectedCountryCode, setSelectedCountryCode] = useState("GB");
  const [selectedSerpLocation, setSelectedSerpLocation] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState(defaultLanguage);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState(defaultLanguageCode);
  const [hydrated, setHydrated] = useState(false);

  // Restore from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    setSelectedCountry(localStorage.getItem(`${prefix}_country`) || "United Kingdom");
    setSelectedCountryCode(localStorage.getItem(`${prefix}_country_code`) || "GB");
    setSelectedSerpLocation(localStorage.getItem(`${prefix}_serp_location`) || "");
    setSelectedLanguage(localStorage.getItem(`${prefix}_language`) || defaultLanguage);
    setSelectedLanguageCode(localStorage.getItem(`${prefix}_language_code`) || defaultLanguageCode);
    setHydrated(true);
  }, [prefix, defaultLanguage, defaultLanguageCode]);

  // Persist to localStorage (only after initial hydration to avoid overwriting with defaults)
  useEffect(() => { if (hydrated) localStorage.setItem(`${prefix}_country`, selectedCountry); }, [prefix, selectedCountry, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(`${prefix}_country_code`, selectedCountryCode); }, [prefix, selectedCountryCode, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(`${prefix}_serp_location`, selectedSerpLocation); }, [prefix, selectedSerpLocation, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(`${prefix}_language`, selectedLanguage); }, [prefix, selectedLanguage, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(`${prefix}_language_code`, selectedLanguageCode); }, [prefix, selectedLanguageCode, hydrated]);

  // Load countries & languages
  useEffect(() => {
    if (locationsLoaded) return;
    fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.locations) setCountries(data.locations);
        if (data.languages) setLanguages(data.languages);
        setLocationsLoaded(true);
      })
      .catch(() => {});
  }, [locationsLoaded]);

  // Load SERP locations when country changes
  useEffect(() => {
    if (!withSerpLocations || !selectedCountryCode) return;
    const controller = new AbortController();
    setSerpLocationsLoading(true);
    setSerpLocations([]);

    fetch("/api/serp-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode: selectedCountryCode }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.locations) {
          setSerpLocations(data.locations);
          const saved = localStorage.getItem(`${prefix}_serp_location`);
          if (saved && data.locations.some((l: SerpLocationOption) => l.name === saved)) {
            setSelectedSerpLocation(saved);
          } else {
            setSelectedSerpLocation("");
          }
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
      })
      .finally(() => setSerpLocationsLoading(false));

    return () => controller.abort();
  }, [withSerpLocations, selectedCountryCode, prefix]);

  const handleCountryChange = (countryName: string) => {
    setSelectedCountry(countryName);
    const country = countries.find((c) => c.name === countryName);
    if (country) setSelectedCountryCode(country.countryCode);
  };

  const handleLanguageChange = (langName: string) => {
    setSelectedLanguage(langName);
    const lang = languages.find((l) => l.name === langName);
    if (lang) setSelectedLanguageCode(lang.code);
  };

  const getLocationCode = () => {
    if (selectedSerpLocation) {
      const loc = serpLocations.find((l) => l.name === selectedSerpLocation);
      if (loc) return loc.code;
    }
    const country = countries.find((c) => c.name === selectedCountry);
    return country?.code ?? 2826;
  };

  const getLocationName = () => {
    return selectedSerpLocation || selectedCountry;
  };

  const getLanguageCode = () => {
    const lang = languages.find((l) => l.name === selectedLanguage);
    return lang?.code ?? "en";
  };

  return {
    // Data
    countries,
    serpLocations,
    languages,
    locationsLoaded,
    serpLocationsLoading,

    // Selected values
    selectedCountry,
    selectedCountryCode,
    selectedSerpLocation,
    setSelectedSerpLocation,
    selectedLanguage,
    selectedLanguageCode,

    // Handlers
    handleCountryChange,
    handleLanguageChange,

    // Helpers
    getLocationCode,
    getLocationName,
    getLanguageCode,
  };
}
