/**
 * Payment Adapter Interface (TRD 13.1).
 * Isolates simulated and live third-party payment gateways behind a common interface.
 */

export interface OrderRef {
  orderId: string;
  amountPaise: bigint;
  currency: string;
}

export interface PaymentCaptureResult {
  status: "SUCCESS" | "FAILED" | "TIMED_OUT";
  reference: string;
}

export interface PaymentRefundResult {
  status: "REFUNDED" | "FAILED";
  reference: string;
}

export interface PaymentAdapter {
  createOrder(input: {
    txnId: string;
    amountPaise: bigint;
    payerRef: string;
  }): Promise<OrderRef>;

  capture(
    orderId: string,
    simulatedOutcome?: "SUCCESS" | "FAILURE" | "TIMEOUT"
  ): Promise<PaymentCaptureResult>;

  refund(
    paymentRef: string,
    amountPaise: bigint
  ): Promise<PaymentRefundResult>;
}
