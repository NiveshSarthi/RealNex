# Coolify Deployment Guide

Your project is now optimized for Docker and can be deployed on Coolify in two ways:

## Option 1: Docker Compose (Recommended)
This method deploys both the **Frontend** and **Backend** as a single stack.
1. In Coolify, create a new **Service** or **Application**.
2. Select **Docker Compose** as the build pack.
3. Coolify will automatically detect the `docker-compose.yml` in the root.
4. Ensure you set the following Environment Variables in the Coolify dashboard:
   - `DB_PASSWORD`
   - `NEXT_PUBLIC_API_URL` (Points to your public backend URL)

## Option 2: Single Dockerfile (Standard Application)
If you are deploying the Backend and Frontend as separate Coolify Applications:
- **Backend**: Set the build path/Dockerfile path to `backend/Dockerfile`.
- **Frontend**: Set the build path/Dockerfile path to `frontend/Dockerfile`.

*Note: I have added a root `Dockerfile` that defaults to building the Backend to prevent "Dockerfile not found" errors during initial setup.*
