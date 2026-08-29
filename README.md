# Train Watch

小田急線の「遅延」「運転見合わせ」を検知して、スマホにプッシュ通知でお知らせするアプリです。通知をタップするとアプリが開き、遅延区間・発生時刻・遅延理由を確認できます。

## 機能

1. 小田急線の運行状況を5分おきに監視（始発〜終電の時間帯のみ）
2. 「遅延」「運転見合わせ」の発生を検知
3. 検知したらスマホにプッシュ通知
4. 何も検知しなければ何もしない（通知しない）
5. 通知をタップしてアプリを開くと、遅延区間・発生時刻・遅延理由を表示

## アーキテクチャ

- **Next.js (App Router) + TypeScript** によるPWA
- `server.js`: Next.jsのカスタムサーバー。`node-cron` で5分おきに監視サイクル (`/api/cron/check`) を実行
- `src/lib/odakyuStatus.ts`: 運行情報を取得・パースし、遅延/運転見合わせを判定
  - 既定のデータソースは無料の鉄道遅延情報API（[tetsudo.rti-giken.jp](https://tetsudo.rti-giken.jp/)）
  - 区間・理由の抽出はテキストからのヒューリスティック抽出のため、完全ではありません（後述）
- `src/lib/operatingHours.ts`: 深夜（既定 01:30〜04:30 JST）は監視をスキップ
- `src/lib/push.ts`: Web Push（VAPID）で購読端末に通知を送信
- `src/lib/store.ts`: 購読情報・最新の運行状態を `data/*.json` に保存（DB不要のシンプルな永続化）
- `public/sw.js`: Service Worker。プッシュ受信時に通知を表示し、タップでアプリを開く
- `src/app/page.tsx`: 小田急ブルーを基調にしたUI。通知経由で開いた場合、3秒間のチャイム音をアプリ内で再生

## セットアップ

```bash
npm install
npm run generate-vapid-keys   # VAPID鍵ペアを生成
cp .env.example .env.local    # 生成した鍵などを .env.local に設定
npm run dev                    # http://localhost:3000
```

`.env.local` の主な設定項目（`.env.example` 参照）:

| 変数 | 説明 |
|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push用の鍵ペア（`npm run generate-vapid-keys` で生成） |
| `VAPID_CONTACT_EMAIL` | VAPIDに必要な連絡先（`mailto:...`） |
| `CRON_SECRET` | `/api/cron/check` を外部スケジューラから呼ぶ場合の共有シークレット（任意） |
| `DELAY_API_ENDPOINT` | 運行情報の取得元API（既定はrti-giken鉄道遅延情報API） |
| `QUIET_HOURS_START` / `QUIET_HOURS_END` | 監視を休止する時間帯（終電後〜始発前） |

## スマホでの使い方

1. デプロイしたURLにスマホのブラウザ（Android Chrome推奨）でアクセス
2. 「通知をオンにする」をタップし、通知を許可
3. ブラウザメニューから「ホーム画面に追加」してPWAとしてインストール（任意だが推奨）
4. 遅延・運転見合わせを検知すると、端末に通知が届きます
5. 通知をタップするとアプリが開き、区間・発生時刻・理由が表示されます

## デプロイ方法（2通り）

### A. 常時起動サーバー（推奨・`node-cron` がそのまま動く）
Render / Railway / VPS など、Node.jsプロセスを常駐できる環境にデプロイし、`npm run build && npm start` で起動します。`server.js` 内の `node-cron` が5分おきに自動で監視します。

### B. サーバーレス環境（Vercelなど）
サーバーレスでは常駐プロセスを持てないため、`node-cron` は動作しません。代わりに `POST /api/cron/check` を外部スケジューラ（Vercel Cron / GitHub Actions の `schedule` / cron-job.org など）から5分おきに呼び出してください。`CRON_SECRET` を設定した場合は `Authorization: Bearer <CRON_SECRET>` ヘッダーが必要です。営業時間外の呼び出しは内部で自動的にスキップされます。

## 既知の制約（正直に書きます）

- **通知音を「3秒で止まるチャイム」に完全固定することはできません。** Web Push通知の音はOS/ブラウザの既定通知音に依存し、Webアプリ側から音源や再生時間を指定することはブラウザの仕様上できません。本アプリでは、通知タップでアプリを開いた瞬間に、アプリ内でWeb Audio APIを使って合成した3秒のチャイムを再生することでこれに近い体験を実現しています。通知そのものの音を完全にカスタマイズしたい場合は、Androidアプリとして独自の通知チャンネル（カスタムサウンド指定可能）を持つネイティブアプリ化が必要です。
- **区間・理由の自動抽出はヒューリスティックです。** 運行情報のテキストから正規表現で「駅名〜駅名」「事象キーワード」を抽出しているため、表記ゆれによっては正しく抽出できない場合があります。その場合は元のテキスト全文が理由欄にフォールバック表示されます。
- **運行情報APIは非公式の無料APIを利用しています。** 小田急電鉄公式のリアルタイムAPIは一般公開されていないため、鉄道遅延情報の公開JSON APIをデータソースとしています。エンドポイントのレスポンス仕様が変わった場合は `src/lib/odakyuStatus.ts` の調整が必要です。

## テスト

```bash
npm test
```

`src/lib/__tests__` に、営業時間判定・遅延検知・区間抽出・理由抽出のユニットテストがあります。
