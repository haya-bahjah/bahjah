declare global {
  namespace Express {
    interface Request {
      userId?: string;
      // How an admin request proved itself: a Bahjah account on the admin
      // list, or the shared portal passphrase. Set by admin/middleware.ts.
      adminVia?: 'account' | 'portal';
    }
  }
}

export {};
