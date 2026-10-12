import "server-only";
import { HttpError } from "@/server/http";
import { MAX_BYTES } from "./parse";

/** Read one uploaded file from multipart form data; size-limited before buffering. */
export async function readUploadedFile(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES + 64 * 1024) throw new HttpError(413, "File is larger than 4 MB");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Expected a file upload");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a file to upload");
  if (file.size > MAX_BYTES) throw new HttpError(413, "File is larger than 4 MB");
  return { name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()), form };
}
