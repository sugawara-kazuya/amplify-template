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
