export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('access_token')
  const headers = {
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Only set Content-Type if it's not FormData (browser sets FormData multipart boundary automatically)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  })

  // Handle unauthorized/expired token
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refresh_token')
    
    // Attempt to silently refresh token
    if (refreshToken && !url.includes('/auth/refresh/')) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken })
        });
        
        if (refreshRes.ok) {
          const newData = await refreshRes.json();
          localStorage.setItem('access_token', newData.access);
          // Retry original request with new token
          options.headers = options.headers || {};
          options.headers['Authorization'] = `Bearer ${newData.access}`;
          const retryRes = await fetch(`${API_BASE}${url}`, options);
          
          if (!retryRes.ok) throw new Error('Retry failed');
          if (retryRes.status === 204) return null;
          return retryRes.json();
        }
      } catch (e) {
        console.error('Token refresh failed', e);
      }
    }

    // If refresh fails or we don't have a refresh token, log out
    localStorage.clear() // clear everything safely
    if (typeof document !== 'undefined') {
      document.cookie = "cap_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "cap_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "cap_user_role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
    window.location.href = '/'
    // We don't throw an error to prevent React crash, the redirect will handle it
    return new Promise(() => {}) 
  }

  // Handle subscription expired — redirect to block page
  if (response.status === 403) {
    try {
      const cloned = response.clone()
      const errData = await cloned.json()
      if (errData.code === 'subscription_expired' || (errData.detail && errData.detail.toLowerCase().includes('subscription has expired'))) {
        localStorage.setItem('subscription_status', 'expired')
        window.location.href = '/subscription-expired'
        throw new Error('Subscription expired')
      }
    } catch (parseErr) {
      if (parseErr.message === 'Subscription expired') throw parseErr
      // If JSON parse fails, fall through to generic error handling
    }
  }

  if (!response.ok) {
    let errorMsg = 'An error occurred'
    try {
      const data = await response.json()
      errorMsg = data.detail || JSON.stringify(data)
    } catch (e) {
      errorMsg = response.statusText
    }
    throw new Error(errorMsg)
  }

  // Handle 204 No Content
  if (response.status === 204) return null
  
  return response.json()
}
