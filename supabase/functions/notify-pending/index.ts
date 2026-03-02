// ============================================================
// notify-pending — Supabase Edge Function
// Triggered by Database Webhooks on INSERT to posts / comments.
// Sends an email via Resend when a post or comment is pending review.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://www.missionsidewalk.com";
const FROM     = "MissionSidewalk <noreply@missionsidewalk.com>";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record  = payload.record;
    const table   = payload.table as "posts" | "comments";

    // Only care about pending content
    if (record.status !== "pending") {
      return ok({ skipped: "not pending" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Resolve event ID ────────────────────────────────────
    let eventId: string;

    if (table === "posts") {
      eventId = record.event_id;
    } else if (table === "comments") {
      const { data: post } = await supabase
        .from("posts")
        .select("event_id")
        .eq("id", record.post_id)
        .single();
      if (!post) return ok({ skipped: "post not found" });
      eventId = post.event_id;
    } else {
      return ok({ skipped: "unknown table" });
    }

    // ── Event + organizer ───────────────────────────────────
    const { data: event } = await supabase
      .from("events")
      .select("id, title, creator_id")
      .eq("id", eventId)
      .single();

    if (!event) return ok({ skipped: "event not found" });

    // Email lives in auth.users (service role required)
    const { data: { user: organizer } } =
      await supabase.auth.admin.getUserById(event.creator_id);

    const organizerEmail = organizer?.email;
    if (!organizerEmail) return ok({ skipped: "no organizer email" });

    // ── Poster name ─────────────────────────────────────────
    const { data: poster } = await supabase
      .from("users")
      .select("name")
      .eq("id", record.user_id)
      .single();

    const posterName     = poster?.name || "Someone";
    const rawText        = record.text || "";
    const contentPreview = rawText.length > 0
      ? rawText.slice(0, 140) + (rawText.length > 140 ? "…" : "")
      : "(image only)";
    const type     = table === "posts" ? "post" : "comment";
    const eventUrl = `${SITE_URL}/event/${event.id}`;

    // ── Send via Resend ─────────────────────────────────────
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    FROM,
        to:      organizerEmail,
        subject: `📬 New ${type} pending review — ${event.title}`,
        html:    buildEmail({ posterName, contentPreview, eventTitle: event.title, eventUrl, type }),
      }),
    });

    const data = await res.json();
    console.log("Resend response:", data);
    return ok({ sent: true, to: organizerEmail, resend: data });

  } catch (err) {
    console.error("notify-pending error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

function ok(body: object) {
  return new Response(JSON.stringify(body), { status: 200 });
}

// ── Email HTML ───────────────────────────────────────────────
function buildEmail({
  posterName,
  contentPreview,
  eventTitle,
  eventUrl,
  type,
}: {
  posterName:     string;
  contentPreview: string;
  eventTitle:     string;
  eventUrl:       string;
  type:           string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>New ${type} pending — MissionSidewalk</title>
</head>
<body style="margin:0;padding:0;background:#fdf4f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(168,85,247,0.10);">

          <!-- Header gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#ff3f8e 0%,#a855f7 100%);padding:30px 36px 26px;">
              <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.6px;">MissionSidewalk</p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.80);font-weight:500;letter-spacing:0.3px;text-transform:uppercase;">Moderation alert</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1a1a2e;">
                New ${type} waiting for review
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.5;">
                <strong style="color:#374151;">${posterName}</strong>
                submitted a ${type} on your event
                <strong style="color:#374151;">${eventTitle}</strong>.
              </p>

              <!-- Content preview card -->
              <div style="background:#fdf4f9;border-left:4px solid #ff3f8e;border-radius:0 10px 10px 0;padding:14px 18px;margin-bottom:28px;">
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;font-style:italic;">
                  &ldquo;${contentPreview}&rdquo;
                </p>
              </div>

              <!-- CTA button -->
              <a href="${eventUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#ff3f8e,#a855f7);color:#ffffff;font-size:15px;font-weight:700;padding:13px 30px;border-radius:50px;text-decoration:none;letter-spacing:-0.2px;">
                Review ${type} &rarr;
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 36px 28px;border-top:1px solid #f0e4ec;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                You received this because you are the organizer of this event.<br/>
                <a href="${SITE_URL}" style="color:#ff3f8e;text-decoration:none;">MissionSidewalk.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
