const http = require("node:http");

const port = 4321;

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Hello LocalApp</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: "Segoe UI", system-ui, sans-serif;
            background: #f4f6f8;
            color: #18202b;
          }
          main {
            width: min(520px, calc(100vw - 48px));
            padding: 32px;
            border: 1px solid #dde3ea;
            border-radius: 8px;
            background: #fff;
            box-shadow: 0 18px 44px rgb(15 23 42 / 10%);
          }
          h1 {
            margin: 0 0 8px;
            font-size: 28px;
          }
          p {
            margin: 0;
            color: #5e6b7d;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Hello LocalApp</h1>
          <p>This page is served by a tiny Node.js app launched through AppShelf.</p>
        </main>
      </body>
    </html>
  `);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Hello LocalApp is running at http://localhost:${port}`);
});
