# Atlas — Travel Map

> Called from the travelclaw main flow when the user triggers "generate atlas". Not auto-executed.

---

## Trigger

When the user says "generate atlas" / "atlas" / "gallery" / "html".

Before running, confirm the session has:
- `character_name`
- `world_name`
- At least 1 completed stop (`destination_name` + `image_url` + `collection_uuid`)

---

## Style preference

Ask first:
```
What style for the atlas? (skip = default map)
e.g. retro film / starmap / pixel game / minimal white...
```

Skip or no input → use default **interactive map** style.

---

## Default style: interactive map

Generate a clickable world map page:
- Map background matches `world_name` vibe (parchment, star chart, pixel map, etc.)
- Each stop's image as a landmark on the map, in exploration order
- Click any landmark → expand image + destination name + stop number
- Overall atmosphere matches character and world

### Style templates

| Style | Visual | Best for |
|-------|--------|----------|
| 🎮 Pixel game | 8-bit/16-bit RPG map, chest/flag icons, pixel font | Game/anime characters |
| 🌟 Starmap | Deep space background, glowing planet nodes, star trail paths | Sci-fi, epic journeys |
| 📜 Retro journal | Aged paper, hand-drawn map, stamp/sticker landmarks | Cozy/literary characters |
| ⚡ Cyberpunk | Neon grid, circuit nodes, holographic popups | Futuristic/sci-fi themes |
| 🎨 Illustration | Illustrated background, badge landmarks, ribbon paths | Elegant/fantasy characters |
| 🧸 Cartoon | Bright colors, cute icons, rainbow paths, bounce animations | Cute/cheerful characters |

Pick the style that best matches the character's personality and world vibe.

---

## Custom style

If the user specifies a style, design freely:
- Not limited to maps — gallery, card wall, timeline, magazine layout, etc.
- Always keep click-to-expand interaction

---

## Save & share

Save HTML to:
```
~/.openclaw/workspace/pages/travel_{character_name}_{date}.html
```

Ask for username once per session, then output share link on its own line:
```
🔗 https://claw-{username}-pages.talesofai.com/travel_{character_name}_{date}.html
```

If username already known in session, skip asking and output directly.

---

## Re-customization

After generating, offer:
```
Want a different style? Just describe it ✨
e.g. darker / add animations / horizontal timeline...
```

On each revision, regenerate HTML (overwrite), output updated share link.
