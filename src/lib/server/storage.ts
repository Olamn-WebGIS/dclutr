import "server-only";
import { backendEnv, BackendError } from "@/lib/server/backend";

export async function uploadFile(bucket: string, objectPath: string, file: File, isPublic = false) {
  const { url, serviceKey } = backendEnv();
  const safePath = objectPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${safePath}`, {
    method: "POST",
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": file.type, "x-upsert": "false" },
    body: await file.arrayBuffer(), cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new BackendError(`File upload failed: ${detail.slice(0, 250)}`, response.status);
  }
  return isPublic ? `${url}/storage/v1/object/public/${bucket}/${safePath}` : objectPath;
}

export async function signedStorageUrl(bucket: string, objectPath: string, expiresIn = 300) {
  const { url, serviceKey } = backendEnv();
  const response = await fetch(`${url}/storage/v1/object/sign/${bucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST", headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn }), cache: "no-store",
  });
  if (!response.ok) throw new BackendError("Could not create a secure document preview.", 502);
  const data = await response.json() as { signedURL: string };
  return data.signedURL.startsWith("http") ? data.signedURL : `${url}/storage/v1${data.signedURL}`;
}

export async function deleteStorageObject(bucket: string, objectPath: string) {
  const { url, serviceKey } = backendEnv();
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "DELETE", headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }, cache: "no-store",
  });
  if (!response.ok && response.status !== 404) throw new BackendError("Could not remove the listing photo from storage.", 502);
}
