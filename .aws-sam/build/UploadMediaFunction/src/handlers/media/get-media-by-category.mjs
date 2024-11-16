import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const bucketName = process.env.BUCKET_NAME;
const tableName = process.env.METADATA_TABLE;

export const handler = async (event) => {
  try {
    const categoryId = event.pathParameters.categoryId;
    
    // Query DynamoDB for metadata using GSI
    const queryParams = {
      TableName: tableName,
      IndexName: 'CategoryIndex',
      KeyConditionExpression: 'categoryId = :categoryId',
      ExpressionAttributeValues: {
        ':categoryId': categoryId
      }
    };

    const data = await ddbDocClient.send(new QueryCommand(queryParams));
    
    // Generate presigned URLs for each image
    const mediaItems = await Promise.all(
      data.Items.map(async (item) => {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: item.s3Key
        });
        
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        
        return {
          ...item,
          signedUrl
        };
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(mediaItems)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch media' })
    };
  }
};