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
    localStorage.removeItem('access_token')
    window.location.href = '/'
    throw new Error('Unauthorized')
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
