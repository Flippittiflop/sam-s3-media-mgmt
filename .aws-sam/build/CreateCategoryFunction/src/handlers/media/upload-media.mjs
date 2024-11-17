import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { randomUUID } from 'crypto';

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const bucketName = process.env.BUCKET_NAME;
const tableName = process.env.METADATA_TABLE;
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
    
    // Allow both Admin and Users groups to upload media
    if (!claims['cognito:groups'] || 
        (!claims['cognito:groups'].includes('Admin') && 
         !claims['cognito:groups'].includes('Users'))) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Access denied. Must be a member of Admin or Users group.' })
      };
    }

    const { image, metadata, categoryId } = JSON.parse(event.body);
    const mediaId = randomUUID();
    
    const imageBuffer = Buffer.from(image.split(',')[1], 'base64');
    const key = `gallery-images/${categoryId}/${mediaId}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg'
    }));

    const metadataParams = {
      TableName: tableName,
      Item: {
        mediaId,
        categoryId,
        s3Key: key,
        ...metadata,
        createdAt: new Date().toISOString(),
        createdBy: claims.sub
      }
    };

    await ddbDocClient.send(new PutCommand(metadataParams));

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        mediaId,
        message: 'Media uploaded successfully'
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Failed to upload media' })
    };
  }
};