#!/bin/bash
git add -A
git commit -m "${1:-update}"
git push
# Trigger deploy automático en Render
curl -s "https://api.render.com/deploy/srv-d85n6brrjlhs73a4fvk0?key=JyzVPl8-Up4" > /dev/null
echo "✅ Deploy triggered en Render"
