// Auth middleware protecting at least one route
import { Request, Response, NextFunction } from "express";

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  if (request.session.user?.id) {
    next();
  } else {
    response.redirect("/auth/login");
  }
}
