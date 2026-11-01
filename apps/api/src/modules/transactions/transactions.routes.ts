import { Router } from "express";
import { transactionsController } from "./transactions.controller.js";
import { requireCitizenAuth } from "../auth/auth.middleware.js";

export const transactionsRouter = Router();

// POST /api/v1/transactions (Confirm quote and run payment)
transactionsRouter.post("/", requireCitizenAuth, (req, res, next) => {
  transactionsController.confirmTransaction(req, res).catch(next);
});

// GET /api/v1/transactions (Transaction history)
transactionsRouter.get("/", requireCitizenAuth, (req, res, next) => {
  transactionsController.listUserTransactions(req, res).catch(next);
});

// GET /api/v1/transactions/:txnId/receipt (Receipt as JSON or PDF)
transactionsRouter.get("/:txnId/receipt", requireCitizenAuth, (req, res, next) => {
  transactionsController.getReceipt(req, res).catch(next);
});

// GET /api/v1/transactions/:txnId (Transaction detail)
transactionsRouter.get("/:txnId", requireCitizenAuth, (req, res, next) => {
  transactionsController.getTransaction(req, res).catch(next);
});
