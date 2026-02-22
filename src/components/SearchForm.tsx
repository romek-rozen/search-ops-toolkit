"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import type { CountryOption, SerpLocationOption, LanguageOption } from "@/hooks/useLocationData";

type SearchMethod = "live" | "standard" | "priority";

const METHOD_INFO: Record<SearchMethod, { label: string; desc: string; price: string; pricePerPage: number }> = {
  live: { label: "Live", desc: "Real-time, ~6s", price: "$0.0020", pricePerPage: 0.002 },
  standard: { label: "Standard", desc: "Queue, ~5 min", price: "$0.0006", pricePerPage: 0.0006 },
  priority: { label: "Priority", desc: "Queue, ~1 min", price: "$0.0012", pricePerPage: 0.0012 },
};

interface SearchFormProps {
  countries: CountryOption[];
  serpLocations: SerpLocationOption[];
  languages: LanguageOption[];
  serpLocationsLoading: boolean;
  selectedCountry: string;
  selectedSerpLocation: string;
  selectedLanguage: string;
  onCountryChange: (name: string) => void;
  onSerpLocationChange: (name: string) => void;
  onLanguageChange: (name: string) => void;
  onSearch: (params: {
    keyword: string;
    method: SearchMethod;
    depth: number;
  }) => void;
  onRefresh: (params: {
    keyword: string;
    method: SearchMethod;
    depth: number;
  }) => void;
  loading: boolean;
  hasResults: boolean;
  /** Externally controlled keyword (e.g. loaded from history) */
  keyword: string;
  onKeywordChange: (keyword: string) => void;
}

export type { SearchMethod };

export default function SearchForm({
  countries,
  serpLocations,
  languages,
  serpLocationsLoading,
  selectedCountry,
  selectedSerpLocation,
  selectedLanguage,
  onCountryChange,
  onSerpLocationChange,
  onLanguageChange,
  onSearch,
  onRefresh,
  loading,
  hasResults,
  keyword,
  onKeywordChange,
}: SearchFormProps) {
  const [method, setMethod] = useState<SearchMethod>("standard");
  const [selectedDepth, setSelectedDepth] = useState(100);

  // Autocomplete query strings
  const [countryQuery, setCountryQuery] = useState(selectedCountry);
  const [serpQuery, setSerpQuery] = useState(selectedSerpLocation);
  const [langQuery, setLangQuery] = useState(selectedLanguage);
  const [showCountryDrop, setShowCountryDrop] = useState(false);
  const [showSerpDrop, setShowSerpDrop] = useState(false);
  const [showLangDrop, setShowLangDrop] = useState(false);
  const [countryActive, setCountryActive] = useState(-1);
  const [serpActive, setSerpActive] = useState(-1);
  const [langActive, setLangActive] = useState(-1);
  const countryRef = useRef<HTMLDivElement>(null);
  const serpRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  // Sync external changes to query strings
  useEffect(() => { setCountryQuery(selectedCountry); }, [selectedCountry]);
  useEffect(() => { setSerpQuery(selectedSerpLocation); }, [selectedSerpLocation]);
  useEffect(() => { setLangQuery(selectedLanguage); }, [selectedLanguage]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setShowCountryDrop(false);
      if (serpRef.current && !serpRef.current.contains(e.target as Node)) setShowSerpDrop(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLangDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filtered autocomplete lists
  const filteredCountries = useMemo(() => {
    const q = countryQuery.toLowerCase();
    return q ? countries.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 15) : countries.slice(0, 15);
  }, [countries, countryQuery]);

  const filteredSerpLocations = useMemo(() => {
    const q = serpQuery.toLowerCase();
    return q ? serpLocations.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 20) : serpLocations.slice(0, 20);
  }, [serpLocations, serpQuery]);

  const filteredLanguages = useMemo(() => {
    const q = langQuery.toLowerCase();
    return q ? languages.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 15) : languages.slice(0, 15);
  }, [languages, langQuery]);

  const estimatedCost = METHOD_INFO[method].pricePerPage * (selectedDepth / 100);

  // Scroll active dropdown item into view
  const scrollActiveIntoView = useCallback((containerRef: React.RefObject<HTMLDivElement | null>, index: number) => {
    const ul = containerRef.current?.querySelector("ul");
    if (!ul) return;
    const item = ul.children[index] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, []);

  // Keyboard navigation for country dropdown
  const handleCountryKeyDown = (e: React.KeyboardEvent) => {
    if (!showCountryDrop && e.key === "ArrowDown") { setShowCountryDrop(true); setCountryActive(0); return; }
    if (!showCountryDrop) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCountryActive((i) => { const next = Math.min(i + 1, filteredCountries.length - 1); scrollActiveIntoView(countryRef, next); return next; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCountryActive((i) => { const next = Math.max(i - 1, 0); scrollActiveIntoView(countryRef, next); return next; });
    } else if (e.key === "Enter" && countryActive >= 0) {
      e.preventDefault();
      const c = filteredCountries[countryActive];
      if (c) { onCountryChange(c.name); setCountryQuery(c.name); setShowCountryDrop(false); setCountryActive(-1); }
    } else if (e.key === "Escape") {
      setShowCountryDrop(false); setCountryActive(-1);
    }
  };

  // Keyboard navigation for SERP location dropdown (first item = "Cały kraj")
  const handleSerpKeyDown = (e: React.KeyboardEvent) => {
    const serpItems = [null, ...filteredSerpLocations]; // null = "Cały kraj"
    if (!showSerpDrop && e.key === "ArrowDown") { setShowSerpDrop(true); setSerpActive(0); return; }
    if (!showSerpDrop) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSerpActive((i) => { const next = Math.min(i + 1, serpItems.length - 1); scrollActiveIntoView(serpRef, next); return next; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSerpActive((i) => { const next = Math.max(i - 1, 0); scrollActiveIntoView(serpRef, next); return next; });
    } else if (e.key === "Enter" && serpActive >= 0) {
      e.preventDefault();
      if (serpActive === 0) {
        onSerpLocationChange(""); setSerpQuery(""); setShowSerpDrop(false); setSerpActive(-1);
      } else {
        const loc = filteredSerpLocations[serpActive - 1];
        if (loc) { onSerpLocationChange(loc.name); setSerpQuery(loc.name); setShowSerpDrop(false); setSerpActive(-1); }
      }
    } else if (e.key === "Escape") {
      setShowSerpDrop(false); setSerpActive(-1);
    }
  };

  // Keyboard navigation for language dropdown
  const handleLangKeyDown = (e: React.KeyboardEvent) => {
    if (!showLangDrop && e.key === "ArrowDown") { setShowLangDrop(true); setLangActive(0); return; }
    if (!showLangDrop) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setLangActive((i) => { const next = Math.min(i + 1, filteredLanguages.length - 1); scrollActiveIntoView(langRef, next); return next; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setLangActive((i) => { const next = Math.max(i - 1, 0); scrollActiveIntoView(langRef, next); return next; });
    } else if (e.key === "Enter" && langActive >= 0) {
      e.preventDefault();
      const lang = filteredLanguages[langActive];
      if (lang) { onLanguageChange(lang.name); setLangQuery(lang.name); setShowLangDrop(false); setLangActive(-1); }
    } else if (e.key === "Escape") {
      setShowLangDrop(false); setLangActive(-1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onSearch({ keyword: keyword.trim(), method, depth: selectedDepth });
  };

  const handleRefresh = () => {
    if (!keyword.trim()) return;
    onRefresh({ keyword: keyword.trim(), method, depth: selectedDepth });
  };

  return (
    <>
      {/* Ustawienia wyszukiwania */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Country autocomplete */}
          <div className="relative" ref={countryRef}>
            <label className="block text-xs text-slate-500 mb-1">Kraj</label>
            <input
              type="text"
              value={countryQuery}
              onChange={(e) => { setCountryQuery(e.target.value); setShowCountryDrop(true); setCountryActive(-1); }}
              onFocus={() => setShowCountryDrop(true)}
              onKeyDown={handleCountryKeyDown}
              placeholder="Wpisz kraj..."
              className="form-input w-52"
            />
            {showCountryDrop && filteredCountries.length > 0 && (
              <ul className="absolute z-50 bg-white border rounded shadow-lg mt-1 max-h-60 overflow-auto w-64">
                {filteredCountries.map((c, i) => (
                  <li
                    key={c.code}
                    onClick={() => {
                      onCountryChange(c.name);
                      setCountryQuery(c.name);
                      setShowCountryDrop(false);
                      setCountryActive(-1);
                    }}
                    className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${i === countryActive ? "bg-blue-100" : c.name === selectedCountry ? "bg-blue-50 font-medium" : ""}`}
                  >
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* SERP location autocomplete */}
          <div className="relative flex-1 min-w-48" ref={serpRef}>
            <label className="block text-xs text-slate-500 mb-1">
              Lokalizacja (miasto/region)
              {serpLocationsLoading && <span className="ml-1 text-gray-400">ładowanie...</span>}
            </label>
            <input
              type="text"
              value={serpQuery}
              onChange={(e) => { setSerpQuery(e.target.value); setShowSerpDrop(true); setSerpActive(-1); }}
              onFocus={() => setShowSerpDrop(true)}
              onKeyDown={handleSerpKeyDown}
              placeholder={`Cały kraj (${selectedCountry})`}
              className="form-input w-full"
              disabled={serpLocationsLoading}
            />
            {showSerpDrop && (
              <ul className="absolute z-50 bg-white border rounded shadow-lg mt-1 max-h-60 overflow-auto w-full">
                <li
                  onClick={() => { onSerpLocationChange(""); setSerpQuery(""); setShowSerpDrop(false); setSerpActive(-1); }}
                  className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${serpActive === 0 ? "bg-blue-100" : !selectedSerpLocation ? "bg-blue-50 font-medium" : ""}`}
                >
                  Cały kraj ({selectedCountry})
                </li>
                {filteredSerpLocations.map((loc, i) => (
                  <li
                    key={loc.code}
                    onClick={() => {
                      onSerpLocationChange(loc.name);
                      setSerpQuery(loc.name);
                      setShowSerpDrop(false);
                      setSerpActive(-1);
                    }}
                    className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${i + 1 === serpActive ? "bg-blue-100" : loc.name === selectedSerpLocation ? "bg-blue-50 font-medium" : ""}`}
                  >
                    {loc.name} <span className="text-gray-400">({loc.locationType})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Language autocomplete */}
          <div className="relative" ref={langRef}>
            <label className="block text-xs text-slate-500 mb-1">Język</label>
            <input
              type="text"
              value={langQuery}
              onChange={(e) => { setLangQuery(e.target.value); setShowLangDrop(true); setLangActive(-1); }}
              onFocus={() => setShowLangDrop(true)}
              onKeyDown={handleLangKeyDown}
              placeholder="Wpisz język..."
              className="form-input w-40"
            />
            {showLangDrop && filteredLanguages.length > 0 && (
              <ul className="absolute z-50 bg-white border rounded shadow-lg mt-1 max-h-60 overflow-auto w-52">
                {filteredLanguages.map((lang, i) => (
                  <li
                    key={lang.code}
                    onClick={() => {
                      onLanguageChange(lang.name);
                      setLangQuery(lang.name);
                      setShowLangDrop(false);
                      setLangActive(-1);
                    }}
                    className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${i === langActive ? "bg-blue-100" : lang.name === selectedLanguage ? "bg-blue-50 font-medium" : ""}`}
                  >
                    {lang.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Depth */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Głębokość (wyników)</label>
            <input
              type="number" min={10} step={10}
              value={selectedDepth}
              onChange={(e) => setSelectedDepth(Math.max(10, Number(e.target.value)))}
              className="form-input w-28"
            />
          </div>
        </div>

        {/* Metoda */}
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-2">Metoda pobierania</label>
          <div className="flex gap-3">
            {(Object.entries(METHOD_INFO) as [SearchMethod, typeof METHOD_INFO["live"]][]).map(([key, info]) => (
              <label
                key={key}
                className={`flex-1 border rounded-lg p-3 cursor-pointer transition-colors ${
                  method === key ? "border-brand-500 bg-brand-50 shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio" name="method" value={key}
                    checked={method === key}
                    onChange={() => setMethod(key)}
                    className="text-blue-600"
                  />
                  <span className="font-medium text-sm">{info.label}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 ml-5">{info.desc}</div>
                <div className="text-xs text-slate-400 ml-5">{info.price}/strona SERP</div>
              </label>
            ))}
          </div>
        </div>

        {/* Kalkulacja ceny */}
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          Szacowany koszt: <span className="font-semibold text-slate-700">${estimatedCost.toFixed(4)}</span>
          {selectedDepth > 100 && (
            <span className="ml-2 text-slate-400">(depth {selectedDepth} = ×{selectedDepth / 100})</span>
          )}
        </div>
      </div>

      {/* Formularz wyszukiwania */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
        <input
          type="text" value={keyword} onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="Wpisz frazę, np. 'restaurants in London'..."
          className="form-input flex-1" required
        />
        <button
          type="submit" disabled={loading}
          className="btn-primary"
        >
          {loading ? "Szukam..." : "Szukaj"}
        </button>
        {hasResults && (
          <button
            type="button" onClick={handleRefresh} disabled={loading}
            className="btn-secondary"
          >
            Odśwież
          </button>
        )}
      </form>
    </>
  );
}
