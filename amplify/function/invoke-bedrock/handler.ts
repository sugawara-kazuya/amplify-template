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