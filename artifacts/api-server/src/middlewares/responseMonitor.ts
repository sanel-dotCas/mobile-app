import type { Request, Response, NextFunction } from "express";
import { recordServerError } from "../lib/errorTracker";

export function responseMonitor(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    if (res.statusCode >= 500) {
      recordServerError({
        statusCode: res.statusCode,
        path: req.path,
        message: `${req.method} ${req.path} responded ${res.statusCode}`,
      });
    }
  });
  next();
}
