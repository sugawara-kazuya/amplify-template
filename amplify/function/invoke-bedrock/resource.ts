import { defineFunction } from '@aws-amplify/backend';

export const invokeBedrock = defineFunction({
    name: 'invoke-bedrock',
    entry: './handler.ts',
})