import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Environment Validation
const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "API_SECRET"];
for (const env of requiredEnv) {
  if (!process.env[env]) {
    throw new Error(`CRITICAL ERROR: Environment variable ${env} is not set.`);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // 1. Strict Method Handling
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
  }

  // 2. Input Validation & Logging
 const bookingId = String(req.body.bookingId).trim();
const driverId = parseInt(req.body.driverId, 10);

if (!bookingId || isNaN(driverId)) {
    return res.status(400).json({ success: false, error: "Invalid bookingId or driverId" });
  }

  console.log("Assign bookingId:", bookingId);
  console.log("Assign driverId:", driverId);

  try {
    const baseUrl = process.env.BASE_URL || "https://fleetconnect-three.vercel.app";

    // 3. Validate Driver Existence
    const { data: driver, error: driverError } = await supabase
      .from("chauffeurs")
      .select("*")
      .eq("id", driverId)
      .single();

    if (driverError || !driver) {
      console.warn(`Assignment blocked: Driver ${driverId} not found.`);
      return res.status(404).json({ success: false, error: "Driver not found" });
    }

    // 4. Generate secure token with expiration (15 minutes)
    const actionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // 5. Assign booking with state check (FIXED: REMOVED .single())
    const { data, error: assignError } = await supabase
      .from("bookings")
      .update({
        driver_id: driverId,
        assigned_at: new Date(),
        status: "assigned",
        action_token: actionToken,
        token_expires_at: expiresAt.toISOString()
      })
      .eq("id", bookingId)
      .eq("status", "pending") // Security: only assign if still pending
      .select();

    if (assignError) {
      console.error("Assignment DB error:", assignError);
      return res.status(500).json({
        success: false,
        error: "Database assignment failed",
        details: assignError.message
      });
    }

    if (!data || data.length === 0) {
      console.warn("Assignment blocked or booking not found:", bookingId);
      return res.status(404).json({
        success: false,
        error: "Booking not found or already assigned",
        details: "No matching pending booking found"
      });
    }

    const booking = data[0];
    console.log(`Assignment success: Booking ${bookingId} assigned to driver ${driverId}`);

    // 6. Trigger Email with Rollback Safety
    try {
      const emailRes = await fetch(`${baseUrl}/api/send-driver-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.API_SECRET}`
        },
        body: JSON.stringify({
          driverId: driverId,
          actionToken: actionToken,
          booking: {
            id: booking.id,
            pickup: booking.pickup || "N/A",
            dropoff: booking.destination || "N/A",
            name: booking.name || "-",
            phone: booking.phone || "-",
            date: booking.datetime || "-",
            time: booking.time || "",
            vehicle: booking.vehicle || "-",
            passengers: booking.passengers || "1",
            extras: booking.extras || "-",
            price: booking.amount || "0",
            template: booking.template || "T1",
            flight: booking.flight_number || ""
          }
        }),
      });

      if (!emailRes.ok) {
        throw new Error(`Email API returned ${emailRes.status}`);
      }
      
      console.log(`Email successfully dispatched for booking ${bookingId}`);

    } catch (emailErr) {
      console.error(`CRITICAL: Email failed. Rolling back assignment for booking ${bookingId}. Reason: ${emailErr.message}`);
      
      // Rollback database state
      await supabase
        .from("bookings")
        .update({
          status: "pending",
          driver_id: null,
          action_token: null,
          token_expires_at: null,
          assigned_at: null
        })
        .eq("id", bookingId);

      return res.status(502).json({ success: false, error: "Email failure", details: "Assignment rolled back due to email failure" });
    }

    return res.status(200).json({ success: true, bookingId: booking.id });

  } catch (err) {
    console.error("UNEXPECTED ASSIGN HANDLER ERROR:", err);
    return res.status(500).json({ success: false, error: "Internal server error", details: err.message });
  }
}
