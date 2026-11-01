import type { Transaction, Vehicle, Licence, ServiceProvider, User, Refund } from "@prisma/client";
import {
  formatPaiseToINR,
  paiseToSafeNumber,
  maskMobile
} from "@vai/shared";

export interface TransactionWithRelations extends Transaction {
  user: User;
  vehicle: Vehicle | null;
  licence: Licence | null;
  provider: ServiceProvider;
  refunds: Refund[];
}

export interface DeterministicReceiptData {
  receiptNumber: string;
  transactionId: string;
  timestamp: string; // ISO from transaction.createdAt (deterministic)
  serviceType: string;
  vaiCategory: string;
  citizen: {
    fullName: string;
    panMasked: string;
    mobileMasked: string;
  };
  item: {
    type: "VEHICLE" | "LICENCE";
    description: string;
    identifier: string;
  };
  provider: {
    name: string;
    serviceType: string;
  };
  pricing: {
    baseAmountPaise: number;
    discountBps: number;
    discountPaise: number;
    govtFundedPaise: number;
    payablePaise: number;
    platformFeePpm: number;
    platformFeePaise: number;
    feeMode: string;
    userTotalPaise: number;
    settlementToProviderPaise: number;
    display: {
      baseAmount: string;
      discount: string;
      govtBenefit: string;
      payableAmount: string;
      platformFee: string;
      userTotal: string;
    };
  };
  payment: {
    status: string;
    paymentRef: string | null;
  };
  refunds: Array<{
    refundId: string;
    amountPaise: number;
    feeReversedPaise: number;
    createdAt: string;
  }>;
}

export class ReceiptService {
  /**
   * Builds deterministic receipt JSON object.
   * Free of any dynamic current-time calls; uses transaction.createdAt exclusively (P11).
   */
  buildReceiptJson(txn: TransactionWithRelations): DeterministicReceiptData {
    const formattedDate = txn.createdAt.toISOString();
    const receiptNumber = `REC-${txn.txnId}`;

    let item: DeterministicReceiptData["item"];
    if (txn.vehicle) {
      item = {
        type: "VEHICLE",
        description: `${txn.vehicle.manufacturer} ${txn.vehicle.model} (${txn.vehicle.vehicleType})`,
        identifier: txn.vehicle.registrationNo
      };
    } else if (txn.licence) {
      item = {
        type: "LICENCE",
        description: `Driving Licence (${txn.licence.licenceClass})`,
        identifier: txn.licence.licenceNoMasked
      };
    } else {
      item = {
        type: "VEHICLE",
        description: txn.serviceType,
        identifier: "N/A"
      };
    }

    return {
      receiptNumber,
      transactionId: txn.txnId,
      timestamp: formattedDate,
      serviceType: txn.serviceType,
      vaiCategory: txn.vaiCategoryAtTxn,
      citizen: {
        fullName: txn.user.fullName,
        panMasked: txn.user.panMasked,
        mobileMasked: maskMobile(txn.user.mobileE164)
      },
      item,
      provider: {
        name: txn.provider.name,
        serviceType: txn.provider.serviceType
      },
      pricing: {
        baseAmountPaise: paiseToSafeNumber(txn.baseAmountPaise),
        discountBps: txn.discountBps,
        discountPaise: paiseToSafeNumber(txn.discountPaise),
        govtFundedPaise: paiseToSafeNumber(txn.govtFundedPaise),
        payablePaise: paiseToSafeNumber(txn.payablePaise),
        platformFeePpm: txn.platformFeePpm,
        platformFeePaise: paiseToSafeNumber(txn.platformFeePaise),
        feeMode: txn.feeMode,
        userTotalPaise: paiseToSafeNumber(txn.userTotalPaise),
        settlementToProviderPaise: paiseToSafeNumber(txn.settlementToProviderPaise),
        display: {
          baseAmount: formatPaiseToINR(txn.baseAmountPaise),
          discount: formatPaiseToINR(txn.discountPaise),
          govtBenefit: formatPaiseToINR(txn.govtFundedPaise),
          payableAmount: formatPaiseToINR(txn.payablePaise),
          platformFee: formatPaiseToINR(txn.platformFeePaise),
          userTotal: formatPaiseToINR(txn.userTotalPaise)
        }
      },
      payment: {
        status: txn.status,
        paymentRef: txn.paymentRef
      },
      refunds: txn.refunds.map((r) => ({
        refundId: r.refundId,
        amountPaise: paiseToSafeNumber(r.amountPaise),
        feeReversedPaise: paiseToSafeNumber(r.feeReversedPaise),
        createdAt: r.createdAt.toISOString()
      }))
    };
  }

  /**
   * Generates a deterministic printable PDF format.
   * Constructed as a valid, deterministic PDF byte buffer without any dynamic date metadata.
   */
  buildReceiptPdf(receipt: DeterministicReceiptData): Buffer {
    // Generate deterministic ASCII representation for PDF stream
    const contentLines = [
      `VAI (Vehicle Accountability Index) Official Receipt`,
      `Receipt No: ${receipt.receiptNumber}`,
      `Transaction ID: ${receipt.transactionId}`,
      `Date (UTC): ${receipt.timestamp}`,
      `----------------------------------------------------`,
      `Citizen: ${receipt.citizen.fullName} (${receipt.citizen.panMasked})`,
      `Mobile: ${receipt.citizen.mobileMasked}`,
      `Service: ${receipt.serviceType} Renewal`,
      `Item: ${receipt.item.description} [${receipt.item.identifier}]`,
      `Provider: ${receipt.provider.name}`,
      `VAI Category: ${receipt.vaiCategory}`,
      `----------------------------------------------------`,
      `Base Amount:         ${receipt.pricing.display.baseAmount}`,
      `VAI Discount:       -${receipt.pricing.display.discount} (${receipt.pricing.discountBps / 100}%)`,
      `Govt Funded Benefit: ${receipt.pricing.display.govtBenefit}`,
      `User Payable:        ${receipt.pricing.display.payableAmount}`,
      `Platform Fee:        ${receipt.pricing.display.platformFee} (${receipt.pricing.platformFeePpm} ppm, ${receipt.pricing.feeMode})`,
      `User Total:          ${receipt.pricing.display.userTotal}`,
      `Payment Status:      ${receipt.payment.status} (Ref: ${receipt.payment.paymentRef ?? "N/A"})`,
      `----------------------------------------------------`,
      `Simulated Prototype Receipt - Not a Government Document`
    ];

    const textStream = contentLines
      .map((line, idx) => `BT /F1 10 Tf 50 ${750 - idx * 20} Td (${escapePdfText(line)}) Tj ET`)
      .join("\n");

    const streamLength = Buffer.byteLength(textStream, "ascii");

    // Standard minimal deterministic PDF 1.4 template
    const pdfSource = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${textStream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000229 00000 n 
${(300 + streamLength).toString().padStart(10, "0")} 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${(370 + streamLength).toString()}
%%EOF`;

    return Buffer.from(pdfSource, "utf-8");
  }
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export const receiptService = new ReceiptService();
