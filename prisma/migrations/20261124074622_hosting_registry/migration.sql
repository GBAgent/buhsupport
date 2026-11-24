-- AlterTable
ALTER TABLE "Base1C" ADD COLUMN     "login" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "billingNote" TEXT,
ADD COLUMN     "contractDate" TIMESTAMP(3),
ADD COLUMN     "contractNumber" TEXT,
ADD COLUMN     "needsCheck" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidUntil" TIMESTAMP(3),
ADD COLUMN     "payFrom" TEXT,
ADD COLUMN     "payMethod" TEXT,
ADD COLUMN     "payTo" TEXT,
ADD COLUMN     "payerId" TEXT,
ADD COLUMN     "serviceSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "payerId" TEXT,
ADD COLUMN     "source" TEXT,
ALTER COLUMN "clientId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Payer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "groupPrice" INTEGER NOT NULL DEFAULT 0,
    "paidUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payer_name_key" ON "Payer"("name");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
