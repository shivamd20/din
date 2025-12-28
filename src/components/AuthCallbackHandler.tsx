import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Intercepts OAuth callback routes and proxies them to the backend.
 * This component handles routes like /api/auth/callback/google, /api/auth/callback/github, etc.
 */
export default function AuthCallbackHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the full path including query parameters
        const fullPath = location.pathname + location.search;
        
        // Construct the backend URL
        const backendUrl = `${window.location.origin}${fullPath}`;
        
        // Make the request to the backend with proper headers
        const response = await fetch(backendUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/html, */*',
          },
          credentials: 'include', // Important for cookies/session
          redirect: 'follow', // Follow redirects
        });

        // Check if response is a redirect (after following)
        if (response.redirected && response.url !== backendUrl) {
          // If backend redirects to a different URL, follow it
          window.location.href = response.url;
          return;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`Auth callback failed: ${response.status} ${errorText}`);
        }

        // Success - navigate to home
        setStatus('success');
        // Small delay to ensure session is set and cookies are processed
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 100);
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
        // Navigate to home even on error after a delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      }
    };

    handleCallback();
  }, [location, navigate]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50/50 backdrop-blur-sm">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-zinc-400">Completing authentication...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50/50 backdrop-blur-sm">
        <div className="text-center">
          <p className="text-red-500">Authentication failed</p>
          {error && <p className="mt-2 text-sm text-zinc-400">{error}</p>}
          <p className="mt-4 text-sm text-zinc-400">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50/50 backdrop-blur-sm">
      <div className="text-center">
        <p className="text-green-500">Authentication successful!</p>
        <p className="mt-2 text-sm text-zinc-400">Redirecting...</p>
      </div>
    </div>
  );
}

