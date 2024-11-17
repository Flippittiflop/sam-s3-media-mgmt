import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoJwtVerifier } from "aws-jwt-verify";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.TEMPLATE_TABLE;
const userPoolId = process.env.USER_POOL_ID;

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    const token = event.headers.Authorization.split(' ')[1];
    
    const verifier = CognitoJwtVerifier.create({
      userPoolId: userPoolId,
      tokenUse: "access",
      clientId: null
    });
    
    await verifier.verify(token);
    
    const params = {
      TableName: tableName
    };

    const data = await ddbDocClient.send(new ScanCommand(params));
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data.Items)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Failed to fetch templates' })
    };
  }
};