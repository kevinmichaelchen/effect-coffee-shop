import * as Stream from "effect/Stream";
import { CacheError, PART_BYTES } from "./domain.ts";

// Web Streams boundary: pack arbitrary transport chunks into bounded S3/R2
// multipart chunks. Errors and cancellation propagate to the upstream body.
export function artifactParts(body: ReadableStream<Uint8Array>, expectedBytes: number) {
  let buffer = new Uint8Array(PART_BYTES);
  let offset = 0;
  let received = 0;
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > expectedBytes) {
        controller.error(new CacheError({ status: 400, message: "Content length mismatch" }));
        return;
      }
      const append = (remaining: Uint8Array): void => {
        const count = Math.min(PART_BYTES - offset, remaining.byteLength);
        buffer.set(remaining.subarray(0, count), offset);
        offset += count;
        if (offset === PART_BYTES) {
          controller.enqueue(buffer);
          buffer = new Uint8Array(PART_BYTES);
          offset = 0;
        }
        if (count < remaining.byteLength) append(remaining.subarray(count));
      };
      append(chunk);
    },
    flush(controller) {
      if (received !== expectedBytes) {
        controller.error(new CacheError({ status: 400, message: "Content length mismatch" }));
        return;
      }
      if (offset > 0) controller.enqueue(buffer.subarray(0, offset));
    },
  });
  return Stream.fromReadableStream({
    evaluate: () => body.pipeThrough(transform),
    onError: () => new CacheError({ status: 400, message: "Invalid artifact body" }),
  });
}
