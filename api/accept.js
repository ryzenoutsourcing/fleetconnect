import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) return res.status(400).send("Missing ID");

  const { data } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) return res.status(404).send("Not found");

  if (data.status === "accepted") {
    return res.send("Already accepted");
  }

  await supabase
    .from("bookings")
    .update({
      status: "accepted",
      accepted_at: new Date()
    })
    .eq("id", id);

  return res.send("Ride accepted ✅");
}
