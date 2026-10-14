/**
 * Centralisation de l'URL de base de l'API UMS
 * Priorité absolue à la variable EXPO_PUBLIC_API_URL définie dans le .env
 */
export function getApiBaseUrl(): string {
  // 1. Variable d'environnement centralisée (.env) prioritaire
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl && envApiUrl.trim().length > 0) {
    return envApiUrl.trim().replace(/\/+$/, '');
  }

  // 2. Détection dynamique basée sur l'hôte courant si non spécifié dans l'environnement
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
    if (port === '8080' || port === '80' || port === '') {
      return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    }
    return `${protocol}//${hostname}:3000`;
  }

  // 3. Fallback par défaut
  return 'http://localhost:3000';
}
