import { ADSENSE_CLIENT, adsEnabled } from "@/lib/ads";

// /ads.txt, generated from the same environment variable that switches the
// ad slots on, so the file can never name a publisher the site is not
// actually running. A static public/ads.txt would have to be edited by hand
// and would sit there advertising a stale or unapproved publisher ID in the
// meantime.
//
// While ads are off this 404s rather than serving an empty file: an empty
// ads.txt is a positive assertion that NO seller is authorised, which is a
// different and worse claim than having no file at all.
//
// f08c47fec0942fa0 is Google's own certification authority ID, fixed for
// every AdSense publisher.
export const revalidate = 86400;

export function GET(): Response {
  if (!adsEnabled()) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const pub = ADSENSE_CLIENT.replace(/^ca-/, "");
  const body = `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
