import { createClient } from "@supabase/supabase-js";

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
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed. Use GET." });
  }

  const { id, token, driverId } = req.query;

  // 2. Input Validation
  if (!id || !token || isNaN(parseInt(driverId))) {
    return res.status(400).json({ success: false, error: "Invalid request parameters" });
  }

  const dId = parseInt(driverId);

  try {
    // 3. Fetch booking for ownership validation
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !booking) {
      console.error(`Accept failed: Booking ${id} not found.`);
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    // 4. Enterprise Security Validation
    // A) Driver Ownership check
    if (booking.driver_id !== dId) {
      console.warn(`Driver mismatch for booking ${id}. Expected ${booking.driver_id}, got ${dId}`);
      return res.status(403).json({ success: false, error: "Forbidden: Driver mismatch" });
    }

    // B) Token validation
    if (!booking.action_token || booking.action_token !== token) {
      console.warn(`Invalid or reused token for booking ${id}.`);
      return res.status(401).json({ success: false, error: "Unauthorized or link expired" });
    }

    // C) Token Expiration check
    if (!booking.token_expires_at || new Date() > new Date(booking.token_expires_at)) {
      console.warn(`Expired token attempt for booking ${id}.`);
      return res.status(401).json({ success: false, error: "Link has expired (15 min limit)" });
    }

    // 5. Handling terminal state
    if (booking.status === "accepted") {
      return res.status(200).json({ success: true, message: "Ride already accepted" });
    }

    // 6. Secure Update with status protection and token invalidation
    const { data, error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "accepted",
        accepted_at: new Date(),
        action_token: null,       // Clear token
        token_expires_at: null    // Clear expiration
      })
      .eq("id", id)
      .eq("status", "assigned")
      .eq("action_token", token)
      .select();

    if (updateError) {
      throw updateError;
    }

    if (!data || data.length === 0) {
      console.warn(`Accept conflict for booking ${id}: race condition or status mismatch.`);
      return res.status(409).json({ success: false, error: "Conflict: Ride already handled" });
    }

    console.log(`Accept success: Booking ${id} confirmed by driver ${dId}`);
    return res.status(200).json({ success: true, message: "Ride accepted ✅" });

  } catch (err) {
    console.error("ACCEPT HANDLER ERROR:", err);
    return res.status(500).json({ success: false, error: "Accept failed", details: err.message });
  }
}
