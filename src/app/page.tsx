import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Link from "next/link";

export default async function Home() {
  const session = await getSession();

  if (session.isLoggedIn) {
    redirect("/search");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Search Ops Toolkit</h1>
          <Link
            href="/login"
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Zaloguj się
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Wyszukuj firmy na Google Maps i pobieraj opinie
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Narzędzie do wyszukiwania firm przez Google Maps SERP, pobierania
            opinii z wizytówek i eksportu danych — z pełną kontrolą kosztów API.
          </p>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Zaloguj się
            </Link>
            <a
              href="https://skq.pl/data4seo"
              target="_blank"
              rel="noopener"
              className="border border-gray-300 text-gray-700 rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Załóż konto DataForSEO
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border p-6">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Wyszukiwanie firm</h3>
            <p className="text-sm text-gray-600">Przeszukuj Google Maps SERP — tryb live, standard lub priority.</p>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674h4.911c.969 0 1.371 1.24.588 1.81l-3.974 2.888 1.518 4.674c.3.921-.755 1.688-1.539 1.118l-3.974-2.888-3.974 2.888c-.783.57-1.838-.197-1.539-1.118l1.518-4.674-3.974-2.888c-.783-.57-.38-1.81.588-1.81h4.911l1.518-4.674z" /></svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Pobieranie opinii</h3>
            <p className="text-sm text-gray-600">Pobieraj opinie z wizytówek Google — pojedynczo lub batch do 100 firm.</p>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Eksport danych</h3>
            <p className="text-sm text-gray-600">Eksportuj wyniki do CSV, Excel lub wysyłaj przez webhook.</p>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M10 11h4M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Cache danych</h3>
            <p className="text-sm text-gray-600">Dane cache&apos;owane w bazie — nie płacisz dwa razy za te same wyniki.</p>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Kontrola kosztów</h3>
            <p className="text-sm text-gray-600">Śledzenie kosztów API per task — pełna transparentność wydatków.</p>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">Twoje dane, Twoje konto</h3>
            <p className="text-sm text-gray-600">Logujesz się własnym kontem DataForSEO — dane izolowane per użytkownik.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-8 text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Potrzebujesz konta DataForSEO
          </h3>
          <p className="text-sm text-gray-600 mb-5 max-w-lg mx-auto">
            Aplikacja korzysta z API DataForSEO do pobierania danych z Google Maps.
            Aby zacząć, załóż konto i użyj swoich danych logowania API.
          </p>
          <a
            href="https://skq.pl/data4seo"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Załóż konto DataForSEO
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        </div>
      </section>
    </div>
  );
}
