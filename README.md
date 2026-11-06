# Thinking in the Grey

[https://thinking-in-the-grey.pages.dev/](https://thinking-in-the-grey.pages.dev/)

AstroとmicroCMSで作成した技術ブログです。

## 技術スタック

- CMS：microCMS
- フレームワーク：Astro
- デプロイ先：Cloudflare

## 機能

- タグ一覧
- 目次
- シンタックスハイライト
- ダークモード
- Pagefindによる記事検索（ヘッダーの検索ボタン、Ctrl+K / Cmd+K）

## 記事検索

`astro-pagefind` が `astro build` の完了時に索引を生成し、`dist/pagefind/` に出力します。検索対象は記事のタイトル・本文・コードブロックです。トップ、タグ一覧、About、目次、追従メニュー、関連記事は対象外です。

検索ボタンはテーマトグルの左にあります。Pagefind公式のモーダルと標準スタイルを使い、ライト・ダークモードをサイトのテーマに連動させています。見た目の調整は [src/styles/search.css](src/styles/search.css)、モーダルの構成変更は [src/components/SearchModal.astro](src/components/SearchModal.astro) で行います。配色・サイズなどは公式の `--pf-*` CSS変数を使って上書きできます。

### 動作確認

既存の `MICROCMS_SERVICE_DOMAIN` と `MICROCMS_API_KEY` を設定した環境で実行します。

```bash
npm run test
npm run build
npm run preview
```

プレビューで検索ボタンを開き、日本語検索、検索結果への移動、キーボード操作、モバイル表示を確認してください。自動テストでは索引の対象範囲・日本語の生成物・記事0件時の扱いを確認します。ビルドでも生成物と記事数を検証し、索引の欠落・件数の不一致・記事0件の場合は失敗させます。

開発サーバーでは、直近のビルド済み索引を使用します。初回と、記事本文や索引の対象範囲を変更した後は `npm run build` を実行してください。スタイルだけの変更は開発サーバーに反映されます。

```bash
npm run dev -- --background
npm run astro -- dev status
npm run astro -- dev logs
npm run astro -- dev stop
```

### 記事の更新と公開

microCMSで記事を追加・更新・削除した後は、Cloudflare側で再ビルド・再デプロイし、HTMLと検索索引を同時に更新してください。CMS更新だけでは公開済みの索引は変わりません。自動化する場合はmicroCMSのWebhookとCloudflareのデプロイフックを設定します。

Cloudflareのビルドコマンドを `npm run build`、公開ディレクトリを `dist` とし、microCMS用の環境変数とnpm依存関係が利用できることを確認してください。`dist/pagefind/` もHTMLと一緒に配信します。公開後は検索データの取得と記事リンクを確認してください。Cloudflare管理画面の設定・Webhookの有無は、このリポジトリでは管理していません。

## Astroのファイル構成

```text
src/
├── content.config.ts           # microCMSの取得処理とスキーマ
├── components/
│   ├── BaseHead.astro           # メタ情報、共通CSS、表示設定の初期化
│   ├── ArticlesList.astro       # 記事一覧
│   ├── TagsList.astro           # タグナビゲーション
│   ├── TableOfContents.astro    # 目次
│   ├── SearchModal.astro        # 検索起動ボタンとPagefindモーダル
│   └── ThemeToggle.astro        # 配色の切替
├── layouts/
│   └── BlogPost.astro           # 記事の共通レイアウト
├── lib/
│   └── microcms.ts              # CMS本文のHTML加工
├── pages/
│   ├── index.astro              # トップページ
│   ├── about.astro              # ブログ・著者の紹介
│   ├── blog/[...slug].astro     # 記事詳細
│   ├── tags/[slug].astro        # タグ別記事一覧
│   └── rss.xml.js               # RSS
├── scripts/                    # 目次メニューや画像拡大の操作
└── styles/
    ├── global.css             # 共通スタイルとテーマ変数
    └── search.css             # 検索UIの上書きスタイル
```

主なファイルを抜粋しています。

