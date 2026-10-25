const { createServer } = require("http");
const next = require("next");
const cron = require("node-cron");

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`> Train Watch is running on http://localhost:${port}`);
  });

  // 5分おきに監視サイクルを実行する。実際にAPIを呼ぶかどうか（営業時間内かどうか）の
  // 判定は runCheckCycle 内で行うため、ここでは単純に5分間隔でキックするだけでよい。
  cron.schedule("*/5 * * * *", async () => {
    try {
      // Next.js が TypeScript の src/lib を解決できるよう、動的 require で
      // コンパイル済みのハンドラを呼び出す。開発時は ts-node 相当の変換が
      // next の内部ローダーに乗らないため、cron ジョブ自体は
      // /api/cron/check エンドポイントを内部 fetch する方式にしている。
      const res = await fetch(`http://localhost:${port}/api/cron/check`, {
        method: "POST",
        headers: process.env.CRON_SECRET
          ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
          : undefined,
      });
      const json = await res.json().catch(() => ({}));
      console.log("[cron] check cycle:", json);
    } catch (err) {
      console.error("[cron] check cycle failed:", err);
    }
  }, { noOverlap: true });

  console.log("> Cron scheduler armed: checking Odakyu line status every 5 minutes");
});
