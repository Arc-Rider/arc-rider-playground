import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react';
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { isPlaygroundPreview } from './ui-meta.js';

export type DemoShellState = {
  app: App;
  hostContext?: McpUiHostContext;
};

type DemoShellProps = {
  name: string;
  version?: string;
  preview: boolean;
  connectingLabel?: string;
  timeoutMs?: number;
  children: (state: DemoShellState) => ReactNode;
};

export function DemoShell({
  name,
  version = '0.1.0',
  preview,
  connectingLabel = 'Connecting…',
  timeoutMs = 8000,
  children,
}: DemoShellProps) {
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();
  const [timedOut, setTimedOut] = useState(false);
  const { app, error } = useApp({
    appInfo: { name, version },
    capabilities: {},
    autoResize: true,
    onAppCreated: (created) => {
      created.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...prev, ...params }));
      };
    },
  });
  useHostStyles(app, app?.getHostContext());
  useEffect(() => {
    if (app) setHostContext(app.getHostContext());
  }, [app]);
  useEffect(() => {
    if (preview || app || error) return;
    const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [preview, app, error, timeoutMs]);

  if (preview) return null;
  if (error) return <main className="loading">{error.message}</main>;
  if (!app) {
    return (
      <main className="loading">
        {timedOut
          ? 'This view is waiting for a chat host. Open it from Cursor, Claude or ChatGPT, or use /preview.'
          : connectingLabel}
      </main>
    );
  }
  return <>{children({ app, hostContext })}</>;
}

export { isPlaygroundPreview };
