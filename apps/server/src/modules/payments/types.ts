declare global {
  namespace Express {
    interface Request {
      // Captured by the express.json() verify hook in index.ts so the
      // webhook route can check Moyasar's HMAC signature against the exact
      // bytes that were sent, not a re-serialization of the parsed body.
      rawBody?: Buffer;
    }
  }
}

export {};
