import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

// Environment Validation (STRICT)
const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "API_SECRET", "RESEND_API_KEY"];
for (const env of requiredEnv) {
  if (!process.env[env]) {
    throw new Error(`CRITICAL ERROR: Environment variable ${env} is not set.`);
  }
}

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const labels = {
  EN: {
    customer: "Customer", phone: "Phone", vehicle: "Vehicle", passengers: "Passengers",
    extras: "Extras", route: "Route", pickup: "Pickup", dropoff: "Dropoff",
    date: "Date", time: "Time", flight: "Flight", price: "Total Price",
    accept: "✅ Accept", decline: "❌ Decline", maps: "📍 Open in Google Maps"
  },
  NL: {
    customer: "Klant", phone: "Telefoon", vehicle: "Voertuig", passengers: "Passagiers",
    extras: "Extras", route: "Route", pickup: "Ophaaladres", dropoff: "Bestemming",
    date: "Datum", time: "Tijd", flight: "Vlucht", price: "Totaalprijs",
    accept: "✅ Accepteren", decline: "❌ Weigeren", maps: "📍 Openen in Google Maps"
  },
  FR: {
    customer: "Client", phone: "Téléphone", vehicle: "Véhicule", passengers: "Passagers",
    extras: "Extras", route: "Trajet", pickup: "Départ", dropoff: "Destination",
    date: "Date", time: "Heure", flight: "Vol", price: "Prix total",
    accept: "✅ Accepter", decline: "❌ Refuser", maps: "📍 Ouvrir dans Google Maps"
  }
};

export default async function handler(req, res) {
  // 1. Strict Method Handling
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
  }

  // 2. Internal API Security Check
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.API_SECRET}`) {
    console.warn("Unauthorized internal e-mail attempt (missing or invalid API_SECRET).");
    return res.status(401).json({ success: false, error: "Unauthorized internal call" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { driverId, actionToken, booking } = body;

    if (!driverId || !actionToken || !booking?.pickup || !booking?.dropoff) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // 3. Fetch driver data for localized e-mail
    const { data: driver, error: driverError } = await supabase
      .from("chauffeurs")
      .select("*")
      .eq("id", driverId)
      .single();

    if (driverError || !driver) {
      console.error(`E-mail dispatch failed: Driver ${driverId} not found.`);
      return res.status(404).json({ success: false, error: "Driver not found" });
    }

    const lang = (driver.language || "NL").toUpperCase();
    const t = labels[lang] || labels.NL;

    // 4. Dynamic Branding
    const brandingConfig = {
      T1: { name: "Maritime Link", color: "#1e6f8c", logo: "https://raw.githubusercontent.com/ryzenoutsourcing/FleetconnectFinal/main/ChatGPT%20Image%20Apr%2027%2C%202026%2C%2011_35_23%20AM.png" },
      T2: { name: "Golden Business", color: "#D4AF37", logo: "https://raw.githubusercontent.com/ryzenoutsourcing/FleetconnectFinal/main/ChatGPT%20Image%20Apr%2027%2C%202026%2C%2011_35_23%20AM.png" },
      T3: { name: "FleetConnect", color: "#2dd4bf", logo: "https://raw.githubusercontent.com/ryzenoutsourcing/FleetconnectFinal/main/ChatGPT%20Image%20Apr%2027%2C%202026%2C%2011_35_23%20AM.png" }
    };
    const brand = brandingConfig[booking.template] || brandingConfig.T3;

    // 5. Data Safety & Action Links
    const baseUrl = process.env.BASE_URL || "https://fleetconnect-three.vercel.app";
    const mapsLink = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(booking.pickup || "N/A")}&destination=${encodeURIComponent(booking.dropoff || "N/A")}`;
    
    // ACTION LINKS INCL. driverId validation
    const acceptLink = `${baseUrl}/api/accept?id=${booking.id}&token=${actionToken}&driverId=${driverId}`;
    const declineLink = `${baseUrl}/api/decline?id=${booking.id}&token=${actionToken}&driverId=${driverId}`;

    const subjectPrefix = lang === "NL" ? "Nieuwe rit" : lang === "FR" ? "Nouvelle course" : "New ride";
    const subject = `🚖 ${subjectPrefix} • ${booking.pickup || "N/A"} → ${booking.dropoff || "N/A"}`;

    const html = `
<div style="font-family:Arial,sans-serif;background:#f1f5f9;padding:20px;">
  <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:${brand.color};color:white;padding:20px;text-align:center;">
      <img src="${brand.logo}" style="height:50px;margin-bottom:10px;" />
      <h2 style="margin:0;">${brand.name}</h2>
      <p style="margin:0;font-size:14px;opacity:0.9;">Dispatch System</p>
    </div>
    <div style="padding:25px;">
      <h3 style="text-align:center;color:${brand.color};margin-bottom:20px;">Rit Details: ${booking.id || "Booking"}</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6;">
        <tr>
          <td width="50%" valign="top" style="padding-right:15px;">
            <h4 style="color:${brand.color};border-bottom:1px solid #eee;padding-bottom:5px;">👤 ${t.customer}</h4>
            <p><b>${t.customer}:</b> ${booking.name || "-"}<br><b>${t.phone}:</b> ${booking.phone || "-"}</p>
            <h4 style="color:${brand.color};border-bottom:1px solid #eee;padding-bottom:5px;margin-top:20px;">🚗 ${t.vehicle}</h4>
            <p><b>${t.vehicle}:</b> ${booking.vehicle || "-"}<br><b>${t.passengers}:</b> ${booking.passengers || "-"}</p>
          </td>
          <td width="50%" valign="top">
            <h4 style="color:${brand.color};border-bottom:1px solid #eee;padding-bottom:5px;">📍 ${t.route}</h4>
            <p><b>${t.pickup}:</b> ${booking.pickup || "N/A"}<br><b>${t.dropoff}:</b> ${booking.dropoff || "N/A"}<br><b>${t.date}:</b> ${booking.date || "-"} ${booking.time || ""}</p>
            <h4 style="color:${brand.color};border-bottom:1px solid #eee;padding-bottom:5px;margin-top:20px;">✈️ ${t.flight}</h4>
            <p><b>${t.flight}:</b> ${booking.flight || "-"}</p>
          </td>
        </tr>
      </table>
      <div style="background:#111;color:white;padding:20px;border-radius:8px;margin-top:25px;text-align:center;">
        <h2 style="margin:0;font-size:28px;">€ ${booking.price || "-"}</h2>
        <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:1px;">${t.price}</p>
      </div>
      <div style="margin-top:30px;text-align:center;">
        <a href="${mapsLink}" style="background:${brand.color};color:white;padding:12px 20px;text-decoration:none;border-radius:30px;font-weight:bold;display:inline-block;margin-bottom:20px;">${t.maps}</a>
        <div style="margin-top:10px;">
          <a href="${acceptLink}" style="background:#16a34a;color:white;padding:12px 25px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin-right:10px;">${t.accept}</a>
          <a href="${declineLink}" style="background:#dc2626;color:white;padding:12px 25px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">${t.decline}</a>
        </div>
      </div>
    </div>
    <div style="text-align:center;padding:15px;font-size:11px;color:#94a3b8;background:#f8fafc;border-top:1px solid #eee;">
      ${brand.name} Dispatch System • info@fleetconnect.be
    </div>
  </div>
</div>
`;

    const emailRes = await resend.emails.send({
      from: `${brand.name} <onboarding@resend.dev>`,
      to: driver.email,
      reply_to: "fleetconnect.os@gmail.com",
      subject,
      html,
    });

    console.log(`Email dispatched for booking ${booking.id} to ${driver.email}`);
    return res.status(200).json({ success: true, emailId: emailRes.id });

  } catch (err) {
    console.error("EMAIL HANDLER ERROR:", err);
    return res.status(500).json({ success: false, error: "Email dispatch failed", details: err.message });
  }
}
