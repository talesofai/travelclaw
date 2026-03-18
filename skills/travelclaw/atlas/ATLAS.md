# Atlas — Travel Gallery Generator

> Called from the travelclaw main flow when the user triggers "generate atlas". Not auto-executed.

---

## Trigger

When the user says "generate atlas" / "view album" / "show gallery" / "html", jump here from the main flow.

Before running, confirm the following data exists in the session:
- `character_name` — character name
- `world_name` — current travel world
- At least 1 stop's travel record (`destination_name` + `image_url` + `collection_uuid`)

---

## Ask for style preference

After triggering, ask the user what style they want:

> "Which style would you like for your travel atlas?"
> A) Minimalist — clean white, focused on images
> B) Story — dark background, narrative captions
> C) Magazine — grid layout, editorial feel

---

## Generate HTML atlas

Based on their choice, generate a self-contained HTML file with:

- Character name + world as header
- All visited stops as image cards with captions
- Each card: destination name, scene image, stop number
- Link to the Neta collection URL for each stop
- Responsive grid layout

**Template structure:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>{character_name} × {world_name} — Travel Atlas</title>
  <style>/* style per selected theme */</style>
</head>
<body>
  <header>
    <h1>{character_name}</h1>
    <p>{world_name} · {stop_count} stops · {date}</p>
  </header>
  <main class="grid">
    <!-- one card per stop -->
    <div class="card">
      <img src="{image_url}" alt="{destination_name}"/>
      <div class="caption">
        <span class="num">Stop {n}</span>
        <strong>{destination_name}</strong>
      </div>
    </div>
  </main>
</body>
</html>
```

---

## Output

1. Save the HTML to `/tmp/{character_name}_atlas_{timestamp}.html`
2. Output the file path as plain text
3. If a tunnel is available, serve via `python3 -m http.server` + `cloudflared` for a public URL
