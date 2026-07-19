# new-todo-app

Googleスプレッドシートをデータストアとして使うシンプルなTodoアプリです。React（フロントエンド）とExpress（バックエンド）の2つのプロジェクトで構成されています。

## 構成

```
.
├── src/                 # フロントエンド（React + Vite）
│   ├── pages/
│   │   ├── TodoFormPage.jsx   # Todo登録画面（要ログイン）
│   │   ├── TodoListPage.jsx   # Todo一覧画面（要ログイン）
│   │   ├── LoginPage.jsx      # ログイン画面
│   │   └── RegisterPage.jsx   # 新規登録画面
│   ├── components/
│   │   ├── NavTabs.jsx
│   │   ├── TodoStats.jsx
│   │   ├── UserBar.jsx        # ログイン中メール表示・ログアウト
│   │   └── ProtectedRoute.jsx # 未ログイン時にログイン画面へリダイレクト
│   ├── context/
│   │   └── AuthContext.jsx    # ログイン状態の管理
│   ├── api.js            # Todo用API呼び出し
│   ├── authApi.js        # 認証用API呼び出し
│   └── App.jsx            # ルーティング定義
└── server/                # バックエンド（Express）
    ├── index.js           # APIサーバー本体
    ├── sheets.js          # Googleスプレッドシート連携（Todo・ユーザー情報）
    └── auth/
        ├── validators.js       # メール・パスワードのバリデーション
        ├── passwordService.js  # パスワードのハッシュ化・照合
        ├── tokenService.js     # JWT発行・Cookie管理
        ├── authService.js      # 登録・ログインの業務ロジック
        ├── authMiddleware.js   # ログイン必須APIの保護
        └── authRoutes.js       # 認証系APIエンドポイント
```

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
cd server && npm install
```

### 2. 環境変数の設定

`.env.example` を `.env` としてコピーし、値を設定してください。

```bash
cp .env.example .env
```

| 変数名 | 説明 |
| --- | --- |
| `SPREADSHEET_ID` | データを保存するGoogleスプレッドシートのID |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | サービスアカウントキーのJSONファイルへのパス |
| `PORT` | バックエンドサーバーのポート（既定: 3001） |
| `VITE_API_BASE_URL` | フロントエンドがアクセスするAPIサーバーのURL |
| `JWT_SECRET` | ログイン用JWTの署名に使う秘密鍵（十分に長いランダムな文字列） |
| `CORS_ORIGIN` | CORSで許可するフロントエンドのオリジン（既定: `http://localhost:5173`） |

Googleサービスアカウントを作成し、対象のスプレッドシートを共有設定で編集可能にしておく必要があります。

### 3. 起動

バックエンド:

```bash
cd server
npm run dev
```

フロントエンド:

```bash
npm run dev
```

## 主なAPI

認証系（`server/auth/authRoutes.js`）:

| メソッド | パス | 説明 |
| --- | --- | --- |
| POST | `/api/auth/register` | 新規登録（成功時は自動ログイン） |
| POST | `/api/auth/login` | ログイン |
| POST | `/api/auth/logout` | ログアウト |
| GET | `/api/auth/me` | ログイン状態の確認 |

Todo系（すべてログイン必須。ログイン中ユーザー自身のTodoのみ操作可能）:

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/api/todos` | 自分のTodo一覧を取得 |
| POST | `/api/todos` | Todoを新規追加 |
| PUT | `/api/todos/:id` | 自分のTodoを更新 |
| DELETE | `/api/todos/:id` | 自分のTodoを削除 |

## Lint

```bash
npm run lint
```
