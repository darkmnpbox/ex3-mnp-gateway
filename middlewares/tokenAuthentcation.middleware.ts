import { NextFunction, Request, Response } from "express";


export function tokenAuthenticationMiddleware(req: Request, res: Response, next: NextFunction): void {
    console.log('need to do token authentication');
    next();
}