export type UiMeta = {
  ui: { resourceUri: string; visibility?: string[] };
  'ui/resourceUri': string;
  'openai/outputTemplate': string;
};

export function uiMeta(resourceUri: string, options?: { appOnly?: boolean }): UiMeta {
  return {
    ui: {
      resourceUri,
      ...(options?.appOnly ? { visibility: ['app'] } : {}),
    },
    'ui/resourceUri': resourceUri,
    'openai/outputTemplate': resourceUri,
  };
}

export function isPlaygroundPreview(pathname = typeof window === 'undefined' ? '' : window.location.pathname, search = typeof window === 'undefined' ? '' : window.location.search) {
  const params = new URLSearchParams(search);
  return (
    params.get('standalone') === '1' ||
    pathname === '/preview' ||
    pathname.endsWith('/preview')
  );
}
