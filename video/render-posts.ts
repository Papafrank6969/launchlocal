// The Villa's Editor (docs/VILLA-PLAN.md). Run by .github/workflows/render-posts.yml:
// fetch DRAFTED posts from the app, render each with Remotion, upload the MP4 to
// Vercel Blob through a short-lived URL the app signs, report back.
// Env: APP_URL, CRON_SECRET.
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const { APP_URL, CRON_SECRET } = process.env;
if (!APP_URL || !CRON_SECRET) throw new Error("APP_URL and CRON_SECRET must be set");
const auth = { authorization: `Bearer ${CRON_SECRET}` };

type QueuedPost = { id: string; audience: string; hook: string; beats: string[] };

const res = await fetch(`${APP_URL}/api/cron/villa/render-queue`, { headers: auth });
if (!res.ok) throw new Error(`render-queue: HTTP ${res.status}`);
const { posts } = (await res.json()) as { posts: QueuedPost[] };
console.log(`${posts.length} post(s) to render`);

const results: ({ id: string; videoUrl: string } | { id: string; error: string })[] = [];
if (posts.length > 0) {
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.tsx") });
  for (const post of posts) {
    try {
      const inputProps = { audience: post.audience, hook: post.hook, beats: post.beats };
      const composition = await selectComposition({ serveUrl, id: "Post", inputProps });
      const outputLocation = path.resolve("out", `${post.id}.mp4`);
      await renderMedia({ composition, serveUrl, codec: "h264", outputLocation, inputProps });
      const signed = await fetch(`${APP_URL}/api/cron/villa/upload-url`, {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ id: post.id }),
      });
      if (!signed.ok) throw new Error(`upload-url: HTTP ${signed.status}`);
      const { uploadUrl } = (await signed.json()) as { uploadUrl: string };
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "video/mp4" }, body: await readFile(outputLocation) });
      const putBody = await put.text();
      if (!put.ok) throw new Error(`blob PUT: HTTP ${put.status} ${putBody.slice(0, 200)}`);
      const { url } = JSON.parse(putBody) as { url: string };
      console.log(`rendered ${post.id} -> ${url}`);
      results.push({ id: post.id, videoUrl: url });
    } catch (err) {
      console.error(`failed ${post.id}`, err);
      results.push({ id: post.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
}

const report = await fetch(`${APP_URL}/api/cron/villa/render-report`, {
  method: "POST",
  headers: { ...auth, "content-type": "application/json" },
  body: JSON.stringify({ results }),
});
if (!report.ok) throw new Error(`render-report: HTTP ${report.status}`);
console.log(await report.text());
if (results.some((r) => "error" in r)) process.exitCode = 1;
