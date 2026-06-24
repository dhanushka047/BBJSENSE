-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL DEFAULT '',
    "last_name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "factory_name" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "subscription_status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    CONSTRAINT "UserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Device" (
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Device_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Device_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceChannelConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "channel_type" TEXT NOT NULL,
    "channel_number" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "data_mode" TEXT DEFAULT '0-10V',
    "unit" TEXT DEFAULT '',
    "min_value" REAL DEFAULT 0,
    "max_value" REAL DEFAULT 10,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "DeviceChannelConfig_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "analog_ch1" REAL DEFAULT 0,
    "analog_ch1_mode" TEXT DEFAULT '0-10V',
    "analog_ch2" REAL DEFAULT 0,
    "analog_ch2_mode" TEXT DEFAULT '0-10V',
    "analog_ch3" REAL DEFAULT 0,
    "analog_ch3_mode" TEXT DEFAULT '0-10V',
    "analog_ch4" REAL DEFAULT 0,
    "analog_ch4_mode" TEXT DEFAULT '0-10V',
    "digital_in1" BOOLEAN DEFAULT false,
    "digital_in2" BOOLEAN DEFAULT false,
    "digital_in3" BOOLEAN DEFAULT false,
    "digital_in4" BOOLEAN DEFAULT false,
    "digital_out1" BOOLEAN DEFAULT false,
    "digital_out2" BOOLEAN DEFAULT false,
    "digital_out3" BOOLEAN DEFAULT false,
    "digital_out4" BOOLEAN DEFAULT false,
    "rtc_time" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceReading_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "triggered_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceEvent_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeviceEvent_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "email_on_offline" BOOLEAN NOT NULL DEFAULT true,
    "email_on_alert" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "NotificationPreference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DatabaseSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "snapshot_data" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatabaseSnapshot_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModbusDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT DEFAULT '',
    "slave_id" INTEGER NOT NULL DEFAULT 1,
    "baud_rate" INTEGER NOT NULL DEFAULT 9600,
    "parity" TEXT NOT NULL DEFAULT 'none',
    "stop_bits" INTEGER NOT NULL DEFAULT 1,
    "data_bits" INTEGER NOT NULL DEFAULT 8,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ModbusDevice_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModbusRegister" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modbus_device_id" TEXT NOT NULL,
    "address" INTEGER NOT NULL,
    "function_code" INTEGER NOT NULL DEFAULT 3,
    "label" TEXT NOT NULL,
    "data_type" TEXT NOT NULL DEFAULT 'float32_be',
    "scale" REAL NOT NULL DEFAULT 1.0,
    "unit" TEXT DEFAULT '',
    "group_name" TEXT DEFAULT '',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ModbusRegister_modbus_device_id_fkey" FOREIGN KEY ("modbus_device_id") REFERENCES "ModbusDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModbusReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modbus_device_id" TEXT NOT NULL,
    "register_id" TEXT NOT NULL,
    "raw_value" TEXT DEFAULT '',
    "scaled_value" REAL DEFAULT 0.0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModbusReading_modbus_device_id_fkey" FOREIGN KEY ("modbus_device_id") REFERENCES "ModbusDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ModbusReading_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "ModbusRegister" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_user_id_key" ON "Profile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_user_id_role_key" ON "UserRole"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Device_mac_address_key" ON "Device"("mac_address");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceChannelConfig_device_id_channel_type_channel_number_key" ON "DeviceChannelConfig"("device_id", "channel_type", "channel_number");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_user_id_key" ON "NotificationPreference"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ModbusRegister_modbus_device_id_address_function_code_key" ON "ModbusRegister"("modbus_device_id", "address", "function_code");
