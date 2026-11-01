import crypto from "node:crypto";
import type {
  PaymentAdapter,
  OrderRef,
  PaymentCaptureResult,
  PaymentRefundResult
} from "./payment.adapter.js";
import { getEnv } from "../../config/env.js";

/**
 * Simulated Payment Adapter for Prototype (TRD 13.1, P11).
 * Never calls an external gateway.
 * Refuses to run in production to prevent accidental simulated payments on real data.
 */
export class SimulatedPaymentAdapter implements PaymentAdapter {
  private ensureNonProduction(): void {
    const env = getEnv();
    if (env.NODE_ENV === "production") {
      throw new Error(
        "SimulatedPaymentAdapter is forbidden in production environment. Live gateway adapter required."
      );
    }
  }

  async createOrder(input: {
    txnId: string;
    amountPaise: bigint;
    payerRef: string;
  }): Promise<OrderRef> {
    this.ensureNonProduction();
    const orderId = `order_${input.txnId}_${crypto.randomBytes(4).toString("hex")}`;
    return {
      orderId,
      amountPaise: input.amountPaise,
      currency: "INR"
    };
  }

  async capture(
    orderId: string,
    simulatedOutcome: "SUCCESS" | "FAILURE" | "TIMEOUT" = "SUCCESS"
  ): Promise<PaymentCaptureResult> {
    this.ensureNonProduction();

    const hex = crypto.randomBytes(4).toString("hex").toUpperCase();

    if (simulatedOutcome === "FAILURE") {
      return {
        status: "FAILED",
        reference: `PAY-FAIL-${hex}`
      };
    }

    if (simulatedOutcome === "TIMEOUT") {
      return {
        status: "TIMED_OUT",
        reference: `PAY-TIMEOUT-${hex}`
      };
    }

    // Default SUCCESS
    return {
      status: "SUCCESS",
      reference: `PAY-SIM-${orderId.slice(-8)}-${hex}`
    };
  }

  async refund(
    paymentRef: string,
    _amountPaise: bigint
  ): Promise<PaymentRefundResult> {
    this.ensureNonProduction();
    const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
    return {
      status: "REFUNDED",
      reference: `REF-SIM-${paymentRef.slice(-6)}-${hex}`
    };
  }
}

export const paymentAdapter = new SimulatedPaymentAdapter();
