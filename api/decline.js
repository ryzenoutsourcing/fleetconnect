import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).send("Missing ID");
  }

  try {
    const { error } = await supabase
      .from("bookings")
      .update({
        status: "pending",      // 🔥 send back to pool
        driver_id: null,
        declined_at: new Date(),
      })
      .eq("id", id);

    if (error) throw error;

    return res.send("Ride declined → reassigned 🔁");

  } catch (err) {
    return res.status(500).send(err.message);
  }
}
