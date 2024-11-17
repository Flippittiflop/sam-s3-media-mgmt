import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.CATEGORY_TABLE;
const userPoolId = process.env.USER_POOL_ID;

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export const handler = async (event) => {
  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Parse the JWT token from the Authorization header
    const token = event.headers.Authorization.split(' ')[1];
    
    // Verify the JWT and get the claims
    const verifier = CognitoJwtVerifier.create({
      userPoolId: userPoolId,
      tokenUse: "access",
      clientId: null // Validate any client
    });
    
    const claims = await verifier.verify(token);
    
    // Check if user is in Admin group
    if (!claims['cognito:groups'] || !claims['cognito:groups'].includes('Admin')) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Access denied. Admin privileges required.' })
      };
    }

    const { name, description } = JSON.parse(event.body);
    const categoryId = randomUUID();
    
    const params = {
      TableName: tableName,
      Item: {
        categoryId,
        name,
        description,
        createdAt: new Date().toISOString()
      }
    };

    await ddbDocClient.send(new PutCommand(params));
    
    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        categoryId,
        name,
        description,
        message: 'Category created successfully'
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Failed to create category' })
    };
  }
};