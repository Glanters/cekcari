import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { storage } from '#config/cekcari'

let sharedClient: S3Client | null = null

function client(): S3Client {
    sharedClient ??= new S3Client({
        region: storage.region,
        endpoint: storage.endpoint,
        forcePathStyle: storage.forcePathStyle,
        credentials: {
            accessKeyId: storage.accessKeyId,
            secretAccessKey: storage.secretAccessKey.release(),
        },
        // MinIO dan DigitalOcean Spaces tidak selalu mendukung checksum bawaan SDK terbaru.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
    })

    return sharedClient
}

/**
 * Object storage S3 (DigitalOcean Spaces di production, MinIO di lokal). Path yang disimpan di basis data
 * relatif terhadap bucket, alamat publiknya dibentuk dari storage.publicUrl.
 */
export default class ObjectStorage {
    async putPublic(path: string, contents: Buffer, contentType: string): Promise<void> {
        await client().send(
            new PutObjectCommand({
                Bucket: storage.bucket,
                Key: path,
                Body: contents,
                ContentType: contentType,
                ACL: 'public-read',
            })
        )
    }

    async delete(path: string): Promise<void> {
        await client().send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: path }))
    }
}
