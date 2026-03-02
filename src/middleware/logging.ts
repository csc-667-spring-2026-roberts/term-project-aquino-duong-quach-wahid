import { NextFunction, Request, Response } from "express";

const logging = (request: Request, response: Response, next: NextFunction) => {
  console.log(`${new Date().toUTCString()} ${request.method} ${request.path}`);
  next();
};

export default logging;
