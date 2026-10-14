export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
    if (port === '8080' || port === '80' || port === '') {
      return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    }
    return `${protocol}//${hostname}:3000`;
  }
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
}
