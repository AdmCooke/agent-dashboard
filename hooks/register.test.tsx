import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-dashboard',
  component: 'Pane',
  requestId: 'agent-dashboard',
  props: {
    title: 'Agents', isFocused: false, bodyColumns: 60, placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 }, view: {},
  },
} as const

test('shows main and subagent activity on every surface', async ($, on) => {
  on('command.register', () => ({ value: { command: 'agent-dashboard' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.list', () => ({
    value: [{ id: 'a1', description: 'Find auth code', type: 'Explore', status: 'running' }],
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls -la' })
  await $.tool.call({ tool: 'Grep', pattern: 'login', agentId: 'a1' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Bash ls -la/ }))?.text).toMatch(/1 calls/)
    expect((await ui.find({ type: 'Text', text: /Grep login/ }))?.text).toMatch(/1 calls/)
    expect((await ui.find({ type: 'Text', text: /active/ }))?.text).toMatch(/^1 agent active/)
    await ui.unmount()
  }
})
