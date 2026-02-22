"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SearchResults, { SearchResult } from "@/components/SearchResults";
import SearchForm, { SearchMethod } from "@/components/SearchForm";
import { useLocationData } from "@/hooks/useLocationData";
import { useSearchPolling } from "@/hooks/useSearchPolling";
import { useBatchReviews } from "@/hooks/useBatchReviews";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto p-6"><p className="text-gray-500">Ładowanie...</p></div>}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const urlTaskId = searchParams.get("taskId");

  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [batchDepth, setBatchDepth] = useState(100);
  const [batchSortBy, setBatchSortBy] = useState<"newest" | "highest_rating" | "lowest_rating" | "relevant">("newest");

  const locationData = useLocationData({ prefix: "search", withSerpLocations: true });

  const handleResults = useCallback((newResults: SearchResult[], cached: boolean, taskId: string) => {
    setResults(newResults);
    setFromCache(cached);
    setCurrentTaskId(taskId);
  }, []);

  const handleError = useCallback((err: string) => {
    setError(err);
  }, []);

  const { loading, taskStatus, search } = useSearchPolling({
    onResults: handleResults,
    onError: handleError,
  });

  const { batchStatus, batchLoading, handleBatchFetchReviews } = useBatchReviews({
    selectedLanguage: locationData.selectedLanguage,
    getLocationName: locationData.getLocationName,
    depth: batchDepth,
    sortBy: batchSortBy,
    onError: handleError,
  });

  // Load results from URL taskId param (e.g. from search history)
  useEffect(() => {
    if (!urlTaskId) return;

    setCurrentTaskId(urlTaskId);
    setFromCache(true);

    fetch(`/api/search/results?taskId=${urlTaskId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.results) {
          setResults(data.results);
          if (data.keyword) setKeyword(data.keyword);
          if (data.locationName) {
            locationData.setSelectedSerpLocation(data.locationName);
          }
        }
      })
      .catch(() => setError("Nie udało się załadować wyników"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTaskId]);

  const handleSearch = (params: { keyword: string; method: SearchMethod; depth: number }) => {
    setError(null);
    setResults([]);
    setFromCache(false);
    search({
      keyword: params.keyword,
      locationCode: locationData.getLocationCode(),
      locationName: locationData.getLocationName(),
      languageCode: locationData.getLanguageCode(),
      depth: params.depth,
      method: params.method,
    });
  };

  const handleRefresh = (params: { keyword: string; method: SearchMethod; depth: number }) => {
    setError(null);
    setResults([]);
    setFromCache(false);
    search({
      keyword: params.keyword,
      locationCode: locationData.getLocationCode(),
      locationName: locationData.getLocationName(),
      languageCode: locationData.getLanguageCode(),
      depth: params.depth,
      method: params.method,
      refresh: true,
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Wyszukiwarka firm</h1>

      <SearchForm
        countries={locationData.countries}
        serpLocations={locationData.serpLocations}
        languages={locationData.languages}
        serpLocationsLoading={locationData.serpLocationsLoading}
        selectedCountry={locationData.selectedCountry}
        selectedSerpLocation={locationData.selectedSerpLocation}
        selectedLanguage={locationData.selectedLanguage}
        onCountryChange={locationData.handleCountryChange}
        onSerpLocationChange={locationData.setSelectedSerpLocation}
        onLanguageChange={locationData.handleLanguageChange}
        onSearch={handleSearch}
        onRefresh={handleRefresh}
        loading={loading}
        hasResults={results.length > 0}
        keyword={keyword}
        onKeywordChange={setKeyword}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}

      {taskStatus === "pending" && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Zadanie dodane do kolejki DataForSEO. Wyniki pojawią się automatycznie (~1–5 min).</span>
        </div>
      )}

      {fromCache && results.length > 0 && (
        <span className="badge badge-blue mb-2">Z cache</span>
      )}

      {results.length > 0 && (
        <SearchResults
          results={results}
          onBatchFetchReviews={handleBatchFetchReviews}
          batchStatus={batchStatus}
          batchLoading={batchLoading}
          taskId={currentTaskId}
          batchDepth={batchDepth}
          onBatchDepthChange={setBatchDepth}
          batchSortBy={batchSortBy}
          onBatchSortByChange={(v) => setBatchSortBy(v as typeof batchSortBy)}
        />
      )}
    </div>
  );
}
