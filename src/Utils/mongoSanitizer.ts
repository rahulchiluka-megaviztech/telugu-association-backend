function sanitize(obj: any) {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (key.includes('$') || key.includes('.')) {
          delete obj[key];
        } else {
          sanitize(obj[key]);
        }
      }
    }
  }
  export function mongoSanitizerMiddleware(req: any, res: any, next: any) {
    sanitize(req.body);
    sanitize(req.query);
    sanitize(req.params);
    next();
  }
  