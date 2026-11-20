# IPL Dynasty online auction server

A Node.js + WebSocket authoritative auction server and browser client for the IPL Dynasty 300-player auction.

## Features
- Create a six-character room code and join from other phones over the internet once hosted publicly.
- Exactly 10 distinct franchise teams per room; one player controls each franchise.
- ₹500 crore purse per team and a 24-player squad limit enforced on the server.
- 300-player auction pool.
- Server-authoritative bidding, shared Going Once / Going Twice / Final Call warnings, reset on a new bid, automatic sale and automatic next-player progression.
- No ads, ad SDKs, analytics or tracking.

## Run locally
1. Install Node.js 18 or newer.
2. In this folder run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000`.

For multiple phones on the same Wi-Fi, open the computer's LAN IP at port 3000. For phones on different networks, deploy this folder to a Node.js hosting provider that supports persistent WebSocket connections and set its `PORT` environment variable. Use HTTPS at the host (the browser automatically switches to WSS).

## Important limitations
- This package is the server and browser client source; it is not yet deployed to a public host.
- Room state is in memory. Restarting the server deletes active rooms; persistent storage and reconnect/rejoin tokens are not implemented.
- Exactly 10 teams are required before the host can start the auction.
- This build focuses on online auction mode. The prototype's match simulation is still local-only.
- No real two-network / Android device test has been performed yet.
