import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import type { SiteParams } from './paramSchema.js';
import { defaultSiteParams } from './paramSchema.js';

let cachedParams: SiteParams = { ...defaultSiteParams };

function getParamFilePath(): string {
  if (process.env.PARAM_YAML_PATH && fs.existsSync(process.env.PARAM_YAML_PATH)) {
    return process.env.PARAM_YAML_PATH;
  }
  const rootPath = path.resolve(process.cwd(), 'param.yaml');
  if (fs.existsSync(rootPath)) return rootPath;
  const backendPath = path.resolve(process.cwd(), 'backend/param.yaml');
  if (fs.existsSync(backendPath)) return backendPath;
  return rootPath;
}

export function loadSiteParams(): SiteParams {
  try {
    const filePath = getParamFilePath();
    if (!fs.existsSync(filePath)) {
      saveSiteParams(defaultSiteParams);
      return defaultSiteParams;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = YAML.parse(raw) || {};
    cachedParams = {
      server: { ...defaultSiteParams.server, ...parsed.server },
      security: { ...defaultSiteParams.security, ...parsed.security },
      ui: { ...defaultSiteParams.ui, ...parsed.ui },
      media: { ...defaultSiteParams.media, ...parsed.media },
      profiles: { ...defaultSiteParams.profiles, ...parsed.profiles },
    };
  } catch (err) {
    console.warn('[ParamManager] Error reading param.yaml, using defaults:', err);
  }
  return cachedParams;
}

export function getSiteParams(): SiteParams {
  return cachedParams;
}

export function saveSiteParams(newParams: Partial<SiteParams>): SiteParams {
  const merged: SiteParams = {
    server: { ...cachedParams.server, ...newParams.server },
    security: { ...cachedParams.security, ...newParams.security },
    ui: { ...cachedParams.ui, ...newParams.ui },
    media: { ...cachedParams.media, ...newParams.media },
    profiles: { ...cachedParams.profiles, ...newParams.profiles },
  };
  const filePath = getParamFilePath();
  const yamlContent = YAML.stringify(merged);
  fs.writeFileSync(filePath, yamlContent, 'utf8');
  cachedParams = merged;
  return cachedParams;
}

export function validateInvitationCode(code?: string): boolean {
  const params = getSiteParams();
  if (!params.security.invitationOnly) return true;
  if (!code) return false;
  return params.security.invitationCodes.includes(code.trim());
}

// Initial load & lightweight watcher for external changes
loadSiteParams();
try {
  const target = getParamFilePath();
  if (fs.existsSync(target)) {
    fs.watch(target, () => loadSiteParams());
  }
} catch {
  // Watcher is optional
}
