import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import scdlPkg from "soundcloud-downloader";
import cors from "cors";

const scdl = (scdlPkg as any).default || scdlPkg;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Allow cross-origin requests from WordPress/external sites
  app.use(cors({
    origin: "*"
  }));

  // Middleware to parse form data
  app.use(express.urlencoded({ extended: true }));

  // API route for soundcloud download
  app.all("/download", async (req, res) => {
    const trackUrl = req.body.url || req.query.url;

    if (!trackUrl) {
      return res.status(400).send(`
        <div style="color: white; background: #0f172a; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <h2>Error: URL is required.</h2>
          <a href="javascript:history.back()" style="color: #38bdf8; text-decoration: none;">&larr; Go back</a>
        </div>
      `);
    }

    try {
      if (!trackUrl.includes("soundcloud.com")) {
        return res.status(400).send(`
          <div style="color: white; background: #0f172a; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <h2>Error: Invalid SoundCloud URL.</h2>
            <a href="javascript:history.back()" style="color: #38bdf8; text-decoration: none;">&larr; Go back</a>
          </div>
        `);
      }

      console.log(`Fetching info for: ${trackUrl}`);
      const info = await scdl.getInfo(trackUrl);
      const title = info.title || "soundcloud_track";
      const cleanTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();

      console.log(`Starting download for: ${title}`);
      const stream = await scdl.download(trackUrl);

      // Force file download in browser
      res.setHeader("Content-Disposition", `attachment; filename="${cleanTitle}.mp3"`);
      res.setHeader("Content-Type", "audio/mpeg");

      stream.pipe(res);
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).send("Error streaming the file.");
        }
      });
    } catch (error: any) {
      console.error("Download error:", error);
      res.status(500).send(`
        <div style="color: white; background: #0f172a; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <h2>Error downloading track.</h2>
          <p style="color: #94a3b8; max-width: 600px; text-align: center;">${error.message}</p>
          <a href="javascript:history.back()" style="color: #38bdf8; text-decoration: none; margin-top: 20px;">&larr; Go back</a>
        </div>
      `);
    }
  });

  // Vite middleware for development or Static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
