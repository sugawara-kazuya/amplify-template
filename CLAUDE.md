# CLAUDE.md

このファイルは、このリポジトリでコードを扱う際のClaude Code (claude.ai/code) への指針を提供します。

## コマンド

### 開発

```bash
# Next.js開発サーバーを起動
npm run dev

# Amplifyサンドボックスをバックエンド開発用に起動
npx ampx sandbox --profile sample

# フロントエンドとバックエンドを同時に実行（別々のターミナルで）
npm run dev
npx ampx sandbox --profile sample
```

## アーキテクチャ概要

これはNext.js 15とAWS Amplify Gen 2バックエンドを使用したアプリケーションです：

- **フロントエンド**: Next.js App Router、React 19、TypeScript、Tailwind CSS
- **UIコンポーネント**: Radix UIプリミティブを使用したshadcn/ui
- **バックエンド**: GraphQL API (AppSync)、Cognito認証、Lambda関数を備えたAWS Amplify
- **AI統合**: Amazon BedrockとVercel AI SDK
- **スタイリング**: カレーテーマのカラースキームを使用したTailwind CSS

## フロントエンド開発ルール

### 1. App Routerディレクトリ構造

Next.js App Routerでは、`app/` ディレクトリ内のファイル構造がURLルートに直接マッピングされます：

```
app/
├── page.tsx              # / (ルートページ)
├── layout.tsx            # 全体レイアウト
├── error.tsx             # エラーバウンダリ
├── loading.tsx           # ローディングUI
├── not-found.tsx         # 404ページ
├── globals.css           # グローバルスタイル
├── about/
│   └── page.tsx          # /about
├── blog/
│   ├── page.tsx          # /blog
│   └── [slug]/
│       └── page.tsx      # /blog/[slug] (動的ルート)
└── (auth)/               # ルートグループ（URLに影響しない）
    ├── login/
    │   └── page.tsx      # /login
    └── register/
        └── page.tsx      # /register
```

### 2. Server ComponentsとClient Components

デフォルトではすべてのコンポーネントはServer Componentsとして扱われます。Client Componentsを使用する場合は、ファイルの先頭に`'use client'`ディレクティブを追加します：

```typescript
// Server Component (デフォルト)
// app/components/ServerComponent.tsx
async function ServerComponent() {
  // サーバーサイドでデータフェッチ
  const data = await fetch('https://api.example.com/data')
  return <div>{data}</div>
}

// Client Component
// app/components/ClientComponent.tsx
'use client'

import { useState } from 'react'

export function ClientComponent() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

#### 使い分けのガイドライン

- **Server Components**: データフェッチ、静的コンテンツ、SEO重要なコンテンツ
- **Client Components**: インタラクティブなUI、ブラウザAPIの使用、React Hooksの使用

### 3. データフェッチングパターン

#### Server Componentsでのデータフェッチ

```typescript
// app/posts/page.tsx
async function PostsPage() {
  // 直接async/awaitでデータを取得
  const posts = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 } // 1時間ごとに再検証
  })
  
  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

#### Client Componentsでのデータフェッチ

```typescript
'use client'

import { useState, useEffect } from 'react'

export function ClientPosts() {
  const [posts, setPosts] = useState([])
  
  useEffect(() => {
    fetch('/api/posts')
      .then(res => res.json())
      .then(setPosts)
  }, [])
  
  return <div>{/* posts rendering */}</div>
}
```

### 4. レイアウトとテンプレート

#### layout.tsx (永続的レイアウト)

```typescript
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex">
      <Sidebar /> {/* 共通サイドバー */}
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

#### template.tsx (ページ遷移時に再マウント)

```typescript
// app/dashboard/template.tsx
'use client'

export default function Template({ children }: { children: React.ReactNode }) {
  // ページ遷移のたびに実行される
  useEffect(() => {
    console.log('ページが変更されました')
  }, [])
  
  return <div>{children}</div>
}
```

### 5. ナビゲーション

#### Linkコンポーネント（推奨）

```typescript
import Link from 'next/link'

export function Navigation() {
  return (
    <nav>
      <Link href="/">ホーム</Link>
      <Link href="/about">About</Link>
      <Link href={`/blog/${post.slug}`}>記事詳細</Link>
    </nav>
  )
}
```

#### useRouterフック（Client Components内）

```typescript
'use client'

import { useRouter } from 'next/navigation'

export function NavigateButton() {
  const router = useRouter()
  
  return (
    <button onClick={() => router.push('/dashboard')}>
      ダッシュボードへ
    </button>
  )
}
```

### 6. API Routes

API Routesは`app/api/`ディレクトリ内の`route.ts`ファイルで定義します：

```typescript
// app/api/posts/route.ts
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const posts = await getPosts()
  return Response.json(posts)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const newPost = await createPost(body)
  return Response.json(newPost, { status: 201 })
}
```

### 7. エラーハンドリング

```typescript
// app/posts/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>エラーが発生しました</h2>
      <button onClick={() => reset()}>再試行</button>
    </div>
  )
}
```

### 8. ローディング状態

```typescript
// app/posts/loading.tsx
export default function Loading() {
  return <div>読み込み中...</div>
}
```


## バックエンド開発ルール

### 1. Amplifyバックエンド設定

常に `amplify/` ディレクトリでTypeScriptを使用してバックエンドリソースを定義する：

```typescript: amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { aiAgent } from './functions/ai-agent/resource'

const backend = defineBackend({
  auth,
  data,
  aiAgent,
})
```

### 2. データモデル定義

適切な認可設定を含むTypeScriptファーストのGraphQLスキーマを使用：

```typescript: amplify/data/resource.ts
const schema = a.schema({
  User: a
    .model({
      email: a.string().required(),
      name: a.string(),
      avatarUrl: a.string(),
      conversations: a.hasMany('Conversation', 'userId'),
    })
    .authorization((allow) => [allow.owner(), allow.authenticated().to(['read'])]),

  Conversation: a
    .model({
      userId: a.id(),
      title: a.string(),
      user: a.belongsTo('User', 'userId'),
      messages: a.hasMany('Message', 'conversationId'),
    })
    .authorization((allow) => [allow.owner()]),
})
```

### 3. 認証設定

複数のプロバイダーで認証を設定：

```typescript: amplify/auth/resource.ts
export const auth = defineAuth({
  loginWith: {
    email: true,
    // 基本的になくて大丈夫
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
      },
    },
  },
  userAttributes: {
    email: {
      required: true,
      mutable: true,
    },
  },
})
```

### 4. Lambda関数パターン

#### Lambda関数の定義とIAMポリシー

```typescript
// amplify/functions/ai-agent/resource.ts
import { defineFunction } from '@aws-amplify/backend'

export const aiAgent = defineFunction({
  name: 'ai-agent',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 300,
  memoryMB: 1024,
})
```

#### Lambda関数ハンドラーの実装

```typescript: amplify/functions/ai-agent/handler.ts
import { env } from '$amplify/env/invoke-bedrock'
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { Context, Handler } from 'aws-lambda'

// Lambdaが受け取るイベントの型定義
type eventType = {
  prompt: string    // ユーザーからの質問文
  category: string  // 検索対象のカテゴリー
}

// Bedrockのモデル指定
const modelId = 'anthropic.claude-sonnet-4-20250514-v1:0'
// Bedrockクライアントの初期化
const client = new BedrockRuntimeClient({ region: 'ap-northeast-1' })

export const handler: Handler = async (event: eventType, _context: Context) => {
  try {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: event.prompt }],
        },
      ],
    };

    const command = new InvokeModelWithResponseStreamCommand({
      contentType: "application/json",
      body: JSON.stringify(payload),
      modelId,
    });

    const apiResponse = await client.send(command);
    let fullResponse = '';

    if (apiResponse.body) {
      for await (const item of apiResponse.body) {
        if (item.chunk) {
          const chunk = JSON.parse(new TextDecoder().decode(item.chunk.bytes));
          const chunk_type = chunk.type;

          if (chunk_type === "content_block_delta") {
            const text = chunk.delta.text;
            fullResponse += text;
          }
        } else if (item.internalServerException) {
          throw item.internalServerException
        } else if (item.modelStreamErrorException) {
          throw item.modelStreamErrorException
        } else if (item.throttlingException) {
          throw item.throttlingException
        } else if (item.validationException) {
          throw item.validationException
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        response: fullResponse,
        category: event.category
      })
    }
  } catch (error) {
    // エラー発生時のログ記録とエラーレスポンスの返却
    console.error('Error generating response:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: '何かしらのエラーが発生しました。',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

```

#### Lambdaのルールをamplify/backend.tsに追加

```amplify/backend.ts
  import { defineBackend } from '@aws-amplify/backend';

+ import * as iam from 'aws-cdk-lib/aws-iam';

  import { auth } from './auth/resource';
  import { helloWorld } from './function/hello-world/resource'

+ import { invokeBedrock } from './function/invoke-bedrock/resource'


  const backend = defineBackend({
      auth,
      helloWorld,

+     invokeBedrock,

  });

  const authenticatedUserIamRole = backend.auth.resources.authenticatedUserIamRole;
  backend.helloWorld.resources.lambda.grantInvoke(authenticatedUserIamRole);

+ backend.invokeBedrock.resources.lambda.grantInvoke(authenticatedUserIamRole);



+ const bedrockStatement = new iam.PolicyStatement({

+     actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],

+     resources: ["arn:aws:bedrock:us-east-1::foundation-model/*"]

+ })



+ backend.invokeBedrock.resources.lambda.addToRolePolicy(bedrockStatement)


  backend.addOutput({
      custom: {
          helloWorldFunctionName: backend.helloWorld.resources.lambda.functionName,

+         invokeBedrockFunctionName: backend.invokeBedrock.resources.lambda.functionName,

      },
  });
```

## Lambdaの呼び出し方

```typescript
const [prompt, setPrompt] = useState("")
const [aiMessage, setAiMessage] = useState("")

async function invokeBedrock() {

  const { credentials } = await fetchAuthSession()
  const awsRegion = outputs.auth.aws_region
  const functionName = outputs.custom.invokeBedrockFunctionName

  const labmda = new LambdaClient({ credentials: credentials, region: awsRegion })
  const command = new InvokeWithResponseStreamCommand({
    FunctionName: functionName,
    Payload: new TextEncoder().encode(JSON.stringify({ prompt: prompt }))
  })
  const apiResponse = await labmda.send(command);

  let completeMessage = ''
  if (apiResponse.EventStream) {
    for await (const item of apiResponse.EventStream) {
      if (item.PayloadChunk) {
        const payload = new TextDecoder().decode(item.PayloadChunk.Payload)
        completeMessage = completeMessage + payload
        setAiMessage(completeMessage)
      }
    }
  }
}
```