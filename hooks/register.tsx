import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity } from '../types'

const PANE = 'agent-dashboard'
const MAIN = 'main'
// Keyed by agentId ('main' for the main loop); bump the tag if Activity changes.
const activity = atom({ plugin: 'agent-dashboard', key: 'activity' } as const, {}, {
  shape: 'activity-1',
})

// A short hint of what a tool call touches, from the common input fields.
const hint = (e: object): string => {
  const f = e as Record<string, unknown>
  const v = f.command ?? f.file_path ?? f.pattern ?? f.description ?? f.url ?? ''
  const s = String(v).replace(/\s+/g, ' ')
  return s.length > 50 ? s.slice(0, 49) + '…' : s
}

const ago = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}m`
}

const set = ($: EngineInterface, key: string, fn: (a: Activity) => Activity) =>
  update($, activity, all => ({
    ...all,
    [key]: fn(all[key] ?? { last: '', calls: 0, isRunning: false, at: 0 }),
  }))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'agent-dashboard', description: 'Open the live agent dashboard' })
    void $.ui.open({ id: PANE, title: 'Agents' })
    return next(e)
  })

  on('command.run', { command: 'agent-dashboard' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agents' })
    return { text: 'Agent dashboard opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const key = e.agentId ?? MAIN
    const label = `${e.tool} ${hint(e)}`.trim()
    await set($, key, a => ({ last: label, calls: a.calls + 1, isRunning: true, at: Date.now() }))
    const ran = await next(e)
    await set($, key, a => ({ ...a, isRunning: false, at: Date.now() }))
    return ran
  })

  // Redraw when any loop finishes a turn, so finished agents show it.
  on('turn.complete', async ($, e, next) => {
    await set($, e.agentId ?? MAIN, a => ({ ...a, isRunning: false, at: Date.now() }))
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const all = await read($, activity)
    const agents = await $.agent.list()
    const now = Date.now()
    const main = all[MAIN]
    const live = agents.filter(a => ['pending', 'running', 'waiting'].includes(a.status)).length

    return (
      <Box flexDirection="column">
        <Text bold>{live} agent{live === 1 ? '' : 's'} active · {agents.length} total</Text>
        <Box flexDirection="column" marginTop={1}>
          <Text bold>● Main</Text>
          <Text dimColor>
            {main ? `${main.isRunning ? '▶' : '✓'} ${main.last} · ${main.calls} calls · ${ago(now - main.at)} ago` : 'idle'}
          </Text>
        </Box>
        {agents.length === 0 && <Text dimColor>No subagents yet.</Text>}
        {agents.map(agent => {
          const a = all[agent.id]
          const color = agent.status === 'failed' || agent.status === 'killed' ? 'red'
            : agent.status === 'completed' ? 'green' : 'yellow'
          return (
            <Box flexDirection="column" marginTop={1}>
              <Button key={agent.id} onPress={() => $.ui.view({ agentId: agent.id })}>
                {agent.name ?? agent.type}: {agent.description}
              </Button>
              <Text color={color}>
                {agent.status}{agent.parentId ? ' (nested)' : ''}
              </Text>
              <Text dimColor>
                {a ? `${a.isRunning ? '▶' : '·'} ${a.last} · ${a.calls} calls · ${ago(now - a.at)} ago` : 'starting…'}
              </Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}
