import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePlan, reviewAndAdjustPlan } from "./planEngine.js";
import { validateGeneratePlanInput, validateReviewPlanInput } from "./validators.js";

const publicDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const staticAssets = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" }
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

async function sendStaticAsset(response, asset) {
  try {
    const content = await readFile(path.join(publicDirectory, asset.file));
    response.writeHead(200, { "Content-Type": asset.type, "Cache-Control": "no-store" });
    response.end(content);
  } catch {
    sendJson(response, 500, { error: "Web client asset could not be loaded." });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "GET" && staticAssets[url.pathname]) {
    return sendStaticAsset(response, staticAssets[url.pathname]);
  }

  if (request.method === "POST" && url.pathname === "/api/plan/generate") {
    try {
      const body = await readJson(request);
      const errors = validateGeneratePlanInput(body);
      if (errors) return sendJson(response, 400, { error: "请修正表单中的冲突或无效数据。", errors });
      return sendJson(response, 200, generatePlan(body));
    } catch {
      return sendJson(response, 400, { error: "Invalid JSON body." });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/plan/review") {
    try {
      const body = await readJson(request);
      const errors = validateReviewPlanInput(body);
      if (errors) return sendJson(response, 400, { error: "计划复评数据无效。", errors });
      return sendJson(response, 200, reviewAndAdjustPlan(body));
    } catch {
      return sendJson(response, 400, { error: "Invalid JSON body." });
    }
  }

  return sendJson(response, 404, { error: "Not found." });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`fitness-plan-service listening on http://0.0.0.0:${port}`);
});
