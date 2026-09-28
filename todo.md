- Add persistent chat storage (ongoing)
- Add the register endpoint and invite codes
- Fix input white background styling
- WebSocket auto-reconnect: 10 second countdown, re-request the open chat's history, stop the send box losing messages while disconnected
- Multiple tabs per user (userConnections only holds one socket per user)
- Unread badges in the sidebar
- Update the nginx site to proxy everything to Node (remove root/try_files), then restart the Node server
- Check the jump-to-latest button and chat layout after a hard refresh

# Resources
- https://developer.mozilla.org/en-US/docs/Learn_web_development
- https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Your_first_website/Adding_interactivity
- https://flexboxfroggy.com/
- https://cssgridgarden.com/
