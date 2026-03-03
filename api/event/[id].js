// api/event/[id].js
// Vercel serverless function: intercepts /event/:id requests and injects
// event-specific Open Graph meta tags so WhatsApp, iMessage, Telegram,
// Instagram etc. can render a rich preview card with the event image.
// Regular users receive the same HTML — the React SPA hydrates normally.

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Load dist/index.html with multiple fallback paths ──────────────────────
// Vercel Lambda can have different cwd values; try all known locations.
function loadBaseHtml() {
  const candidates = [
    // 1. Standard: cwd = /var/task, includeFiles bundles it here
    join(process.cwd(), "dist", "index.html"),
    // 2. ESM __dirname is /var/task/api/event — go up two levels
    join(__dirname, "..", "..", "dist", "index.html"),
    // 3. Hardcoded Vercel Lambda path
    "/var/task/dist/index.html",
    // 4. One directory above cwd
    join(process.cwd(), "..", "dist", "index.html"),
  ];

  for (const p of candidates) {
    try {
      const content = readFileSync(p, "utf-8");
      console.log("[og-handler] loaded index.html from:", p);
      return content;
    } catch {
      // try next
    }
  }
  return null;
}

// ── Fallback: fetch the base HTML over HTTP ────────────────────────────────
async function fetchBaseHtml(host) {
  try {
    const url = `https://${host}/`;
    const r = await fetch(url, { headers: { "User-Agent": "MissionSidewalk-OG-Bot/1.0" } });
    if (r.ok) {
      const text = await r.text();
      console.log("[og-handler] loaded index.html via HTTP from:", url);
      return text;
    }
  } catch (e) {
    console.error("[og-handler] HTTP fetch fallback failed:", e.message);
  }
  return null;
}

export default async function handler(req, res) {
  const { id } = req.query;
  const host = req.headers.host || "vibe-usasf.vercel.app";

  // ── Load built SPA shell ─────────────────────────────────────────────────
  let baseHtml = loadBaseHtml();
  if (!baseHtml) {
    // Last resort: fetch ourselves
    baseHtml = await fetchBaseHtml(host);
  }
  if (!baseHtml) {
    res.status(503).send("Service temporarily unavailable");
    return;
  }

  // ── Fetch event data from Supabase REST ─────────────────────────────────
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    // Always add debug header so we can verify the function is running
    res.setHeader("X-OG-Handler", "active");

    if (!supabaseUrl || !supabaseKey) {
      // Env vars missing — serve plain SPA
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-OG-Status", "no-env");
      res.send(baseHtml);
      return;
    }

    const apiUrl =
      `${supabaseUrl}/rest/v1/public_events_feed` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=id,title,description,image_url,location,city,event_date,category,is_paid,price` +
      `&limit=1`;

    const apiRes = await fetch(apiUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    const rows = apiRes.ok ? await apiRes.json() : [];
    const event = rows?.[0];

    if (!event) {
      // Unknown event — serve generic SPA shell
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-OG-Status", "event-not-found");
      res.send(baseHtml);
      return;
    }

    // ── Build OG metadata ─────────────────────────────────────────────────
    const title = event.title || "Event";

    // ── Rich, inviting description ─────────────────────────────────────────
    // Format: "Wed, Mar 4 · 5:30 PM · Horsies Market, Mission District · Free"
    // followed by a snippet of the event description — far more compelling
    // than raw body text alone.
    const descParts = [];
    if (event.event_date) {
      const d = new Date(event.event_date);
      const day = d.toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      });
      const time = d.toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true,
      });
      descParts.push(`${day} · ${time}`);
    }
    if (event.location) {
      const parts = event.location.split(",").map((s) => s.trim()).filter(Boolean);
      // "Horsies Market, 3368, Mission Street, Mission District, ..."
      // → show venue + neighbourhood (parts[0] + parts[2]) or first 2 parts
      const venueLine =
        parts.length >= 3 ? `${parts[0]}, ${parts[2]}` : parts.slice(0, 2).join(", ");
      descParts.push(venueLine);
    } else if (event.city) {
      descParts.push(event.city);
    }
    const pricePart = event.is_paid
      ? event.price ? `$${event.price}` : "Paid"
      : "Free";
    descParts.push(pricePart);

    const metaLine = descParts.join(" · ");
    const rawDesc = stripHtml(event.description || "").slice(0, 100).trim();
    const description = rawDesc
      ? `${metaLine} — ${rawDesc}`
      : metaLine || `${title} — MissionSidewalk`;

    // Use event image if available, otherwise fall back to the site OG image
    // Use the request host so the fallback works on any deployment URL
    const SITE_IMAGE = `https://${host}/og-image.jpg`;
    const image = event.image_url || SITE_IMAGE;
    const pageUrl = `https://${host}/event/${id}`;

    const ogBlock = [
      `<title>${escapeHtml(title)} — MissionSidewalk</title>`,
      `<meta name="description" content="${escapeHtml(description)}" />`,
      // Open Graph (WhatsApp, Facebook, iMessage, Telegram, Slack …)
      `<meta property="og:type" content="article" />`,
      `<meta property="og:url" content="${pageUrl}" />`,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      `<meta property="og:image" content="${escapeHtml(image)}" />`,
      // Hint dimensions so WhatsApp / iMessage render without extra fetches
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:site_name" content="MissionSidewalk" />`,
      `<meta property="og:locale" content="en_US" />`,
      // Twitter / X Card
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
      `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    ]
      .filter(Boolean)
      .join("\n  ");

    // Strip the generic site-level OG / Twitter / description tags from the
    // base HTML so there are NO duplicate meta tags after injection.
    // Some crawlers (WhatsApp, iMessage) use the LAST occurrence of a tag;
    // removing duplicates makes the event-specific block the only one present.
    const stripped = baseHtml
      .replace(/<title>[^<]*<\/title>/gi, "")
      .replace(/<meta\s[^>]*property="og:[^"]*"[^>]*\/?>/gi, "")
      .replace(/<meta\s[^>]*name="twitter:[^"]*"[^>]*\/?>/gi, "")
      .replace(/<meta\s[^>]*name="description"[^>]*\/?>/gi, "");

    // Inject event-specific block right after <head> — now the only OG tags
    const html = stripped.replace("<head>", `<head>\n  ${ogBlock}\n`);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-OG-Status", `ok:${escapeHtml(title).slice(0, 40)}`);
    // Cache 10 min on CDN; serve stale up to 1 h while revalidating
    // (shorter cache so WhatsApp picks up new events faster)
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=600, stale-while-revalidate=3600"
    );
    res.send(html);
  } catch (err) {
    console.error("[og-handler] error:", err);
    // Always fall back to the plain SPA — never show an error page
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-OG-Handler", "active");
    res.setHeader("X-OG-Status", `error:${err.message}`);
    res.send(baseHtml);
  }
}
