"use client";

import { useState, useEffect } from "react";

export interface Credentials {
  login: string;
  password: string;
}

interface Props {
  onCredentialsChange: (creds: Credentials | null) => void;
}

export default function ApiSettings({ onCredentialsChange }: Props) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("dfs_credentials");
    if (stored) {
      const creds = JSON.parse(stored) as Credentials;
      setLogin(creds.login);
      setPassword(creds.password);
      setSaved(true);
      onCredentialsChange(creds);
    }
    const storedWebhook = localStorage.getItem("webhook_url");
    if (storedWebhook) setWebhookUrl(storedWebhook);
  }, [onCredentialsChange]);

  const handleSave = () => {
    const creds = { login, password };
    localStorage.setItem("dfs_credentials", JSON.stringify(creds));
    setSaved(true);
    onCredentialsChange(creds);
  };

  const handleClear = () => {
    localStorage.removeItem("dfs_credentials");
    setLogin("");
    setPassword("");
    setSaved(false);
    onCredentialsChange(null);
  };

  return (
    <div className="bg-white rounded-lg border p-4 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">
        Ustawienia API DataForSEO
      </h2>
      {saved ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-green-600">
            Zalogowano jako: {login}
          </span>
          <button
            onClick={handleClear}
            className="text-sm text-red-500 hover:text-red-700 underline"
          >
            Wyloguj
          </button>
        </div>
      ) : (
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Login</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm w-48"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasło</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm w-48"
              placeholder="••••••••"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!login || !password}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Zapisz
          </button>
        </div>
      )}
      {/* Webhook URL */}
      <div className="mt-4 pt-3 border-t">
        <label className="block text-xs text-gray-500 mb-1">Webhook URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => {
              setWebhookUrl(e.target.value);
              localStorage.setItem("webhook_url", e.target.value);
            }}
            className="border rounded px-3 py-1.5 text-sm flex-1"
            placeholder="https://example.com/webhook"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">URL używany domyślnie przy wysyłaniu wyników przez webhook</p>
      </div>
    </div>
  );
}
