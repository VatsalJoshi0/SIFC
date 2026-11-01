import { Router } from "express";
import { adminController } from "./admin.controller.js";
import { requireAdminRole } from "./admin.middleware.js";

export const adminRouter = Router();

// 1. Admin Authentication (Public)
adminRouter.post("/auth/login", (req, res, next) => {
  adminController.login(req, res).catch(next);
});

// 2. Users (OPS+)
adminRouter.get("/users", requireAdminRole(["OPS", "SUPER_ADMIN"]), (req, res, next) => {
  adminController.listUsers(req, res).catch(next);
});

adminRouter.get("/users/:userId", requireAdminRole(["OPS", "SUPER_ADMIN"]), (req, res, next) => {
  adminController.getUserDetail(req, res).catch(next);
});

// 3. Challans (OPS+)
adminRouter.get("/challans", requireAdminRole(["OPS", "SUPER_ADMIN"]), (req, res, next) => {
  adminController.listChallans(req, res).catch(next);
});

// 4. Dispute Resolution (OPS+)
adminRouter.post("/disputes/:disputeId/resolve", requireAdminRole(["OPS", "SUPER_ADMIN"]), (req, res, next) => {
  adminController.resolveDispute(req, res).catch(next);
});

// 5. Analytics (ANALYST+)
adminRouter.get("/scores/distribution", requireAdminRole(["ANALYST", "OPS", "SUPER_ADMIN"]), (req, res, next) => {
  adminController.getScoreDistribution(req, res).catch(next);
});

adminRouter.get("/revenue", requireAdminRole(["ANALYST", "OPS", "SUPER_ADMIN"]), (req, res, next) => {
  adminController.getRevenueAnalytics(req, res).catch(next);
});

// 6. Configuration Management (SUPER_ADMIN)
adminRouter.put("/config/scoring", requireAdminRole(["SUPER_ADMIN"]), (req, res, next) => {
  adminController.insertScoringConfig(req, res).catch(next);
});

adminRouter.put("/config/rewards", requireAdminRole(["SUPER_ADMIN"]), (req, res, next) => {
  adminController.updateRewardConfigs(req, res).catch(next);
});

adminRouter.put("/config/fees", requireAdminRole(["SUPER_ADMIN"]), (req, res, next) => {
  adminController.activateFeeConfig(req, res).catch(next);
});

// 7. Transactions Monitoring, Refunds & Reconciliation
adminRouter.get("/transactions", requireAdminRole(["OPS", "SUPER_ADMIN"]), (req, res, next) => {
  adminController.listTransactions(req, res).catch(next);
});

adminRouter.post("/transactions/:txnId/refund", requireAdminRole(["SUPER_ADMIN"]), (req, res, next) => {
  adminController.refundTransaction(req, res).catch(next);
});

adminRouter.post("/transactions/:txnId/reconcile", requireAdminRole(["OPS", "SUPER_ADMIN"]), (req, res, next) => {
  adminController.reconcileTransaction(req, res).catch(next);
});

// 8. Dataset Reset (SUPER_ADMIN)
adminRouter.post("/datasets/reset", requireAdminRole(["SUPER_ADMIN"]), (req, res, next) => {
  adminController.resetDataset(req, res).catch(next);
});

// 9. Audit Logs & CSV Export (ANALYST+)
adminRouter.get("/audit-logs", requireAdminRole(["ANALYST", "OPS", "SUPER_ADMIN"]), (req, res, next) => {
  adminController.listAuditLogs(req, res).catch(next);
});

adminRouter.get("/export/csv", requireAdminRole(["ANALYST", "OPS", "SUPER_ADMIN"]), (req, res, next) => {
  adminController.exportCsv(req, res).catch(next);
});
