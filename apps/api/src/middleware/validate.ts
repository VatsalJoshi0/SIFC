import type { Request, Response, NextFunction } from "express";
import { type AnyZodObject, ZodError } from "zod";

type ValidationTarget = "body" | "query" | "params";

export function validate(schema: AnyZodObject, target: ValidationTarget = "body") {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const dataToValidate = req[target];
      const parsed = await schema.parseAsync(dataToValidate);
      req[target] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(error);
      }
    }
  };
}
