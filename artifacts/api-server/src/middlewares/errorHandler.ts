import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";

export const globalErrorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error({ err, path: req.path }, `Unhandled exception in route: ${message}`);

  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
};
