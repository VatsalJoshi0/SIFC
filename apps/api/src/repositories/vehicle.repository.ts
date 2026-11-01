import { prisma } from "../db/client.js";
import type { Vehicle } from "@prisma/client";

export class VehicleRepository {
  async findByRegistrationNo(registrationNo: string): Promise<Vehicle | null> {
    return prisma.vehicle.findUnique({
      where: { registrationNo: registrationNo.trim().toUpperCase() }
    });
  }

  async findByVehicleId(vehicleId: string): Promise<Vehicle | null> {
    return prisma.vehicle.findUnique({
      where: { vehicleId }
    });
  }

  /**
   * Finds vehicle by registration number while enforcing ownership.
   * Returns null if vehicle doesn't exist OR belongs to another user (TRD 12.2: returns 404 on mismatch).
   */
  async findOwnedByRegNo(registrationNo: string, userId: string): Promise<Vehicle | null> {
    const vehicle = await this.findByRegistrationNo(registrationNo);
    if (!vehicle || vehicle.userId !== userId) {
      return null;
    }
    return vehicle;
  }

  /**
   * Finds all vehicles owned by a user.
   */
  async listByUser(userId: string): Promise<Vehicle[]> {
    return prisma.vehicle.findMany({
      where: { userId },
      orderBy: { registrationDate: "asc" }
    });
  }

  async create(data: {
    userId: string;
    registrationNo: string;
    vehicleType: string;
    manufacturer: string;
    model: string;
    registrationDate: Date;
    insuranceExpiry?: Date | null;
    pucExpiry?: Date | null;
    rcValidityTill: Date;
  }): Promise<Vehicle> {
    return prisma.vehicle.create({
      data: {
        userId: data.userId,
        registrationNo: data.registrationNo.trim().toUpperCase(),
        vehicleType: data.vehicleType,
        manufacturer: data.manufacturer,
        model: data.model,
        registrationDate: data.registrationDate,
        insuranceExpiry: data.insuranceExpiry,
        pucExpiry: data.pucExpiry,
        rcValidityTill: data.rcValidityTill
      }
    });
  }
}

export const vehicleRepository = new VehicleRepository();
