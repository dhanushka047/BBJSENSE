import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Clear existing data
  console.log("🧹 Clearing existing database records...");
  await prisma.deviceReading.deleteMany({});
  await prisma.deviceEvent.deleteMany({});
  await prisma.deviceChannelConfig.deleteMany({});
  await prisma.modbusReading.deleteMany({});
  await prisma.modbusRegister.deleteMany({});
  await prisma.modbusDevice.deleteMany({});
  await prisma.databaseSnapshot.deleteMany({});
  await prisma.notificationPreference.deleteMany({});
  await prisma.profile.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Hash passwords
  const adminPasswordHashed = await bcrypt.hash("admin123", 10);
  const userPasswordHashed = await bcrypt.hash("user123", 10);

  // 3. Seed Admin Account
  console.log("👥 Seeding users and profiles...");
  const admin = await prisma.user.create({
    data: {
      email: "admin@bbjsense.com",
      password: adminPasswordHashed,
      profile: {
        create: {
          first_name: "System",
          last_name: "Admin",
          email: "admin@bbjsense.com",
          factory_name: "BBJSENSE HQ",
          location: "San Francisco, USA",
          subscription_status: "active",
        },
      },
      roles: {
        create: {
          role: "super_admin",
        },
      },
      notificationPreferences: {
        create: {},
      },
    },
  });

  // 4. Seed Regular User Account
  const user = await prisma.user.create({
    data: {
      email: "user@bbjsense.com",
      password: userPasswordHashed,
      profile: {
        create: {
          first_name: "John",
          last_name: "Doe",
          email: "user@bbjsense.com",
          factory_name: "Doe Manufacturing",
          location: "Detroit, USA",
          subscription_status: "active",
        },
      },
      roles: {
        create: {
          role: "user",
        },
      },
      notificationPreferences: {
        create: {},
      },
    },
  });

  console.log("✅ Seeded accounts:");
  console.log("   - Admin: admin@bbjsense.com / admin123");
  console.log("   - User:  user@bbjsense.com / user123");

  // 5. Seed Approved Device
  console.log("📟 Seeding devices...");
  const device1 = await prisma.device.create({
    data: {
      mac_address: "00:1A:2B:3C:4D:5E",
      name: "Gateway Node A",
      nickname: "Factory Floor Gateway",
      owner_id: user.id,
      approval_status: "approved",
      approved_by: admin.id,
      is_online: true,
      last_seen_at: new Date(),
      modbus_address: "0x01",
    },
  });

  // Seed Channel Configs for Device 1
  await prisma.deviceChannelConfig.createMany({
    data: [
      {
        device_id: device1.id,
        channel_type: "analog",
        channel_number: 1,
        label: "Main Boiler Temp",
        data_mode: "4-20mA",
        unit: "°C",
        min_value: 0,
        max_value: 150,
      },
      {
        device_id: device1.id,
        channel_type: "analog",
        channel_number: 2,
        label: "Line 1 Pressure",
        data_mode: "0-10V",
        unit: "bar",
        min_value: 0,
        max_value: 16,
      },
      {
        device_id: device1.id,
        channel_type: "analog",
        channel_number: 3,
        label: "Flow Meter Sensor",
        data_mode: "0-10V",
        unit: "L/min",
        min_value: 0,
        max_value: 100,
      },
      {
        device_id: device1.id,
        channel_type: "analog",
        channel_number: 4,
        label: "Aux Voltage Feedback",
        data_mode: "0-10V",
        unit: "V",
        min_value: 0,
        max_value: 24,
      },
      {
        device_id: device1.id,
        channel_type: "digital_in",
        channel_number: 1,
        label: "Conveyor Safety Gate",
      },
      {
        device_id: device1.id,
        channel_type: "digital_in",
        channel_number: 2,
        label: "High Water Level Sensor",
      },
      {
        device_id: device1.id,
        channel_type: "digital_out",
        channel_number: 1,
        label: "Primary Extractor Fan",
      },
      {
        device_id: device1.id,
        channel_type: "digital_out",
        channel_number: 2,
        label: "Siren Alarm Beacon",
      },
    ],
  });

  // Seed Pending Device
  const device2 = await prisma.device.create({
    data: {
      mac_address: "00:1A:2B:3C:4D:6F",
      name: "Gateway Node B",
      nickname: "Warehouse Climate Monitor",
      owner_id: user.id,
      approval_status: "pending",
      is_online: false,
      modbus_address: "0x02",
    },
  });

  // Seed Rejected Device
  await prisma.device.create({
    data: {
      mac_address: "00:1A:2B:3C:4D:7A",
      name: "Gateway Node C",
      nickname: "Legacy Assembly Line",
      owner_id: user.id,
      approval_status: "rejected",
      is_online: false,
      modbus_address: "0x03",
    },
  });

  // 6. Seed Readings for Device 1 (Factory Floor Gateway)
  console.log("📈 Seeding historical telemetry readings...");
  const readingsData = [];
  const baseTime = new Date();

  // Create 20 readings spanning the last 10 hours (every 30 mins)
  for (let i = 20; i >= 0; i--) {
    const readingTime = new Date(baseTime.getTime() - i * 30 * 60 * 1000);
    
    // Generate realistic fluctuating telemetry curves
    const progressFactor = (20 - i) / 20;
    const tempVal = 75.0 + Math.sin(progressFactor * Math.PI * 2) * 8.0 + Math.random() * 2.0;
    const pressureVal = 6.2 + Math.cos(progressFactor * Math.PI * 2) * 1.5 + Math.random() * 0.4;
    const flowVal = 45.0 + Math.sin(progressFactor * Math.PI * 4) * 5.0 + Math.random() * 3.0;
    const voltVal = 23.4 + Math.random() * 0.4;

    readingsData.push({
      device_id: device1.id,
      analog_ch1: tempVal,
      analog_ch1_mode: "4-20mA",
      analog_ch2: pressureVal,
      analog_ch2_mode: "0-10V",
      analog_ch3: flowVal,
      analog_ch3_mode: "0-10V",
      analog_ch4: voltVal,
      analog_ch4_mode: "0-10V",
      digital_in1: Math.random() > 0.8,
      digital_in2: Math.random() > 0.95,
      digital_out1: Math.random() > 0.5,
      digital_out2: false,
      rtc_time: readingTime,
      created_at: readingTime,
    });
  }

  await prisma.deviceReading.createMany({
    data: readingsData,
  });

  // 7. Seed Events
  console.log("📋 Seeding system events log...");
  await prisma.deviceEvent.createMany({
    data: [
      {
        device_id: device1.id,
        event_type: "info",
        message: "Device registration requested.",
        triggered_by: user.id,
        created_at: new Date(baseTime.getTime() - 12 * 60 * 60 * 1000),
      },
      {
        device_id: device1.id,
        event_type: "info",
        message: "Device approved by Administrator.",
        triggered_by: admin.id,
        created_at: new Date(baseTime.getTime() - 11.5 * 60 * 60 * 1000),
      },
      {
        device_id: device1.id,
        event_type: "info",
        message: "Telemetry transmission link established.",
        created_at: new Date(baseTime.getTime() - 10 * 60 * 60 * 1000),
      },
      {
        device_id: device2.id,
        event_type: "info",
        message: "Device registration requested for Warehouse Monitor.",
        triggered_by: user.id,
        created_at: new Date(baseTime.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        device_id: device1.id,
        event_type: "alert",
        message: "Main Boiler Temp threshold exceeded! Reading: 85.3 °C (Max: 80.0 °C)",
        created_at: new Date(baseTime.getTime() - 1.5 * 60 * 60 * 1000),
      },
    ],
  });

  console.log("🌱 Database successfully seeded.");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
