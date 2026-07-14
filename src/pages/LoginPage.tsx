import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector, login } from "@/store";
import { config } from "@/config";

type LoginStatus = "idle" | "loading" | "error";

export const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedUsername = username.trim();

    if (trimmedUsername.length === 0 || password.length === 0) {
      setErrorMessage("Username and password are required.");
      return;
    }

    setStatus("loading");

    try {
      const credentials = btoa(`${trimmedUsername}:${password}`);
      const response = await fetch(`${config.apiUrl}/api/info`, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${credentials}`,
        },
      });

      if (response.ok) {
        dispatch(login({ username: trimmedUsername, password }));
        navigate(from, { replace: true });
      } else if (response.status === 401) {
        setStatus("error");
        setErrorMessage("Invalid credentials. Check your username and password.");
        setPassword("");
        passwordRef.current?.focus();
      } else {
        setStatus("error");
        setErrorMessage(
          `Unexpected response from TerminusDB (HTTP ${response.status}). Is the server running?`
        );
      }
    } catch {
      setStatus("error");
      setErrorMessage(
        "Cannot connect to TerminusDB. Check that the server is running and accessible."
      );
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-dfrntBlue-900 px-4">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute -left-1/4 -top-1/4 h-[60vh] w-[60vh] rounded-full bg-dfrntBlue-600 opacity-20 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[50vh] w-[50vh] rounded-full bg-dfrnt-500 opacity-10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-dfrntBlue-600 shadow-lg shadow-dfrntBlue-900/50">
            <svg
              className="h-6 w-6 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
          </div>
          <h1 className="font-headline text-2xl font-bold text-white">
            Data Explorer
          </h1>
          <p className="mt-1 text-sm text-dfrntBlue-200">
            TerminusDB Data Product UI
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-sm"
          aria-labelledby="login-heading"
        >
          <h2
            id="login-heading"
            className="mb-4 text-lg font-semibold text-white"
          >
            Sign in
          </h2>
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {errorMessage}
            </div>
          )}
          <div className="mb-4">
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-dfrntBlue-100"
            >
              Username
            </label>
            <input
              ref={usernameRef}
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={status === "loading"}
              className="block w-full rounded-md border-white/20 bg-white/10 text-white placeholder-dfrntBlue-300 shadow-sm focus:border-dfrntBlue-400 focus:ring-dfrntBlue-400 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm"
              required
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-dfrntBlue-100"
            >
              Password
            </label>
            <input
              ref={passwordRef}
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === "loading"}
              className="block w-full rounded-md border-white/20 bg-white/10 text-white placeholder-dfrntBlue-300 shadow-sm focus:border-dfrntBlue-400 focus:ring-dfrntBlue-400 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="flex w-full items-center justify-center rounded-md bg-dfrntBlue-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-dfrntBlue-900/30 transition-colors hover:bg-dfrntBlue-400 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-400 focus:ring-offset-2 focus:ring-offset-dfrntBlue-900 disabled:bg-dfrntBlue-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "loading" ? (
              <>
                <svg
                  className="mr-2 h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-dfrntBlue-300">
          Connecting to{" "}
          <span className="font-data">
            {config.apiUrl || "same-origin"}
          </span>
        </p>
      </div>
    </div>
  );
};
