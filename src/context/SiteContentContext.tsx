import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchSiteContentMap,
  SiteContentItem,
  DEFAULT_SITE_CONTENT,
} from '../services/mediaService';
import { isSupabaseConfigured } from '../../api/lib/supabaseServer';

interface SiteContentContextType {
  siteContent: Record<string, SiteContentItem>;
  loading: boolean;
  isDemoMode: boolean;
  refreshSiteContent: () => Promise<void>;
  getMediaUrl: (contentKey: string, fallbackUrl?: string) => string;
  getMetadata: (contentKey: string) => Record<string, any>;
}

const SiteContentContext = createContext<SiteContentContextType | undefined>(undefined);

export const SiteContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [siteContent, setSiteContent] = useState<Record<string, SiteContentItem>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isSupabaseConfigured());

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const map = await fetchSiteContentMap();
      setSiteContent(map);
    } catch (err) {
      console.warn('[SiteContentContext] Error loading content:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const refreshSiteContent = async () => {
    await loadContent();
  };

  /**
   * Helper to resolve media URL with cache busting query parameter ?v=<timestamp>
   */
  const getMediaUrl = (contentKey: string, fallbackUrl?: string): string => {
    const item = siteContent[contentKey];
    const defaultFallback = DEFAULT_SITE_CONTENT[contentKey]?.textValue || fallbackUrl || '/images/coral-hero.jpg';

    const rawUrl = item?.textValue || defaultFallback;

    // If it's a data URL, return directly
    if (rawUrl.startsWith('data:')) {
      return rawUrl;
    }

    // Add cache busting version query param if updatedAt exists
    if (item?.updatedAt) {
      const v = new Date(item.updatedAt).getTime();
      return rawUrl.includes('?') ? `${rawUrl}&v=${v}` : `${rawUrl}?v=${v}`;
    }

    return rawUrl;
  };

  /**
   * Helper to resolve metadata for a content key
   */
  const getMetadata = (contentKey: string): Record<string, any> => {
    const item = siteContent[contentKey];
    const defaultMeta = DEFAULT_SITE_CONTENT[contentKey]?.metadata || {};
    return { ...defaultMeta, ...(item?.metadata || {}) };
  };

  return (
    <SiteContentContext.Provider
      value={{
        siteContent,
        loading,
        isDemoMode,
        refreshSiteContent,
        getMediaUrl,
        getMetadata,
      }}
    >
      {children}
    </SiteContentContext.Provider>
  );
};

export const useSiteContent = (): SiteContentContextType => {
  const context = useContext(SiteContentContext);
  if (!context) {
    // Graceful fallback if component is not wrapped in provider
    return {
      siteContent: {},
      loading: false,
      isDemoMode: true,
      refreshSiteContent: async () => {},
      getMediaUrl: (key, fb) => DEFAULT_SITE_CONTENT[key]?.textValue || fb || '/images/coral-hero.jpg',
      getMetadata: (key) => DEFAULT_SITE_CONTENT[key]?.metadata || {},
    };
  }
  return context;
};
