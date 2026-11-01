import { prisma } from "../db/client.js";
import type { User } from "@prisma/client";
import { encryptPan, hashPan } from "../lib/crypto.js";
import { maskPan } from "@vai/shared";

export interface CreateUserInput {
  mobileE164: string;
  pan: string; // raw PAN passed in memory, immediately encrypted & hashed
  fullName: string;
  city: string;
  state: string;
  registrationDate: Date;
  isDummy?: boolean;
}

export class UserRepository {
  /**
   * Finds user by HMAC-SHA256 hash of normalized PAN (TRD 6.4, 12.1).
   * Lookup without decrypting PAN.
   */
  async findByPanHash(panHash: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { panHash }
    });
  }

  /**
   * Finds user by raw PAN (hashes in-memory).
   */
  async findByPan(rawPan: string): Promise<User | null> {
    const hash = hashPan(rawPan);
    return this.findByPanHash(hash);
  }

  /**
   * Finds user by E.164 mobile number.
   */
  async findByMobile(mobileE164: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { mobileE164 }
    });
  }

  /**
   * Finds user by userId.
   */
  async findById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { userId }
    });
  }

  /**
   * Creates a new user with encrypted PAN, HMAC lookup hash, and masked display PAN.
   */
  async create(input: CreateUserInput): Promise<User> {
    const panEncrypted = encryptPan(input.pan);
    const panHash = hashPan(input.pan);
    const panMasked = maskPan(input.pan);

    return prisma.user.create({
      data: {
        mobileE164: input.mobileE164,
        panEncrypted,
        panHash,
        panMasked,
        fullName: input.fullName,
        city: input.city,
        state: input.state,
        registrationDate: input.registrationDate,
        isDummy: input.isDummy ?? true,
        status: "ACTIVE"
      }
    });
  }

  /**
   * Seed guard per TRD 18 and spec patch P1:
   * Refuses to delete any user or related records where is_dummy is false.
   */
  async deleteDummyUser(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) return false;

    if (!user.isDummy) {
      throw new Error(`SECURITY ALERT: Attempted to delete non-dummy user ${userId}. Operation aborted.`);
    }

    await prisma.user.delete({ where: { userId } });
    return true;
  }

  /**
   * Resets all dummy users. Guarded by is_dummy = true.
   */
  async resetAllDummyUsers(): Promise<number> {
    // Confirm no real data is touched
    const realUsersCount = await prisma.user.count({ where: { isDummy: false } });
    if (realUsersCount > 0) {
      throw new Error("Cannot reset dataset: non-dummy (real) records exist in the database.");
    }

    const { count } = await prisma.user.deleteMany({ where: { isDummy: true } });
    return count;
  }
}

export const userRepository = new UserRepository();
