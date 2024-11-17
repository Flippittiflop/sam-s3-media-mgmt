import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const categoryTable = process.env.CATEGORY_TABLE;
const templateTable = process.env.TEMPLATE_TABLE;
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

    const { name, description, templateId } = JSON.parse(event.body);

    // Verify template exists
    const templateParams = {
      TableName: templateTable,
      Key: { templateId }
    };

    const templateResult = await ddbDocClient.send(new GetCommand(templateParams));
    
    if (!templateResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Template not found' })
      };
    }

    const categoryId = randomUUID();
    
    const params = {
      TableName: categoryTable,
      Item: {
        categoryId,
        templateId,
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
        templateId,
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