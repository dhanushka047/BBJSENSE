-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mac_address" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'New Device',
    "nickname" TEXT DEFAULT '',
    "owner_id" TEXT,
    "approval_status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" TEXT,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" DATETIME,
    "modbus_address" TEXT DEFAULT '0x01',
    "wifi_max_disconnect_time" INTEGER NOT NULL DEFAULT 900,
    "led_disabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Device_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Device_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Device" ("approval_status", "approved_by", "created_at", "id", "is_online", "last_seen_at", "mac_address", "modbus_address", "name", "nickname", "owner_id", "updated_at", "wifi_max_disconnect_time") SELECT "approval_status", "approved_by", "created_at", "id", "is_online", "last_seen_at", "mac_address", "modbus_address", "name", "nickname", "owner_id", "updated_at", "wifi_max_disconnect_time" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";
CREATE UNIQUE INDEX "Device_mac_address_key" ON "Device"("mac_address");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
