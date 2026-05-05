import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
function generateFiche(lang, booking) {
  if (lang === "NL") {
    return `
      <p><b>Klant:</b> ${booking.name || "-"}</p>
      <p><b>Telefoon:</b> ${booking.phone || "-"}</p>
      <p><b>Ophaaladres:</b> ${booking.pickup}</p>
      <p><b>Bestemming:</b> ${booking.dropoff}</p>
      <p><b>Datum:</b> ${booking.date || "-"}</p>
      <p><b>Voertuig:</b> ${booking.vehicle || "-"}</p>
      <p><b>Passagiers:</b> ${booking.passengers || "-"}</p>
      <p><b>Extras:</b> ${booking.extras || "-"}</p>
      <p><b>Prijs:</b> € ${booking.price || "-"}</p>
    `;
  }

  if (lang === "FR") {
    return `
      <p><b>Client:</b> ${booking.name || "-"}</p>
      <p><b>Téléphone:</b> ${booking.phone || "-"}</p>
      <p><b>Départ:</b> ${booking.pickup}</p>
      <p><b>Destination:</b> ${booking.dropoff}</p>
      <p><b>Date:</b> ${booking.date || "-"}</p>
      <p><b>Véhicule:</b> ${booking.vehicle || "-"}</p>
      <p><b>Passagers:</b> ${booking.passengers || "-"}</p>
      <p><b>Extras:</b> ${booking.extras || "-"}</p>
      <p><b>Prix:</b> € ${booking.price || "-"}</p>
    `;
  }

  return `
    <p><b>Customer:</b> ${booking.name || "-"}</p>
    <p><b>Phone:</b> ${booking.phone || "-"}</p>
    <p><b>Pickup:</b> ${booking.pickup}</p>
    <p><b>Dropoff:</b> ${booking.dropoff}</p>
    <p><b>Date:</b> ${booking.date || "-"}</p>
    <p><b>Vehicle:</b> ${booking.vehicle || "-"}</p>
    <p><b>Passengers:</b> ${booking.passengers || "-"}</p>
    <p><b>Extras:</b> ${booking.extras || "-"}</p>
    <p><b>Price:</b> € ${booking.price || "-"}</p>
  `;
}
const labels = {
  EN: {
    customer: "Customer",
    phone: "Phone",
    vehicle: "Vehicle",
    type: "Type",
    passengers: "Passengers",
    extras: "Extras",
    route: "Route",
    pickup: "Pickup",
    dropoff: "Dropoff",
    date: "Date",
    flight: "Flight",
    waiting: "Waiting",
    price: "Total Price"
  },
  NL: {
    customer: "Klant",
    phone: "Telefoon",
    vehicle: "Voertuig",
    type: "Type",
    passengers: "Passagiers",
    extras: "Extras",
    route: "Route",
    pickup: "Ophaaladres",
    dropoff: "Bestemming",
    date: "Datum",
    flight: "Vlucht",
    waiting: "Wachttijd",
    price: "Totaalprijs"
  },
  FR: {
    customer: "Client",
    phone: "Téléphone",
    vehicle: "Véhicule",
    type: "Type",
    passengers: "Passagers",
    extras: "Extras",
    route: "Trajet",
    pickup: "Départ",
    dropoff: "Destination",
    date: "Date",
    flight: "Vol",
    waiting: "Attente",
    price: "Prix total"
  }
};
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
console.log("BODY:", req.body);
  try {
    // ✅ Handle body safely (string or object)
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

  const driverEmail = body.driverEmail;
const driverLang = body.driverLang || "EN";
const lang = (driverLang || "EN").toUpperCase();
const t = labels[lang] || labels.EN;
const booking = body.booking || {};

const subjectPrefix =
  lang === "NL" ? "Nieuwe rit" :
  lang === "FR" ? "Nouvelle course" :
  "New ride";

const subject = `🚖 ${subjectPrefix} • ${booking.pickup} → ${booking.dropoff}`;
  

    // ✅ Validation
    if (!driverEmail || !booking.pickup || !booking.dropoff) {
      return res.status(400).json({
        error: "Missing required fields",
        received: body,
      });
    }

    const LOGO_URL =
      "https://raw.githubusercontent.com/ryzenoutsourcing/FleetconnectFinal/main/ChatGPT%20Image%20Apr%2027%2C%202026%2C%2011_35_23%20AM.png";

    // 📍 Google Maps
    const mapsLink = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      booking.pickup
    )}&destination=${encodeURIComponent(booking.dropoff)}`;
const headerSubtitle =
  lang === "NL" ? "Boekingsfiche & Dispatch" :
  lang === "FR" ? "Fiche de réservation & Dispatch" :
  "Booking Fiche & Dispatch";

    const bookingId = booking.id ?? "no-id";
    
   const html = `
<div style="font-family:Arial;background:#f1f5f9;padding:20px;">
  <div style="max-width:800px;margin:auto;background:white;border-radius:12px;overflow:hidden;">

    <!-- HEADER -->
 <div style="background:#1e6f8c;color:white;padding:20px;text-align:center;">
  <img src="${LOGO_URL}" style="height:40px;margin-bottom:10px;" />
  <h2 style="margin:0;">FleetConnect</h2>
  <p style="margin:0;font-size:12px;">${headerSubtitle}</p>
</div>

    <!-- BODY -->
    <div style="padding:20px;">

      <h3 style="text-align:center;color:#1e6f8c;">${booking.id || "Booking"}</h3>

<table width="100%" style="font-size:14px;">
  <tr>

    <!-- LEFT -->
    <td width="50%" valign="top" style="padding-right:15px;">

    <h4 style="color:#1e6f8c;">👤 ${t.customer}</h4>
<p><b>${t.customer}:</b> ${booking.name || "-"}</p>
<p><b>${t.phone}:</b> ${booking.phone || "-"}</p>

      <h4 style="color:#1e6f8c;margin-top:15px;">🚗 ${t.vehicle}</h4>
    <p><b>${t.vehicle}:</b> ${booking.vehicle || "-"}</p>
      <p><b>${t.passengers}:</b> ${booking.passengers || "-"}</p>

      <h4 style="color:#1e6f8c;margin-top:15px;">➕ ${t.extras}</h4>
      <p>${booking.extras || "-"}</p>

    </td>

    <!-- RIGHT -->
    <td width="50%" valign="top">

      <h4 style="color:#1e6f8c;">📍 ${t.route}</h4>
      <p><b>${t.pickup}:</b> ${booking.pickup}</p>
      <p><b>${t.dropoff}:</b> ${booking.dropoff}</p>
      <p><b>${t.date}:</b> ${booking.date || "-"}</p>

      <h4 style="color:#1e6f8c;margin-top:15px;">✈ ${t.flight}</h4>
      <p><b>${t.flight}:</b> ${booking.flight || "-"}</p>
      <p><b>${t.waiting}:</b> ${booking.waiting || "-"}</p>

    </td>

  </tr>
</table>

      <!-- PRICE BLOCK -->
      <div style="background:#111;color:white;padding:15px;border-radius:8px;margin-top:20px;">
        <h2 style="margin:0;">€ ${booking.price || "-"}</h2>
        <p style="margin:0;font-size:12px;">${t.price}</p>
      </div>

      <!-- MAP BUTTON -->
   <div style="margin-top:20px;">
  <a href="${mapsLink}" style="background:#1e6f8c;color:white;padding:10px 15px;text-decoration:none;border-radius:6px;">
    ${lang === "NL" ? "📍 Openen in Google Maps" : lang === "FR" ? "📍 Ouvrir dans Google Maps" : "📍 Open in Google Maps"}
  </a>
</div>

      <!-- ACTIONS -->
      <div style="margin-top:20px;">
  <a href="https://fleetconnect-three.vercel.app/api/accept?id=${bookingId}" 
style="background:#16a34a;color:white;padding:10px 15px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
${lang === "NL" ? "✅ Accepteren" : lang === "FR" ? "✅ Accepter" : "✅ Accept"}
</a>

<a href="https://fleetconnect-three.vercel.app/api/decline?id=${bookingId}" 
style="background:#dc2626;color:white;padding:10px 15px;border-radius:6px;text-decoration:none;margin-left:10px;display:inline-block;">
${lang === "NL" ? "❌ Weigeren" : lang === "FR" ? "❌ Refuser" : "❌ Decline"}
</a>
      </div>

    <!-- FULL MULTILANGUAGE FICHE -->

    <!-- FOOTER -->
    <div style="text-align:center;padding:10px;font-size:12px;color:#888;">
      FleetConnect Dispatch System
    </div>

  </div>
</div>
`;
    
   await resend.emails.send({
  from: "FleetConnect <onboarding@resend.dev>",
  to: driverEmail,
  reply_to: "fleetconnect.os@gmail.com",
  subject,
  html,
});

    console.log("EMAIL SENT");

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("EMAIL ERROR:", err);

    return res.status(500).json({
      error: "Email failed",
      details: err.message,
    });
  }

}
