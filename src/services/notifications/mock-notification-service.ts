import type { NotificationService } from "../participation/contracts";

export class MockNotificationService implements NotificationService {
  // Deliberately no delivery, persistence, logging, or timers in development.
  sendVerificationEmail(): void {}
  sendMagicAccessLink(): void {}
  sendBondNotification(): void {}
  sendGrowthDigest(): void {}
}
