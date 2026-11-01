import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";
import { vehiclesRouter } from "../modules/vehicles/vehicles.routes.js";
import { challansRouter } from "../modules/challans/challans.routes.js";
import { scoringRouter } from "../modules/scoring/scoring.routes.js";
import { rewardsRouter } from "../modules/rewards/rewards.routes.js";
import { servicesRouter } from "../modules/services/services.routes.js";
import { transactionsRouter } from "../modules/transactions/transactions.routes.js";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { requireCitizenAuth } from "../modules/auth/auth.middleware.js";
import { vehiclesController } from "../modules/vehicles/vehicles.controller.js";
import { challansController } from "../modules/challans/challans.controller.js";

export const apiV1Router = Router();

// 1. Citizen Auth
apiV1Router.use("/auth", authRouter);

// 2. Users & Consents
apiV1Router.use("/users", usersRouter);

// 3. Vehicles
apiV1Router.use("/vehicles", vehiclesRouter);

// 4. Challans
apiV1Router.use("/challans", challansRouter);

// 5. Score & Ledger
apiV1Router.use("/score", scoringRouter);

// 6. Rewards & Quotes
apiV1Router.use("/rewards", rewardsRouter);
apiV1Router.use("/services", servicesRouter);

// 7. Transactions & Receipts
apiV1Router.use("/transactions", transactionsRouter);

// 8. Admin APIs (RBAC: SUPER_ADMIN, OPS, ANALYST)
apiV1Router.use("/admin", adminRouter);

// 9. Direct Aliases per TRD 7.1 Catalogue:
// - /api/v1/users/me/vehicles
apiV1Router.get("/users/me/vehicles", requireCitizenAuth, (req, res, next) => {
  vehiclesController.listUserVehicles(req, res).catch(next);
});

// - /api/v1/users/me/challans
apiV1Router.get("/users/me/challans", requireCitizenAuth, (req, res, next) => {
  challansController.listUserChallans(req, res).catch(next);
});

// - /api/v1/users/me/score
apiV1Router.use("/users/me/score", scoringRouter);
