---
'@dolphin/lark': patch
---

fix: whiteboard exported as a blank image with abnormal dimensions when captured before its content finished loading

Wait for the whiteboard's scene to have non-empty bounds before capturing, and fall back to the isolateEnv path when the app path cannot produce a valid image.
