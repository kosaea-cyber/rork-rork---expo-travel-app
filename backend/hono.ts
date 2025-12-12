import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const app = new Hono();

app.use("*", cors());

const UPLOADS_DIR = "backend/db";

// Ensure uploads dir exists
// fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

app.post("/api/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        // It's a File or Blob
        const buffer = await (file as any).arrayBuffer();
        const ext = (file as any).name?.split('.').pop() || 'jpg';
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, fileName);
        
        await fs.writeFile(filePath, Buffer.from(buffer));
        
        // Return URL relative to server
        // Assuming server is reachable at base URL
        // We can return /api/uploads/filename
        const url = `/api/uploads/${fileName}`;
        return c.json({ url });
    }
    
    return c.json({ error: "No file uploaded" }, 400);
  } catch (e) {
    console.error(e);
    return c.json({ error: "Upload failed" }, 500);
  }
});

app.get("/api/uploads/:filename", async (c) => {
    const filename = c.req.param("filename");
    const filePath = path.join(UPLOADS_DIR, filename);
    
    try {
        const content = await fs.readFile(filePath);
        // Determine mime type simply
        const ext = path.extname(filename).toLowerCase();
        let mime = "application/octet-stream";
        if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
        if (ext === ".png") mime = "image/png";
        if (ext === ".gif") mime = "image/gif";
        if (ext === ".webp") mime = "image/webp";
        
        c.header("Content-Type", mime);
        return c.body(content as any);
    } catch (e) {
        return c.notFound();
    }
});

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

export default app;
