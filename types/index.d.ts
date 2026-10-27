export type Activity = { last: string; calls: number; isRunning: boolean; at: number; tokensIn: number; tokensOut: number }

declare module 'claude-code' {
  interface PluginState {
    'agent-dashboard': { activity: Shaped<Record<string, Activity>> }
  }
}
