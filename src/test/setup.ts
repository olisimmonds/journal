import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'

// jsdom's built-in Blob lacks `arrayBuffer()` in some versions; Node's Blob
// implements the full standard and behaves identically for our purposes.
globalThis.Blob = NodeBlob as unknown as typeof Blob
