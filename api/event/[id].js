// api/event/[id].js
// Vercel serverless function: intercepts /event/:id requests and injects
// event-specific Open Graph meta tags so WhatsApp, iMessage, Telegram,
// Instagram etc. can render a rich preview card with the event image.
// Regular users receive the same HTML — the React SPA hydrates normally.

import { readFileSync } from "fs";
import { join } from "path";

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

export default async function handler(req, res) {
  const { id } = req.query;

  // ── Load built SPA shell ────────────────────────────────────────────────
  // `includeFiles` in vercel.json bundles dist/index.html with this function.
  let baseHtml;
  try {
    baseHtml = readFileSync(join(process.cwd(), "dist", "index.html"), "utf-8");
  } catch {
    res.status(404).send("Not found");
    return;
  }

  // ── Fetch event data from Supabase REST ─────────────────────────────────
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // Env vars missing (local dev?) — serve plain SPA
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(baseHtml);
      return;
    }

    const apiUrl =
      `${supabaseUrl}/rest/v1/public_events_feed` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=id,title,description,image_url,location,event_date,category` +
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
      res.send(baseHtml);
      return;
    }

    // ── Build OG metadata ───────────────────────────────────────────────
    const title = event.title || "Event";
    const description =
      stripHtml(event.description || "").slice(0, 160) ||
      `${title} — VibeCultural`;
    const image = event.image_url || "";
    const pageUrl = `https://vibe-usasf.vercel.app/event/${id}`;

    // These tags are injected at the TOP of <head> so they take priority
    // over the generic site-level OG tags already in index.html.
    const ogBlock = [
      `<title>${escapeHtml(title)} — VibeCultural</title>`,
      `<meta name="description" content="${escapeHtml(description)}" />`,
      // Open Graph (WhatsApp, Facebook, iMessage, Telegram, Slack …)
      `<meta property="og:type" content="article" />`,
      `<meta property="og:url" content="${pageUrl}" />`,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      image
        ? `<meta property="og:image" content="${escapeHtml(image)}" />`
        : "",
      `<meta property="og:site_name" content="VibeCultural" />`,
      `<meta property="og:locale" content="pt_BR" />`,
      // Twitter / X Card
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
      image
        ? `<meta name="twitter:image" content="${escapeHtml(image)}" />`
        : "",
    ]
      .filter(Boolean)
      .join("\n  ");

    // Inject right after <head> so event tags come first
    const html = baseHtml.replace("<head>", `<head>\n  ${ogBlock}\n`);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Cache 1 h on CDN; serve stale up to 24 h while revalidating
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    res.send(html);
  } catch (err) {
    console.error("[og-handler] error:", err);
    // Always fall back to the plain SPA — never show an error page
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(baseHtml);
  }
}
