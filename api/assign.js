import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { bookingId, driverId } = req.body;

  if (!bookingId || !driverId) {
    return res.status(400).json({ error: "Missing bookingId or driverId" });
  }

  try {
    // 1. Get driver
    const { data: driver, error: driverError } = await supabase
      .from("chauffeurs")
      .select("*")
      .eq("id", driverId)
      .single();

    if (driverError) throw driverError;
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    // 2. Assign booking
    const { data: booking, error } = await supabase
      .from("bookings")
      .update({
        driver_id: driver.id,
        assigned_at: new Date(),
        status: "assigned",
      })
      .eq("id", bookingId)
      .select()
      .single();

    if (error) throw error;

    // 3. Send email
    await fetch(`${process.env.BASE_URL}/api/send-driver-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        driverEmail: driver.email,
        driverLang: driver.language || "EN",
        booking: {
  id: booking.id,
  pickup: booking.pickup,
  dropoff: booking.destination, // ✅ THIS IS THE FIX
  name: booking.name,
  phone: booking.phone,
  date: booking.datetime,
  price: booking.amount
}
      }),
    });

    return res.json({ success: true });

  } catch (err) {
    console.error("ASSIGN ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
