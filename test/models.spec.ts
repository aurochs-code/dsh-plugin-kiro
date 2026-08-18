import assert from 'node:assert/strict'
import test from 'node:test'
import { parseKiroModels } from '../src/models.js'

test('parses Kiro model entries and deduplicates model ids', () => {
  assert.deepEqual(parseKiroModels(JSON.stringify({ models: [
    { modelId: 'auto', displayName: 'Auto' },
    { id: 'claude', name: 'Claude', description: 'A model' },
    { id: 'claude', name: 'Duplicate' },
  ] })), [
    { id: 'auto', name: 'Auto' },
    { id: 'claude', name: 'Claude', description: 'A model' },
  ])
})
