import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { randomUUID } from 'crypto';

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
    
    const claims = await verifier.verify(token);
    
    if (!claims['cognito:groups'] || !claims['cognito:groups'].includes('Admin')) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Access denied. Admin privileges required.' })
      };
    }

    const { templateId, name, description, fields } = JSON.parse(event.body);
    
    const params = {
      TableName: tableName,
      Item: {
        templateId: templateId || randomUUID(),
        name,
        description,
        fields,
        updatedAt: new Date().toISOString()
      }
    };

    if (!templateId) {
      params.Item.createdAt = params.Item.updatedAt;
    }

    await ddbDocClient.send(new PutCommand(params));
    
    return {
      statusCode: templateId ? 200 : 201,
      headers: corsHeaders,
      body: JSON.stringify({
        ...params.Item,
        message: templateId ? 'Template updated successfully' : 'Template created successfully'
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Failed to upsert template' })
    };
  }
};