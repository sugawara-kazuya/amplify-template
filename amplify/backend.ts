import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";
import * as iam from 'aws-cdk-lib/aws-iam';
import { invokeBedrock } from './function/invoke-bedrock/resource'

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend =defineBackend({
  auth,
  data,
  storage,
  invokeBedrock,
});

const authenticatedUserIamRole = backend.auth.resources.authenticatedUserIamRole;
 backend.invokeBedrock.resources.lambda.grantInvoke(authenticatedUserIamRole);

 const bedrockStatement = new iam.PolicyStatement({
    actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
    resources: ["arn:aws:bedrock:us-east-1::foundation-model/*"]
 })

 backend.invokeBedrock.resources.lambda.addToRolePolicy(bedrockStatement)

backend.addOutput({
    custom: {
      invokeBedrockFunctionName: backend.invokeBedrock.resources.lambda.functionName,
    },
});