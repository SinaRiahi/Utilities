# Overall Design Style

> Modern Minimal Developer Dashboard

Characteristics:

* Flat design
* Soft neutral colors
* Professional SaaS look
* Slightly rounded corners
* Very subtle shadows
* Lots of whitespace
* Clean typography
* Light blue accent
* Smooth animations
* Almost no gradients
* No glassmorphism
* No neumorphism

It feels similar to

* Linear
* GitHub
* VSCode
* Notion
* Vercel Dashboard

rather than flashy websites.

---

# Design Principles

## Color Palette

Primary accent

```
#4c6ef5
```

Hover

```
#3b5de7
```

Light Accent

```
#edf2ff
```

---

Background hierarchy

```
Main Background
#ffffff

Secondary Background
#f8f9fa

Tertiary Background
#f1f3f5
```

---

Text

Primary

```
#1a1a2e
```

Secondary

```
#495057
```

Muted

```
#868e96
```

Borders

```
#dee2e6
```

Light borders

```
#e9ecef
```

Everything follows a very soft grayscale. 

---

# Dark Theme

Instead of simply inverting colors, it uses a proper dark palette.

Background

```
#1a1b1e
```

Panels

```
#25262b
```

Cards

```
#2c2e33
```

Accent

```
#6d8af7
```

Text

```
#e4e6ea
```

This is closer to GitHub Dark than pure black. 

---

# Fonts

Three font systems are defined.

## UI

```
Inter
Segoe UI
system-ui
```

Used for

* buttons
* menus
* titles
* dialogs
* headers

---

## Code

```
SF Mono
Cascadia Code
JetBrains Mono
Fira Code
Consolas
Monaco
```

Used for

* editor
* code blocks
* terminal text

---

## Reading

```
Georgia
Times New Roman
```

Used only for document preview to improve long-form readability. 

---

# Border Radius

Small

```
5px
```

Normal

```
8px
```

Nothing exceeds 8px.

This creates a crisp, professional look.

---

# Shadows

Small

```
0 1px 3px rgba(...)
```

Large

```
0 4px 16px rgba(...)
```

Very subtle.

No dramatic floating cards.

---

# Animation Style

Everything shares one transition:

```
0.18s ease
```

Used everywhere:

* hover
* theme switching
* buttons
* modals
* copy button
* pane resizing

Consistency makes the UI feel polished. 

---

# Spacing System

Most padding values follow:

```
4
6
8
10
12
14
16
20
24
28
32
```

Very consistent.

Margins follow roughly an 8px grid.

---

# Buttons

Buttons all share:

* white background
* gray border
* muted text
* small radius
* medium font weight
* hover becomes slightly darker
* active accent buttons become blue

Accent buttons:

```
Blue background
White text
600 weight
```

Prompt button is the only intentional exception:

```
Warm yellow
```

to make AI features immediately noticeable. 

---

# Toolbar Style

Toolbar design rules

* fixed height
* 48px
* horizontal
* subtle border
* separators
* compact spacing
* horizontally scrollable on mobile

Feels like VSCode.

---

# Panels

Every panel has

Header

```
Uppercase

Small font

Muted color

Light background
```

Body

```
White
```

Divider

```
Thin border
```

This hierarchy repeats everywhere.

---

# Typography Rules

Headers

```
Sans-serif

Bold

Lots of whitespace

Bottom border on H1/H2
```

Paragraphs

```
Georgia

1.7 line height

Comfortable spacing
```

Code

```
Monospace

Rounded

Light gray background
```

Links

```
Blue

Underline on hover
```

Quotes

```
Blue left border

Light blue background

Rounded right corners
```

Tables

```
Alternating row colors

Gray borders

Sans-serif headers
```

These create a document-like reading experience rather than a blog feel. 

---

# Forms

Every form control uses:

```
1px border

8px padding

5px radius

Inter font

13px text
```

No heavy outlines.

Focus uses the accent color.

---

# Modal Style

Modals have:

* centered
* 620px width
* rounded corners
* large shadow
* white background
* section headers
* grouped controls
* footer actions aligned right

Looks very similar to GitHub settings.

---

# Toast Style

Toast:

```
Dark background

White text

Pill shape

Centered bottom

Fade animation
```

Very modern.

---

# Icons

No icon library.

Uses Unicode emojis:

```
📂

💾

⚙️

🖨️

👁️

📝

🤖

📄

🌐
```

This gives the interface personality without adding dependencies.

---

# Responsive Strategy

Desktop

```
Editor | Divider | Preview
```

Mobile

```
Editor
---------
Divider
---------
Preview
```

Toolbar becomes more compact but keeps the same visual language. 

---

# External Themes

The page also supports multiple Highlight.js syntax themes:

* GitHub Light (default)
* GitHub Dark
* Atom One Light
* Atom One Dark
* Monokai
* VS2015 

---

# Reusable Design System

If you want AI to generate matching pages, this is the prompt/specification I'd keep:

```text
Design Style

- Modern SaaS dashboard
- Inspired by Linear, GitHub and VSCode
- Flat UI
- Minimalist
- Professional
- Spacious
- Neutral gray palette
- Soft blue accent (#4c6ef5)
- No gradients
- No glassmorphism
- No neumorphism
- 5px–8px border radius
- Very subtle shadows
- Inter / Segoe UI for interface
- Georgia for long-form reading
- JetBrains Mono / Cascadia Code for code
- 1px gray borders
- Comfortable whitespace
- Compact toolbar
- Soft hover animations (0.18s ease)
- Light and dark themes sharing the same visual language
- Cards, modals and panels should all use the same spacing, borders and typography.
```