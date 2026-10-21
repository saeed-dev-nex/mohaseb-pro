---
title: Mohaseb Pro
emoji: 🧾
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
short_description: Persian invoicing and workshop management (Django + React)
---

# Mohaseb Pro — Hugging Face Space

This Space runs Mohaseb Pro (Persian invoicing / workshop management,
Django + React) as a single Docker container: one Daphne process serves
the API, the chat WebSocket, the built frontend and the uploaded media.

**First login:** on the very first start the app creates the user
`admin` with a random password and prints it to the Space's runtime
logs exactly once (look for "Initial password"). Sign in and change it.

**Data:** without Hugging Face Persistent Storage the Space's disk is
ephemeral — the SQLite database and uploads reset when the Space
restarts or wakes from sleep. Either enable Persistent Storage
(the entrypoint automatically uses the `/data` mount) or export
encrypted backups from inside the app on a regular schedule.

Full Persian deployment guide: `deploy/huggingface/DEPLOY-FA.md` in the
project repository.
