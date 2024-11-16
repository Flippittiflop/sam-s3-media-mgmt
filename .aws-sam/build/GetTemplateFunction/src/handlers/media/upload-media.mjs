import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const bucketName = process.env.BUCKET_NAME;
const tableName = process.env.METADATA_TABLE;

export const handler = async (event) => {
  try {
    const { image, metadata, categoryId } = JSON.parse(event.body);
    const mediaId = randomUUID();
    
    // Upload image to S3
    const imageBuffer = Buffer.from(image.split(',')[1], 'base64');
    const key = `gallery-images/${categoryId}/${mediaId}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg'
    }));

    // Store metadata in DynamoDB
    const metadataParams = {
      TableName: tableName,
      Item: {
        mediaId,
        categoryId,
        s3Key: key,
        ...metadata,
        createdAt: new Date().toISOString()
      }
    };

    await ddbDocClient.send(new PutCommand(metadataParams));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        mediaId,
        message: 'Media uploaded successfully'
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to upload media' })
    };
  }
};