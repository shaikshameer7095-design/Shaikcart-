import { useEffect } from 'react';

interface SeoOptions {
  title: string;
  description?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function setMetaTag(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useSeo({ title, description, jsonLd }: SeoOptions) {
  useEffect(() => {
    const fullTitle = title.includes('SHAIKCART') ? title : `${title} | SHAIKCART`;
    document.title = fullTitle;

    const desc =
      description ||
      'Discover thoughtfully curated fashion, home & living, beauty, electronics, sports, and gifts at SHAIKCART.';

    setMetaTag('meta[name="description"]', 'name', 'description', desc);
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', desc);
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', desc);

    const canonicalUrl = window.location.origin + window.location.pathname;
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);

    let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl);

    const existingScript = document.getElementById('shaikcart-dynamic-jsonld');
    if (existingScript) existingScript.remove();

    if (jsonLd) {
      const script = document.createElement('script');
      script.id = 'shaikcart-dynamic-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      const s = document.getElementById('shaikcart-dynamic-jsonld');
      if (s) s.remove();
    };
  }, [title, description, JSON.stringify(jsonLd || null)]);
}
