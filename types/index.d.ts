export type Activity = { last: string; calls: number; isRunning: boolean; at: number }

declare module 'claude-code' {
  interface PluginState {
    'agent-dashboard': { activity: Shaped<Record<string, Activity>> }
  }
}
