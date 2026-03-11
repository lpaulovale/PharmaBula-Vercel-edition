/**
 * BulaIA MCP Server
 *
 * Wraps existing internal logic (tool_registry, resource_manager, prompt_manager)
 * into a proper MCP server using @modelcontextprotocol/sdk with JSON-RPC 2.0 transport.
 *
 * Primary transport: StdioServerTransport
 * Optional transport: HTTP/SSE (enabled via --http flag)
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

// Import existing business logic
const { listTools, executeTool } = require("./lib/tool_registry");
const { listResources, readResource } = require("./lib/resource_manager");
const { listPrompts, getSystemPrompt } = require("./lib/prompt_manager");

// ============================================================
// Configuration
// ============================================================
const HTTP_PORT = process.env.MCP_HTTP_PORT || 3000;
const ENABLE_HTTP = process.argv.includes("--http") || process.env.MCP_HTTP === "true";

// ============================================================
// Server Setup
// ============================================================
const server = new McpServer(
  {
    name: "bula-ia",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ============================================================
// Tool Handlers
// ============================================================
server.server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = listTools();
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
});

server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await executeTool(name, args || {});

    if (result.error) {
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Tool execution error: ${error.message}` }],
      isError: true,
    };
  }
});

// ============================================================
// Resource Handlers
// ============================================================
server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = listResources();
  return {
    resources: resources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })),
  };
});

server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    const result = await readResource(uri);

    if (!result.found) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Resource not found", message: result.message }, null, 2),
          },
        ],
        isError: true,
      };
    }

    const mimeType = uri.startsWith("bula://") ? "text/plain" : "application/json";
    const textContent = JSON.stringify(result, null, 2);

    return {
      contents: [
        {
          uri,
          name: result.data?.name || uri,
          mimeType,
          text: textContent,
        },
      ],
    };
  } catch (error) {
    return {
      contents: [
        {
          type: "text",
          text: JSON.stringify({ error: "Resource read error", message: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// ============================================================
// Prompt Handlers
// ============================================================
server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
  const prompts = listPrompts();
  return {
    prompts: prompts.map((p) => ({
      name: p.name,
      description: p.description,
    })),
  };
});

server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name !== "planner") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Prompt '${name}' not found. Available prompts: planner, safety_judge, quality_judge, source_judge, format_judge.`,
            },
          },
        ],
        isError: true,
      };
    }

    const mode = args?.mode || "patient";
    const date = args?.date || new Date().toISOString().split("T")[0];
    const question = args?.question || "";
    const documents = args?.documents || "";

    const promptText = getSystemPrompt(mode, { date, question, documents });

    return {
      messages: [
        {
          role: "system",
          content: {
            type: "text",
            text: promptText,
          },
        },
      ],
    };
  } catch (error) {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Error retrieving prompt: ${error.message}`,
          },
        },
      ],
      isError: true,
    };
  }
});

// ============================================================
// Error Handler for JSON-RPC
// ============================================================
process.on("uncaughtException", (error) => {
  const jsonRpcError = {
    jsonrpc: "2.0",
    id: null,
    error: {
      code: -32603,
      message: "Internal error",
      data: error.message,
    },
  };
  process.stderr.write(JSON.stringify(jsonRpcError) + "\n");
  process.exit(1);
});

// ============================================================
// Start Server
// ============================================================
async function startServer() {
  if (ENABLE_HTTP) {
    // HTTP/SSE Transport
    const express = require("express");
    const app = express();

    app.post("/mcp", async (req, res) => {
      const transport = new SSEServerTransport("/messages", res);
      await server.connect(transport);
    });

    app.post("/messages", async (req, res) => {
      // Handle SSE messages
      res.status(200).send();
    });

    app.listen(HTTP_PORT, () => {
      console.error(`BulaIA MCP Server running on HTTP port ${HTTP_PORT}`);
      console.error(`SSE endpoint: http://localhost:${HTTP_PORT}/mcp`);
    });
  } else {
    // Stdio Transport (default)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("BulaIA MCP Server running on stdio");
    console.error("Available capabilities: tools, resources, prompts");
  }
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
