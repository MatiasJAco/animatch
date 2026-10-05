import { closePool } from '../db/pool'

// The pool is process-wide, so Nitro shutdown has to end it. Without this the process
// holds its sockets open after the last request, which keeps a dev server from exiting
// and leaks connections in a long-running deployment.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    await closePool()
  })
})