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
    // 3. Fetch booking for ownership check
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    // 4. Enterprise Security Validation
    if (booking.driver_id !== dId) {
      console.warn(`Decline Forbidden: Driver mismatch for booking ${id}.`);
      return res.status(403).json({ success: false, error: "Forbidden: Driver mismatch" });
    }

    if (!booking.action_token || booking.action_token !== token) {
      console.warn(`Decline Unauthorized: Token mismatch or reuse for booking ${id}.`);
      return res.status(401).json({ success: false, error: "Unauthorized or link expired" });
    }

    if (!booking.token_expires_at || new Date() > new Date(booking.token_expires_at)) {
      console.warn(`Decline expired: Booking ${id}.`);
      return res.status(401).json({ success: false, error: "Link has expired" });
    }

    // 5. Reset booking to pool and invalidate token
    const { error: resetError } = await supabase
      .from("bookings")
      .update({
        status: "pending",      // Return to pool
        driver_id: null,        // Clear driver (integer)
        action_token: null,     // Invalidate token
        token_expires_at: null, // Clear expiration
        declined_at: new Date(),
      })
      .eq("id", id)
      .eq("status", "assigned")
      .eq("action_token", token);

    if (resetError) {
      throw resetError;
    }

    console.log(`Decline success: Booking ${id} returned to pool. Token cleared.`);

    // 6. Placeholder for auto-reassign hook
    // TODO: Trigger auto-reassign logic here

    return res.status(200).json({ success: true, message: "Ride declined → returned to pool 🔁" });

  } catch (err) {
    console.error("DECLINE HANDLER ERROR:", err);
    return res.status(500).json({ success: false, error: "Decline failed", details: err.message });
  }
}
