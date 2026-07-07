# ASHENRITUAL AI — Try-On Prototype

Frontend foundation for a real-time AI virtual try-on experience, built ahead
of integration into a larger luxury fashion platform.

This repository contains **UI and architecture only**. There is no camera
access, no AI/ML inference, and no backend — those layers attach later on
top of this structure.

## Stack

React · TypeScript · Vite · Tailwind CSS · React Router · Framer Motion · Lucide React

## Getting started

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

```bash
npm run build     # type-checks and builds to /dist
npm run preview   # serves the production build locally
npm run lint       # runs ESLint
```

## Routes

| Path       | Page                          |
| ---------- | ------------------------------ |
| `/`        | Landing — hero + process       |
| `/try-on`  | Try-On Studio (static UI shell) |
| `/about`   | About the project              |

## Scope

- **In scope:** routing, layout shell, design system (color/type tokens),
  reusable UI primitives, the Landing/Try-On/About pages.
- **Out of scope:** camera capture, pose/segmentation models, garment
  rendering, and any server or API integration.
