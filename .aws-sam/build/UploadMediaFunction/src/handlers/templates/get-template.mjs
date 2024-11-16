import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.TEMPLATE_TABLE;

export const handler = async (event) => {
  try {
    const categoryId = event.pathParameters.categoryId;
    
    const params = {
      TableName: tableName,
      Key: {
        categoryId: categoryId
      }
    };

    const data = await ddbDocClient.send(new GetCommand(params));
    
    if (!data.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Template not found' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data.Item)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch template' })
    };
  }
};