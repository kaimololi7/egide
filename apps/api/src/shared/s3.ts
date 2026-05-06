/**
 * S3 client + presigned URL helper.
 *
 * Used by compliance.requestUpload to issue tenant-scoped signed PUT URLs.
 * Compatible with MinIO (dev), Scaleway Object Storage, OVH Cloud Storage,
 * and AWS S3.
 *
 * Cf. ADR 014 §A02 (cryptographic) + threat-models/multi-tenant-isolation.md.
 */

import {
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../env.js";

let _client: S3Client | null = null;

export function getS3Client(env: Env): S3Client {
  if (_client) return _client;

  const config: S3ClientConfig = {
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  };
  if (env.S3_ENDPOINT) {
    config.endpoint = env.S3_ENDPOINT;
  }
  if (env.S3_ACCESS_KEY && env.S3_SECRET_KEY) {
    config.credentials = {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    };
  }
  _client = new S3Client(config);
  return _client;
}

export interface PresignedPutUrl {
  uploadUrl: string;
  storageKey: string;
  expiresIn: number;
}

/**
 * Generate a tenant-scoped signed PUT URL.
 *
 * The key path encodes the tenantId so a leaked URL cannot be used to
 * write to another tenant's namespace (PG RLS + bucket policy must
 * additionally enforce read separation in production).
 */
export async function presignTenantUpload(
  env: Env,
  args: {
    tenantId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    expiresIn?: number;
  },
): Promise<PresignedPutUrl> {
  const expiresIn = args.expiresIn ?? 3600;
  const safeFilename = args.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `tenants/${args.tenantId}/uploads/${crypto.randomUUID()}/${safeFilename}`;

  const client = getS3Client(env);
  const cmd = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: storageKey,
    ContentType: args.contentType,
    ContentLength: args.sizeBytes,
    Metadata: {
      "egide-tenant-id": args.tenantId,
      "egide-original-name": safeFilename,
    },
  });

  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn });

  return { uploadUrl, storageKey, expiresIn };
}
