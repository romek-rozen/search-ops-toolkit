"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Błąd logowania");
        return;
      }

      router.push("/search");
      router.refresh();
    } catch {
      setError("Błąd połączenia z serwerem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-8 lg:gap-12 items-center lg:items-start">
        {/* Left column — app description */}
        <div className="w-full lg:w-1/2 lg:pt-4">
          <h1 className="text-3xl font-bold text-gray-800 mb-3">DFS Maps App</h1>
          <p className="text-gray-600 mb-6">
            Narzędzie do wyszukiwania firm na Google Maps, pobierania opinii
            i eksportu danych — z pełną kontrolą kosztów API.
          </p>

          <ul className="space-y-3 text-sm text-gray-700 mb-8">
            <li className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
              <span>Wyszukiwanie firm przez Google Maps SERP</span>
            </li>
            <li className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674h4.911c.969 0 1.371 1.24.588 1.81l-3.974 2.888 1.518 4.674c.3.921-.755 1.688-1.539 1.118l-3.974-2.888-3.974 2.888c-.783.57-1.838-.197-1.539-1.118l1.518-4.674-3.974-2.888c-.783-.57-.38-1.81.588-1.81h4.911l1.518-4.674z" /></svg>
              <span>Pobieranie opinii z wizytówek Google</span>
            </li>
            <li className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
              <span>Eksport do CSV, Excel, webhook</span>
            </li>
            <li className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M10 11h4M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
              <span>Cache danych — brak podwójnych kosztów API</span>
            </li>
            <li className="flex items-start gap-2.5">
              <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              <span>Śledzenie kosztów per task</span>
            </li>
          </ul>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-3">
              Aplikacja wymaga konta <strong>DataForSEO</strong> — dane logowania
              to Twój email i hasło API z panelu DataForSEO.
            </p>
            <a
              href="https://skq.pl/data4seo"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors"
            >
              Załóż konto DataForSEO
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
        </div>

        {/* Right column — login form */}
        <div className="w-full lg:w-1/2 max-w-md">
          <div className="bg-white rounded-xl shadow-sm border p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Zaloguj się</h2>
            <p className="text-gray-500 text-sm mb-6">
              Podaj dane API DataForSEO
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-1">
                  Login (email)
                </label>
                <input
                  id="login"
                  type="email"
                  required
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="twoj@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Hasło API
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Logowanie..." : "Zaloguj się"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
