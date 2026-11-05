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

## Astroのファイル構成

```text
src/
├── content.config.ts           # microCMSの取得処理とスキーマ
├── components/
│   ├── BaseHead.astro           # メタ情報、共通CSS、表示設定の初期化
│   ├── ArticlesList.astro       # 記事一覧
│   ├── TagsList.astro           # タグナビゲーション
│   ├── TableOfContents.astro    # 目次
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
└── styles/global.css           # 共通スタイルとテーマ変数
```

主なファイルを抜粋しています。

