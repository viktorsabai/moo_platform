-- Add PENDING status for owner-confirmed subscription checkout
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PENDING';
